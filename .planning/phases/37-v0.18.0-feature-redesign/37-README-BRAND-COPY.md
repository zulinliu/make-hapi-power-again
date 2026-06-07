# Phase 37 — README 品牌文案草稿

> 本文件是后续实施阶段更新 README/README.zh-CN/PRODUCT/docs 的草稿，不直接改 README。

## 1. 中文 README 顶部定位草稿

```markdown
Hapi Power 是 AI 编码代理的移动控制舱：接入不同模型通道，看清 Agent 的 Git 改动，在工作中排队或引导纠偏，监控上下文清醒度，并把整段会话沉淀为可复用 Markdown 资产。
```

## 2. English README positioning draft

```markdown
Hapi Power is a mobile command deck for AI coding agents: connect model providers, inspect agent-driven Git changes, queue or guide running work, monitor context usage, and turn conversations into reusable Markdown project assets.
```

## 3. Features — 中文草稿

```markdown
**API 星桥（Model Nexus）** — 统一接入 Anthropic/OpenAI/Gemini/自定义兼容供应商，自动检测模型、延迟、usage 与上下文能力，并为每个 Agent 分配默认模型通道。

**Git 脉络（Git Atlas）** — 在会话中用一张 Git 地图查看分支、Agent 改动、Diff、提交篮和远端同步风险；从手机也能完成检查、提交和同步。

**引导光标（Guide Beam）** — Agent 正在工作时，继续输入默认排队；发现理解偏差时可切换“引导”，打断当前任务并立即发送纠偏，同时保留会话和队列。

**上下文脉冲（Context Pulse）** — 用 `上下文：40%` 这样的短标签显示上下文占用，低于 60% 绿色，60–80% 黄色，高于 80% 红色，帮助你及时 compact 或开启新会话。

**会话织锦（Session Loom）** — 将“大纲”升级为会话资产工作台，一键导出完整对话 Markdown，过滤噪音，生成设计方案、PRD、决策日志、偏差检查和经验卡。
```

## 4. Features — English draft

```markdown
**Model Nexus** — Connect Anthropic, OpenAI, Gemini, and custom-compatible providers. Detect models, latency, usage support, and context limits, then assign default model routes per agent.

**Git Atlas** — See branch state, agent changes, diffs, commit basket, and remote sync risk in one Git map. Review, commit, and sync from desktop or iOS PWA.

**Guide Beam** — While an agent is working, new messages queue by default. Switch to Guide to interrupt the current turn and send a correction immediately without losing the conversation or pending queue.

**Context Pulse** — Replace noisy token strings with a clear `Context: 40%` signal. Green below 60%, yellow from 60–80%, red above 80%, with diagnostics when usage is unavailable.

**Session Loom** — Turn the Outline panel into a conversation asset workbench. Export Markdown transcripts, filter noise, and synthesize design plans, PRDs, decision logs, drift checks, and reusable lessons.
```

## 5. 功能卡片短句

| 功能 | 中文短句 | English short line |
|---|---|---|
| API 星桥 | 把模型接成星图。 | Connect models into a trusted nexus. |
| Git 脉络 | 让每一次分支可看见。 | Map every branch and change. |
| 引导光标 | 偏航时，轻点纠正。 | Correct course while the agent is running. |
| 上下文脉冲 | 上下文清醒，代理更可靠。 | Keep context clear, keep agents reliable. |
| 会话织锦 | 把对话沉淀成资产。 | Weave conversations into reusable assets. |

## 6. README 结构建议

在现有 Features 之前增加“五节点能力环”：

```markdown
## The Hapi Power Loop

1. **Connect** — Model Nexus connects trusted model providers.
2. **Drive** — Guide Beam keeps you in control while agents work.
3. **Observe** — Context Pulse shows reliability risk at a glance.
4. **Trace** — Git Atlas maps every code change.
5. **Preserve** — Session Loom turns conversations into project memory.
```

中文：

```markdown
## Hapi Power 五节点工作流

1. **接入** — API 星桥连接可信模型通道。
2. **驾驶** — 引导光标让你在 Agent 工作中保持控制权。
3. **观测** — 上下文脉冲一眼提示可靠性风险。
4. **追踪** — Git 脉络映射每一次代码变化。
5. **沉淀** — 会话织锦把对话转化为项目记忆。
```

## 7. 截图计划

| 截图 | 重点 |
|---|---|
| `screenshot-model-nexus.png` | Provider 星图 + Agent 分配矩阵 + 健康检测。 |
| `screenshot-git-atlas.png` | Branch hero + 变更地图 + Diff preview。 |
| `screenshot-guide-beam.png` | Composer thinking 时 `排队/引导` 双模式。 |
| `screenshot-context-pulse.png` | `上下文：40/60/80%` 三状态。 |
| `screenshot-session-loom.png` | 大纲/导出/提炼/资产四 Tab + MD 下载。 |
