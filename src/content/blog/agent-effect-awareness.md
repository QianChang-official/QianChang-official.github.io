---
title: 这个方案到底有没有必要存在：一次 Agent 安全方案的组会拷打
link: agent-effect-awareness
date: 2026-09-19 23:20:00
updated: 2026-09-20 21:00:00
tags:
  - AI Agent
  - 安全
  - 研究方法论
categories:
  - 技术
---

朋友拿了个 Agent 安全的研究方案来找我。命题挺工整：用户批准 Preview 之后，保证 Commit 阶段执行的效果和批准时的承诺一致，也就是 **E_preview == E_actual**。

我看了两天，每天一小时。看完最大的感受不是"这方案有什么问题"，而是另一个级别的追问——**这方案到底有没有必要存在**。这篇是我按"顶会审稿人 + 导师组会拷打模式"给的完整批判，以及批判完之后我自己觉得真正值得做的方向。

写完初稿之后我又去查了一圈文献，发现这个方向比我想象的更有东西。这篇是修订版，补上了真实存在的相关工作，也把批判之后浮出来的方向写得更完整。

## 原方案：批准的完整性

方案叫 Effect Bind，目标是 Intent-Preserving Agent Execution。核心链路：

```
Preview → 用户批准 → Commit → 对象被换了（namespace/object drift）
```

工程组件是 Effect Witness、Capability 令牌、Commit Validation、fd-relative 执行，形式化谓词 ObjectMatch / NamespaceMatch / StateMatch，要证明 Safety Theorem：未授权效果不可达。

工程上是能做的。但能做不等于值得做。

## 七层批判

### 一、你可能在解决一个被新架构消灭的问题

这是我最不舒服的地方。YoloFS（SOSP 2026）的思路不是"怎么让 Commit 正确"，是"为什么要在真实文件系统 Commit"——所有修改先放进 staging filesystem，用户看到最终结果再决定合不合并。

这个工作是真的存在的：Shawn Wanxiang Zhong 等人（University of Wisconsin–Madison）基于 290 份公开的 AI coding agent 文件误用报告，提出把信息和控制从 agent 侧转移到文件系统侧。三个核心原语：introspecting effects（变更先暂存、供用户审查）、undoing mutations（快照支持回滚）、gating accesses（渐进式权限）。

两种范式是根本分歧：

- 这方案：批准承诺 → 验证执行；
- YoloFS：看到执行结果 → 再批准。

如果"先 stage 一切"成了主流，研究对象本身就被削弱了。审稿人必问 **Why not stage everything?**，整篇论文都得回答这个问题。

### 二、问题可能根本不重要

安全领域有个残酷规律：存在攻击 ≠ 值得发论文。namespace drift 确实存在（TOCTTOU 几十年前就有），但文档里没证据回答：问题规模多大？真实世界多少事故？多少 Agent 因此出问题？

反过来 YoloFS 直接拿 290 个真实事故开局——删库、覆盖文件、泄漏凭据，全是用户天天骂街的问题。namespace drift 是"高级攻击面"，不是主流痛点。这很危险。

TOCTTOU 这个谱系本身也值得说清楚：Bishop & Dilger 在 1996 年 USENIX 的 *Checking for Race Conditions in File Accesses* 首次系统化形式化这个问题，但漏洞实例能追溯到 1990 年代初的 BSD `mktemp()` 问题。所以这不是新问题，是旧问题在新场景下的复现。

### 三、和现代 Agent 安全研究错位

近两年 Agent 安全的主线是 Capability / Information Flow / Runtime Enforcement / Policy Verification，共同关心的是 **Agent 为什么能做某事**。

这个方向有真实存在的代表性工作：AgentSpec（Haoyu Wang 等，ICSE 2026）用轻量 DSL 在运行时约束 agent；Progent（Dawn Song 等）做最小权限控制；CaMeL（Google DeepMind）在 LLM 外围建立 capability 安全层；Conseca 按任务上下文即时生成安全策略。

而这个方案管的是：Agent 被允许做之后，文件对象有没有变。问题突然小了一层，格局也跟着小了。

### 四、形式化程度其实很弱

ObjectMatch / NamespaceMatch / StateMatch 还是系统设计文档语言，不是安全论文语言。真正难的问题是**什么叫 Effect 相同**：

- Preview 删 a.txt、Commit 删 a.txt，但 inode 变了，算不算同一 Effect？
- Preview 改 config.json、内容变化一样但对象不是同一个，算不算？
- Preview rename a→b、最终目录状态一致但过程经过别的对象，算不算？

方案只定义了 Effect Witness，没定义 **Effect Equivalence**。这是两个层次。

### 五、创新点太容易被拆

effect model 是操作语义、capability 是 token、commit validation 是运行时校验、fd-relative 是 openat——全是老东西。审稿人最容易说的就是 *Nice composition*，翻译过来是"拼得不错"，不是"这是新东西"。很多系统论文死在这：每个组件都对，组合也合理，但没人觉得创新。

### 六、Benchmark 价值被高估

Benchmark 活下来的前提是"别人以后也想测"。EffectBind-Bench 那 18 个 case 大概率是文件系统授权的 corner case，不是 Agent 的 benchmark 负载。AgentDojo 活下来因为 prompt injection 谁都关心，YoloFS 活下来因为误删文件谁都关心。五年后别人还在测 namespace drift 吗？我不敢答"会"。

### 七、方案有种安全洁癖

这是很多博士论文的通病。研究者眼里 E_preview ≠ E_actual 非常不能忍，于是设计了 Witness / Capability / Validation / Evidence / Replay 一整套体系。但产业界的回答是：给我个 snapshot / undo / git commit / sandbox，问题结束。论文很优雅，落地价值有限。

## 真正的方向：Agent 知不知道自己干了什么

批判完，我说一下如果真要从这篇里挑一个"成功概率最低、但做成了非常独特"的种子，我选哪个。

不是 E_preview == E_actual，是：

> **E_agent-believed == E_actual ?**

这个方案默认的链路是"用户看到 Preview → 批准 → 系统保证 Commit 没被替换"。但现实中 Agent 经常不是这么死的，是死于 **Agent 自己根本不知道它干了什么**。

YoloFS 收集的 290 份误用报告里很多事故其实接近这个：rm 执行了，Agent 说"我已经成功清理缓存"，实际删了用户文件。这时候 E_preview == E_actual 甚至成立，问题还是发生了。

### 三层模型

现在几乎所有 Agent 都隐含一个假设：**Tool Observation ≈ World State**——只要工具返回 `{"success": true}`，Agent 就相信事情办成了。但实际上 Tool Output ≠ World State。

可以拆成三层：

- **Believed Effect**：Agent 相信发生的效果
- **Observed Effect**：Agent 观察到的效果
- **Actual Effect**：世界实际发生的效果

三层之间的差距就是 **Effect Awareness Gap**。典型失配：以为改了 3 个文件实际改了 17 个、以为只影响 workspace 实际波及 home 目录、以为删缓存实际删源码。

### 为什么这层不一样

- YoloFS 解决控制权（让用户撤销），但没研究 Agent 是否正确理解自己造成的效果；
- AgentSpec 研究 Agent 应该做什么；
- Safe Tool Use 研究 Agent 是否被允许做；
- 这一层研究 **Agent 是否知道自己做了什么**。

近两年 Agent 安全都在研究"能不能做"，很少有人研究"知不知道自己已经做了什么"。后者可能才是 Agent 长期自主运行时更根本的问题。

而且有个关键发现：**"Effect Awareness" 作为概念名词在 agent 安全领域没人占**。我查了 arXiv 全库，这个术语只出现在图像处理、多旋翼地面效应建模这些完全不相关的领域。这是空白。

## 更上一层：用户到底在授权什么

原文档里最被低估的一句话是"用户批准的是 Preview，不是自由文本"。顺着往上推是个更哲学也更危险的问题——**用户到底在授权什么**？路径？文件？inode？结果？意图？目标状态？

这是 Agent Authorization Theory 的范畴：讨论的不是"怎么保护授权对象"，是"**对 Agent 来说，授权对象到底是什么**"。真有人做出来，会比 Effect Binding 高一个层级。

## 我的选择

两个候选之间，我不会选 Preview → Commit Integrity（二层问题，越做越工程），我会选 **Agent Effect Awareness**（一层问题，成功概率低但做成了非常独特）。

Benchmark 也得跟着改：从 symlink/rename/mount 这类系统攻击用例，改成 **Illusion Cases**——以为成功实际失败、以为失败实际成功、以为影响 A 实际影响 B、以为覆盖单文件实际递归影响目录树。测的是 Agent 对现实的理解，不是文件系统竞态。

这个方向也有空白：把幻觉（hallucination）概念扩展到系统操作层目前基本没人做。HaluEval（EMNLP 2023）做的是语言模型的幻觉评测，但没有人把它延伸到文件系统操作层面。YoloFS 用的是 "misuse" 话语，不是 "hallucination"。这也是空白。

## 一个可落地的研究蓝图

批判完之后我把这个方向整理成了一个可执行的研究蓝图。不是空想，是有真实文献支撑、有明确阶段、有可验证输出的路线。

### 研究目标

1. **形式化定义 Effect Awareness**：给出 Agent 在文件系统上的"效果认知"层级模型（自报告、可观测、可验证、可回滚）；
2. **连接经典安全问题与 Agent 行为**：把 TOCTTOU、namespace drift 重写为 Agent 行为模式与风险场景；
3. **评估并扩展现有方案**：系统分析 Effect Bind 类方案的机制与局限；
4. **构建 Agent-Native Filesystem 设计原则**：在 YoloFS 的 staging、snapshots、progressive permission 基础上抽象出通用原语；
5. **设计 Illusion Cases Benchmark**：构造系统化的"效果幻觉"用例集。

### 核心研究问题

- **Q1**：什么是"Effect Awareness"？Agent 对文件系统操作的"预期效果""实际效果""可观察效果"之间如何形式化刻画？
- **Q2**：经典安全问题如何在 Agent 场景中重现？TOCTTOU、namespace drift 在多轮工具调用、缓存路径、符号链接等场景中的新形态是什么？
- **Q3**：Effect Bind 的结构性局限在哪里？它依赖 Agent 自报告与工具层过滤，在哪些情况下必然失效或产生幻觉？
- **Q4**：Agent-Native Filesystem 应提供哪些原语？introspect effects、undo mutations、gate accesses 如何组合成可推广的系统接口？
- **Q5**：Illusion Cases 如何系统化构造与度量？如何定义"以为成功但失败""以为影响 A 实际影响 B"等类别，并量化评估？

### 方法论

**理论与模型**：基于 YoloFS 提出的信息与控制双维度，构建 Agent–Filesystem–User 三方交互模型；把 TOCTTOU、namespace drift 以时序逻辑或因果图形式重写为 Agent 行为模式。

**实证与系统原型**：复用或扩展 YoloFS 的 290 份公开误用报告数据集，标注错误类型与幻觉模式；在现有文件系统之上实现简化版 Agent-Native 层，支持 staging、snapshots、权限渐进。

**Benchmark 设计**：Illusion Cases 分类——效果错判（以为成功/失败）、对象错位（以为影响 A 实际影响 B）、范围错估（以为单文件实际递归目录）；度量指标——Agent 是否能正确识别效果、主动纠错（利用 snapshots/undo）、在有限交互下保持安全边界。

### 阶段规划

| 阶段 | 时间预估 | 主要任务 | 关键产出 |
| --- | --- | --- | --- |
| 文献与问题梳理 | 1–2 个月 | 系统阅读 YoloFS、经典 OS 安全文献；整理误用案例类型 | 问题分类表、Effect Awareness 初步定义 |
| 形式化模型与定义 | 2–3 个月 | 构建 Agent–FS–User 交互模型；形式化 TOCTTOU/namespace drift 在 Agent 场景中的表达 | 模型与定义草案，若干典型时序/因果图 |
| 原型系统设计与实现 | 3–4 个月 | 设计简化版 Agent-Native FS 原型；实现 staging/snapshots/progressive permission | 原型系统、接口文档、若干演示任务 |
| Illusion Cases Benchmark 构建 | 2–3 个月 | 基于误用数据与模型构造系统化用例集；设计评估指标与流程 | Benchmark 规范、用例库、评估脚本 |
| 综合评估与理论总结 | 2 个月 | 在多种 Agent/框架上运行 Benchmark；分析 Effect Bind 与 Agent-Native FS 的对比结果 | 实验报告、设计原则总结、论文草稿 |

### 预期成果

- **概念与模型**：提出可被社区复用的 Effect Awareness 形式化框架；
- **系统与接口**：给出一套可推广的 Agent-Native Filesystem 设计原语；
- **评估工具**：发布 Illusion Cases Benchmark，成为 Agent 安全与自治评估的新维度；
- **理论影响**：将 Agent 安全讨论从"攻击防御"拓展到"认知与效果控制"，连接操作系统、安全与认知建模。

### 关键挑战

- **定义难度**："知道""效果"本身具有哲学与认知学复杂性，形式化时需避免过度简化或空泛；
- **数据与场景多样性**：不同 Agent 框架、工具链、用户习惯导致误用模式高度异质，Benchmark 需兼顾代表性与可操作性；
- **用户交互成本**：强化效果可见性与控制可能增加用户负担，需要在安全与可用性之间找到平衡；
- **系统集成**：在现有文件系统与开发工具链中落地 Agent-Native 层，涉及工程复杂度与性能权衡。

## 关于研究方法的分歧

我和方案作者在方法上有个没收敛的分歧：他主张先看文献摸清现有研究再做最小验证；我的看法是，文献综述这事 AI 已经能全做完了，不必再用古法读文献——我们已处在 AGI → RSI 的时代，这方案真正缺的不是文献调研，是**数学证明**。每一个工程判断都需要数学支撑。

后来聊着聊着就跑到了哲学上。"你知道'知道'这个词吗？究竟什么是知道，你如何知道，是否可信、是否成立"——这是哲学，就是 AI 缺的那部分。人类有三层认知，AI 现有的只有两层，差的就是这层模糊不清的哲学与证明。它既是 AI 安全的终点，也是起点。

所以我说这已经不是纯计算机方向了，是交叉领域。他也认。

---

术语表：E_preview（批准时展示的预期效果）、E_actual（实际执行效果）、Effect Equivalence（效果等价性）、Namespace Drift（命名空间漂移）、TOCTTOU（Time-of-check to time-of-use，检查与使用竞态）、Staging Filesystem（暂存文件系统）、Effect Awareness Gap（Agent 信念效果与实际效果的差距）、Illusion Cases（测现实理解失真的用例）、Agent-Native Filesystem（以文件系统为中心的 Agent 安全架构）。
