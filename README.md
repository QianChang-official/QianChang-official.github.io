# 落赋韶华 · qianchanglys.top

浅唱ヾ落雨殇（[QianChang-official](https://github.com/QianChang-official)）的个人站点，基于开源主题 [astro-koharu](https://github.com/cosZone/astro-koharu)（AGPL-3.0）构建，部署于 GitHub Pages。

## 功能

- 博客：文章 / 分类 / 标签 / 归档 / Pagefind 全文搜索 / 明暗主题 / RSS / Sitemap
- **R2 Audio Workspace 音源控制台**（`/audio`）：基于 Cloudflare Worker + R2 的在线音源管理，含播放列表、上传、删除、10 段 EQ、差分环绕声（Haas）、频响曲线与双频谱可视化
- 全局悬浮播放器：任意页面可持续播放，跨页不断播
- 环绕声实验室（`/surround`）：独立的差分环绕声调试台（文件 / 麦克风 / 演示信号源）

## 开发

```bash
pnpm install
pnpm dev      # 本地开发
pnpm build    # 构建（输出 dist/）
```

音频功能依赖 Cloudflare Worker API 与 R2 公共域，可用浏览器内 localStorage 覆盖默认地址（键：`qcAudioApiBase` / `qcAudioPublicBase` / `qcAudioDevToken`）。

## 部署

GitHub Actions 自动构建并发布到 GitHub Pages（自定义域名 qianchanglys.top）。

## 许可

本站基于 [astro-koharu](https://github.com/cosZone/astro-koharu) 主题（AGPL-3.0）二次开发，遵循 [AGPL-3.0](./LICENSE) 开源。
