---
title: 把网页音频做到比本地播放器更好听：R2 + Web Audio 工作台踩坑记
link: web-audio-workspace-retro
date: 2026-09-19 18:30:00
tags:
  - Web Audio
  - 前端
  - 音频处理
categories:
  - 技术
---

给自己的静态博客做了一个在线音源控制台：FLAC 流媒体播放、10 段参数 EQ、差分环绕声、实时频谱。中途踩了一连串教科书级的坑——切 EQ 直接暂停、一股电话音的沉闷感、换页音乐就断。这篇复盘一下问题根因和修法，全部是浏览器音频里最经典的那几类错误。

## 架构

```plain
R2 (FLAC 对象存储)
  └─ Range 请求流式加载
       └─ <audio> 元素 (全局单例)
            └─ MediaElementSource → AudioWorklet(差分环绕) → 10×BiquadFilter(EQ)
                 → Gain(预增益) → DynamicsCompressor(限幅) → 声卡
```

站点是 Astro 静态站（astro-koharu 主题），音频引擎做成**模块级单例**，挂在所有页面共享的悬浮播放器里，所以跨页导航不中断。

## 坑一：切 EQ 直接暂停

最早的症状：点任何一个 EQ 预设，播放立刻停。

原因不在音频层，在 React。控制台里挂载全局 `<audio>` 的容器用的是内联 ref，每次 setState（切 EQ、动滑块、甚至状态栏文字变化）都会重渲染，旧代码在 ref 里对同一元素重复调用 `load()`，直接重载媒体流。

修法是给 ref 用稳定的 `useCallback`，元素只挂载一次。这个改动让"切预设必暂停"消失了。

## 坑二：电流声 + 通话感（最隐蔽的一个）

暂停修好后，声音本身不对：**不管开不开 EQ 和环绕，都是一股沉闷的电话音，还夹杂着电流杂音**。

我一开始怀疑是环绕 worklet 的相位问题，直到对比了重构前的旧版实现才发现真相——某次"健壮性"改动里加了一行看似无害的代码：

```ts
sourceNode.connect(analyserIn);      // 处理链路
sourceNode.connect(ctx.destination); // ← "兜底"直连
```

第二行的本意是"引擎没接好也能出声"，实际效果是：**干声和处理后的湿声在输出端叠加**。这造成两件事：

1. **削波**：干+湿叠加大约 +4.7dB，FLAC 大动态处直接顶破满幅——这就是"电流声"的真身，是数字削波的爆音；
2. **梳状滤波**：干声和经过 EQ/环绕相位偏移的湿声混合，频响被挖出一排等间隔的坑——这就是"通话感、沉闷"的来源。

删掉那行直连，恢复成单一处理路径，音质立刻干净了。**教训：音频图里永远不要有第二条并联通往输出的路。**

## 坑三：差分环绕 worklet 的爆音

环绕处理器（把立体声拆成 M/S 中置+差分，对差分做滤波、Haas 延迟再反相混合）自己也有问题：

- 每个渲染量子（128 采样）都重新分配滤波器系数对象——在音频线程制造 GC 压力，产生细碎爆音；
- 整数延迟线 + 参数硬切——拖动延迟滑块时咔哒作响。

修法：系数只在截止频率变化时重算、延迟线改线性插值小数延迟并逐采样平滑、开关加约 4ms 交叉淡化。之后所有参数实时调节都干净了。

## 坑四：静态站换页就停播

最难缠的一个。用 Astro 的 ClientRouter 在站内切页，音乐总是断。

用事件探针钉住音频元素全程跟踪才发现：**换页瞬间浏览器会异步 pause 媒体元素**，没有 JS 调用栈、pause 事件可能在换页完成后才派发、连元素 `isConnected` 都是 true。`transition:persist` 保住的是 DOM 节点，保不住播放状态。

解法是双层的：

```ts
// 模块加载时就把元素挂到 body（display:none，永不卸载）
document.body.appendChild(globalAudio);

// 模块级监听：换页前记播放意图，换页后无缝恢复
document.addEventListener('astro:before-swap', () => {
  resumeAfterSwap = !globalAudio.paused && !globalAudio.ended;
});
document.addEventListener('astro:page-load', () => {
  if (resumeAfterSwap) globalAudio.play(); // 带重试
});
```

因为这段挂在模块层而不是组件里，所以不受任何岛屿重挂载时序影响。现在站内随便切页，播放最多有一个听不出的亚秒级衔接，进度条连续推进。

## 顺手做的延迟优化

从"点播放"到"听到声音"的链路也压了一遍：

- `<head>` 里对 R2 域和 Worker 加 `preconnect`（必须带 `crossorigin`，否则预热连接进的是另一个连接池，CORS 媒体请求用不上）；
- `AudioContext` 用 `latencyHint: 'interactive'`（最小输出缓冲）；
- 首个 `pointerdown` 就唤醒上下文，不等 `play` 事件冒泡；
- 悬浮播放器原来藏了第二个 `<audio>` 当进度条用，导致每首歌被完整下载两遍——换成绑定共享元素的滑条，顺带加了音量控制。

## 总结

这套东西最后的效果是：FLAC 边下边播、EQ/环绕实时无级调节不中断、换页不断、延迟压到最低。浏览器音频的坑基本都踩在"隐式行为"上——自动重载、异步暂停、并联混音——没有一行是报错，但每一行都出声。

源码在 [QianChang-official.github.io](https://github.com/QianChang-official/QianChang-official.github.io) 的 `src/components/audio/` 下，音源控制台在[音源页](/audio)可以直接玩。
