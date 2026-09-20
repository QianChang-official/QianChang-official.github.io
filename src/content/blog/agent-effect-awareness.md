---
title: 这个方案到底有没有必要存在：一次 Agent 安全方案的组会拷打
link: agent-effect-awareness
date: 2026-09-19 23:20:00
tags:
  - AI Agent
  - 安全
  - 研究方法论
categories:
  - 技术
---

朋友拿来一个 Agent 安全的研究方案让我看。命题很工整：用户批准 Preview 之后，保证 Commit 阶段执行的效果和批准时的承诺一致，即 **E_preview == E_actual**。

我看了两天，每天一小时。看完最大的感受不是"这个方案有什么问题"，而是另一个级别的追问——**这个方案到底有没有必要存在**。这篇是我按"顶会审稿人 + 导师组会拷打模式"给的完整批判，以及批判完之后我自己觉得真正值得做的方向。

## 原方案：授权的完整性

方案叫 Effect Bind，目标是 Intent-Preserving Agent Execution。核心链路：

```plain
Preview → 用户批准 → Commit → 对象被换了（namespace/object drift）
```

工程组件是 Effect Witness、Capability 令牌、Commit Validation、fd-relative 执行（openat/openat2），形式化谓词 ObjectMatch / NamespaceMatch / StateMatch，要证明 Safety Theorem：未授权效果不可达。

工程可行性是高的。但工程可行不等于值得研究。

## 七层批判

### 一、你可能在解决一个被新架构消灭的问题

这是我最不舒服的地方。YoloFS（SOSP'26）的核心不是"如何让 Commit 正确"，而是"为什么要在真实文件系统 Commit"——所有修改先放进 staging filesystem，用户看到最终结果再决定合并。

两种范式的分歧是根本性的：

- 这个方案：批准承诺 → 验证执行；
- YoloFS：看到执行结果 → 再批准。

如果"先 stage 一切"成为主流，研究对象本身就被削弱了。审稿人必问 **Why not stage everything?**，整篇论文都得回答这个问题。

### 二、研究问题可能不重要

安全领域有个残酷规律：存在攻击 ≠ 值得发论文。namespace drift 确实存在（TOCTTOU 几十年前就有），但文档里没有证据回答：问题规模多大？真实世界多少事故？多少 Agent 因此出问题？

反过来 YoloFS 直接拿 290 个真实事故开局——删库、覆盖文件、泄漏凭据，全是用户天天骂街的问题。而 namespace drift 是"高级攻击面"，不是主流痛点。这很危险。

### 三、和现代 Agent 安全研究错位

近两年 Agent 安全的主线是 Capability / Information Flow / Runtime Enforcement / Policy Verification，共同关心的是 **Agent 为什么能做某事**。AgentSpec 管哪些工具允许被调用，Safe Tool Use 管能力传播与信息流风险。

而这个方案管的是：Agent 被允许做之后，文件对象有没有变。问题突然小了一层，格局也跟着小了。

### 四、形式化程度其实很弱

ObjectMatch / NamespaceMatch / StateMatch 还是系统设计文档语言，不是安全论文语言。真正难的问题是**什么叫 Effect 相同**：

- Preview 删 a.txt、Commit 删 a.txt，但 inode 变了，算不算同一 Effect？
- Preview 改 config.json、内容变化一样但对象不是同一个，算不算？
- Preview rename a→b、最终目录状态一致但过程经过其他对象，算不算？

方案只定义了 Effect Witness，没定义 **Effect Equivalence**。这是两个层次。

### 五、创新点太容易被拆解

effect model 是操作语义、capability 是 token、commit validation 是运行时校验、fd-relative 是 openat/openat2——全是老东西。审稿人最容易说的就是 *Nice composition*，翻译过来是"拼得不错"，而不是"这是新东西"。很多系统论文死在这里：每个组件都对，组合也合理，但没人觉得创新。

### 六、Benchmark 价值被高估

Benchmark 活下来的前提是"别人以后也想测"。EffectBind-Bench 那 18 个 case 大概率是 filesystem authorization corner cases，不是 agent benchmark workloads。AgentDojo 活下来因为 prompt injection 谁都关心，YoloFS 活下来因为误删文件谁都关心。五年后别人还在测 namespace drift 吗？我不敢答"会"。

### 七、方案有一种安全洁癖

这是很多博士论文的通病。研究者眼里 E_preview ≠ E_actual 非常不能忍，于是设计 Witness / Capability / Validation / Evidence / Replay 一整套体系。但产业界的回答是：给我个 snapshot / undo / git commit / sandbox，问题结束。于是论文很优雅，落地价值有限。

## 真正的方向：Agent 知不知道自己干了什么

批判完，我说一下如果真要从这篇里挑一个"成功概率最低、但做成了非常独特"的种子，我选哪个。

不是 E_preview == E_actual，而是：

> **E_agent-believed == E_actual ?**

这个方案默认的链路是"用户看到 Preview → 批准 → 系统保证 Commit 没被替换"。但现实中 Agent 经常不是这么死的，而是死于 **Agent 自己根本不知道它干了什么**。

YoloFS 收集的很多事故其实接近这个：rm 执行了，Agent 说"我已经成功清理缓存"，实际删了用户文件。这时候 E_preview == E_actual 甚至成立，问题仍然发生。

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

## 更上一层：用户到底在授权什么

原文档里最被低估的一句话是"用户批准的是 Preview，不是自由文本"。顺着往上推是一个更哲学也更危险的问题——**用户到底在授权什么**？路径？文件？inode？结果？意图？目标状态？

这是 Agent Authorization Theory 的范畴：讨论的不是"如何保护授权对象"，而是"**对 Agent 来说，授权对象到底是什么**"。真有人做出来，会比 Effect Binding 高一个层级。

## 我的选择

两个候选之间，我不会选 Preview → Commit Integrity（二层问题，越做越工程），我会选 **Agent Effect Awareness**（一层问题，成功概率低但做成了非常独特）。

Benchmark 也得跟着改：从 symlink/rename/mount 这类系统攻击用例，改成 **Illusion Cases**——以为成功实际失败、以为失败实际成功、以为影响 A 实际影响 B、以为覆盖单文件实际递归影响目录树。测的是 Agent 对现实的理解，而不是文件系统竞态。

## 关于研究方法的一点分歧

我和方案作者在方法上有个没收敛的分歧：他主张先看文献摸清现有研究再做最小验证；我的看法是，文献综述这件事 AI 已经能全部做完了，不必再用古法读文献——我们已处在 AGI → RSI 的时代，这个方案真正缺的不是文献调研，是**数学证明**。每一个工程判断都需要数学支撑。

后来聊着聊着就跑到了哲学上。"你知道'知道'这个词吗？究竟什么是知道，你如何知道，是否可信、是否成立"——这是哲学，就是 AI 缺的那部分。人类有三层认知，AI 现有的只有两层，差的就是这层模糊不清的哲学与证明。它既是 AI 安全的终点，也是起点。

所以我说这已经不是纯计算机方向了，是交叉领域。他也认。

---

术语表：E_preview（批准时展示的预期效果）、E_actual（实际执行效果）、Effect Equivalence（效果等价性）、Namespace Drift（命名空间漂移）、TOCTTOU（检查与使用竞态）、Staging Filesystem（暂存文件系统）、Effect Awareness Gap（Agent 信念效果与实际效果的差距）、Illusion Cases（测现实理解失真的用例）。
