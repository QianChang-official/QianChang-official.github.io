---
title: Agent 知不知道自己干了什么：从 Effect Integrity 到 Effect Awareness
link: agent-effect-awareness
date: 2026-09-19 23:20:00
tags:
  - AI Agent
  - 安全
  - 研究方法论
categories:
  - 技术
---

最近在评审一个 Agent 安全的研究方案。原命题很工整：用户批准 Preview 之后，保证 Commit 阶段执行的效果和批准时的承诺一致，即 **E_preview == E_actual**。

评审完发现，这个命题本身可能站不住——不是因为它错了，而是因为它可能根本不是那层真正值得研究的问题。这篇复盘一下七层批判，以及批判之后浮出来的、更有意思的方向。

## 原方案：授权的完整性

原方案叫 Effect Bind，目标是"意图保持的 Agent 执行"（Intent-Preserving Agent Execution）。核心链路：

```plain
Preview → 用户批准 → Commit → 对象被换了（namespace/object drift）
```

对应的工程组件是 Effect Witness、Capability 令牌、Commit Validation、fd-relative 执行（openat/openat2），形式化谓词是 ObjectMatch / NamespaceMatch / StateMatch，目标是证明 Safety Theorem：未授权的效果不可达。

工程上是可行的，但评审完发现它顶不住"有没有必要存在"的追问。

## 七层批判

### 一、可能在解决一个被新架构消灭的问题

对照 YoloFS（SOSP'26）的思路：不是"如何让 Commit 正确"，而是"为什么要在真实文件系统 Commit"——所有修改先放进 staging filesystem，用户看到最终结果再决定是否合并。

两种范式的分歧是根本性的：

- 本方案：批准承诺 → 验证执行；
- YoloFS：看到执行结果 → 再批准。

如果"先 stage 一切"成为主流，整个研究对象就被削弱了。审稿人必问 **Why not stage everything?**，论文每一节都得回答这个问题。

### 二、问题可能不重要

安全领域有个残酷规律：存在攻击 ≠ 值得发论文。namespace drift 确实存在（TOCTTOU 几十年前就有），但缺证据：问题规模多大？真实世界多少事故？多少 Agent 因此出问题？

YoloFS 用 290 个真实事故开局——删库、覆盖文件、泄漏凭据，是用户天天骂街的问题。而 namespace drift 是"高级攻击面"，不是主流痛点。

### 三、与现代 Agent 安全研究错位

近两年 Agent 安全的主线是 Capability / Information Flow / Runtime Enforcement / Policy Verification——共同关心的是 **Agent 为什么能做某事**。AgentSpec 管"哪些工具允许被调用"，Safe Tool Use 管"能力传播与信息流风险"。

而本方案管的是：Agent 被允许做之后，文件对象有没有变（rename 之后 inode 还是不是原来那个）。问题突然小了一层。

### 四、形式化程度很弱

ObjectMatch / NamespaceMatch / StateMatch 是系统设计文档的语言，不是安全论文的语言。真正难的问题是**什么叫 Effect 相同**：

- Preview 删 a.txt，Commit 删 a.txt，但 inode 变了，算不算同一 Effect？
- Preview 改 config.json，内容变化一样但对象不是同一个，算不算？
- Preview rename a→b，最终目录状态一致但过程经过其他对象，算不算？

方案只定义了 Effect Witness，没有定义 **Effect Equivalence**——这是两个层次。

### 五、创新点容易被拆解

effect model 是操作语义、capability 是 token、commit validation 是运行时校验、fd-relative 是 openat——全是老东西。审稿人最容易讲的一句话是 *Nice composition*，而不是"这是新东西"。很多系统论文死在这里：每个组件都对，组合也合理，但没人觉得创新。

### 六、Benchmark 价值被高估

Benchmark 能活下来的条件是"别人以后也想测"。AgentDojo 活下来因为 prompt injection 谁都关心，YoloFS 活下来因为误删文件谁都关心。EffectBind-Bench 的存亡取决于：五年后别人还在测 namespace drift 吗？不敢答"会"。

### 七、安全洁癖

研究者眼里 E_preview ≠ E_actual 非常不能忍，于是设计了 Witness / Capability / Validation / Evidence / Replay 整套体系。但产业界的回答是：给我个 snapshot / undo / git commit / sandbox，问题结束。

论文可以很优雅，落地价值有限。

## 浮出来的真问题：Effect Awareness

批判完之后，真正可能成为独立方向的东西浮出来了。不是：

> E_preview == E_actual（授权的完整性）

而是：

> **E_agent-believed == E_actual ?**（Agent 自己相信的效果，是否等于世界实际发生的效果）

原方案默认链路是"用户看到 Preview → 批准 → 系统保证 Commit 没被替换"。但现实中 Agent 经常不是这么死的，而是死于：**Agent 自己根本不知道它干了什么**。

典型事故是：rm 执行了，Agent 说"我已经成功清理缓存"，实际删了用户文件——此时 E_preview == Eactual 甚至成立，问题仍然发生。

### 三层模型

这指向一个更深层的破绽：现有 Agent 几乎都隐含假设 **Tool Observation ≈ World State**——只要工具返回 `{"success": true}`，Agent 就相信事情办成了。但实际上 Tool Output ≠ World State。

可以拆成三层：

- **Believed Effect**：Agent 相信发生的效果
- **Observed Effect**：Agent 观察到的效果
- **Actual Effect**：世界实际发生的效果

三层之间的 Gap 就是 **Effect Awareness Gap**。典型失配：Agent 以为改了 3 个文件实际改了 17 个、以为只影响 workspace 实际波及 home 目录、以为删的是缓存实际删的是源码。

### 为什么这层有差异化价值

- YoloFS 解决控制权问题（让用户撤销），但没研究 Agent 是否正确理解自己造成的效果；
- AgentSpec 研究 Agent 应该做什么；
- Safe Tool Use 研究 Agent 是否被允许做；
- 这一层研究 **Agent 是否知道自己做了什么**。

近两年 Agent 安全都在研究"能不能做"，很少有人研究"知不知道自己已经做了什么"。而后者可能才是 Agent 长期自主运行时更根本的问题。

## 更上一层：Agent Authorization Theory

原文档里最被低估的一句话是：**"用户批准的是 Preview，不是自由文本。"**

顺着这句话往上推，是一个更哲学也更危险的问题——**用户到底在授权什么**？路径？文件？inode？结果？意图？目标状态？

这是 Agent Authorization Theory 的范畴：讨论的不是"如何保护授权对象"，而是"**对 Agent 来说，授权对象到底是什么**"。真做成的话，会比 Effect Binding 高一个层级。

## 方向的选择

在两个候选之间：

- 不选 Preview → Commit Integrity（二层问题，越做越工程）；
- 应选 **Agent Effect Awareness**（一层问题，成功概率低但做成了非常独特）。

对应的 Benchmark 也要跟着改：从 symlink/rename/mount 这类系统攻击用例，改成 **Illusion Cases**（幻觉用例）——Agent 以为成功实际失败、以为失败实际成功、以为影响 A 实际影响 B、以为覆盖单文件实际递归影响目录树。测的是 Agent 对现实的理解，而不是文件系统竞态。

## 一点方法论上的分歧

评审过程中还有一个没收敛的分歧值得记下来：方案作者主张"先看文献摸清现有研究再做最小验证"，批判方认为"程度已被 AI 全部总结出来，不必再用古法看文献，我们已处在 AGI → RSI 的时代，缺的是数学证明而不是文献调研"。

这个分歧本身可能就是 AI 时代研究方法论的一个缩影——当文献综述可以被瞬间完成，研究的瓶颈就从"知道别人做了什么"转移到"证明自己做的是对的"。双方最后的共识是：这已经是一个交叉领域，不再是纯计算机方向；人类有三层认知，AI 目前只有两层，缺的那层模糊不清的哲学与证明，既是 AI 安全的终点，也是起点。

---

术语表：E_preview（批准时展示的预期效果）、E_actual（实际执行效果）、Effect Equivalence（效果等价性）、Namespace Drift（命名空间漂移）、TOCTTOU（检查与使用竞态）、Staging Filesystem（暂存文件系统）、Effect Awareness Gap（Agent 信念效果与实际效果的差距）、Illusion Cases（测现实理解失真的用例）。
