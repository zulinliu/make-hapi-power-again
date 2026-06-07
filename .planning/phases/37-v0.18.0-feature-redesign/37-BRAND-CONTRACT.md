# Phase 37 — 品牌契约与不可退化门禁

> 本文是 Phase 37 深度评审后的 docs-only 补充。目的：把五个特色功能的命名、传播顺序、i18n namespace、signature moment 固定下来，防止实施时退化为普通列表、普通 Tab、普通状态条或普通下载按钮。

## 1. Canonical Naming Contract

| Capability | 中文品牌名 | English brand | 功能描述名 | 禁止退回的叫法 |
|---|---|---|---|---|
| PROVIDER | **模型星桥** | **Model Nexus** | API 供应商 / 模型通道 / Provider | API Key 管理、供应商列表、模型列表 |
| GIT | **Git 脉络** | **Git Atlas** | Git 工具页 / Git 工作台 | Git Tab、status/history 页面、Git 命令页 |
| GUIDE | **引导光标** | **Guide Beam** | 排队 / 立即引导 | 强制中断按钮、interrupt 按钮、新手引导 |
| CTX | **上下文脉冲** | **Context Pulse** | 上下文用量 / context usage | ctx、token left、剩余 token |
| LOOM | **会话织锦** | **Session Loom** | 会话资产工作台 / 导出提炼 | 下载聊天记录、大纲面板、聊天导出按钮 |

### 1.1 命名规则

1. 对外传播、README、页面标题、空状态、release notes 使用品牌名。
2. 表单字段、API schema、技术文档可以使用描述名，但首次出现必须关联品牌名。
3. 中文默认使用品牌中文名；英文默认使用 English brand。
4. `API 供应商` 是功能类别，不再作为页面主标题。
5. `大纲` 只作为 Session Loom 内的第一个 Tab，不作为 Panel 主品牌。
6. Composer 控件使用 `排队 / 立即引导`，避免用户把“引导”理解为 onboarding。

## 2. 五节点工作流顺序

所有 README、PRODUCT、功能总览、发布说明应采用固定顺序：

```text
接入 → 驾驶 → 观测 → 追踪 → 沉淀
Model Nexus → Guide Beam → Context Pulse → Git Atlas → Session Loom
```

| 顺序 | 中文动词 | 英文动词 | 功能 | 用户价值 |
|---|---|---|---|---|
| 1 | 接入 | Connect | 模型星桥 / Model Nexus | 先接入可信模型通道。 |
| 2 | 驾驶 | Drive | 引导光标 / Guide Beam | Agent 工作中仍保留用户方向盘。 |
| 3 | 观测 | Observe | 上下文脉冲 / Context Pulse | 看见上下文风险与可靠性状态。 |
| 4 | 追踪 | Trace | Git 脉络 / Git Atlas | 看清代码变化与同步风险。 |
| 5 | 沉淀 | Preserve | 会话织锦 / Session Loom | 把对话变成项目资产。 |

## 3. Signature Moment 门禁

每个特色功能必须拥有一个可截图、可传播、可验收的品牌瞬间。缺少 signature moment 时，不允许进入发布验收。

| 功能 | Signature moment | 验收标准 |
|---|---|---|
| 模型星桥 | 新 Provider 检测成功后，节点点亮并显示 Agent 分配关系。 | 首屏不是表格；必须出现健康状态、能力摘要、Agent 分配关系和主 CTA。 |
| 引导光标 | Agent thinking 时，用户切到 `立即引导`，消息优先送达且普通队列不丢。 | 必须可见 `排队 / 立即引导`，且有 `引导中/已收到/已降级排队` 反馈。 |
| 上下文脉冲 | `上下文：--` 或高风险时，不只显示状态，还解释数据来源/不可用原因并跳转诊断。 | Popover 必须显示 source、used/max、reason、last update；颜色不能是唯一信号。 |
| Git 脉络 | 首屏 Hero 直接回答当前分支、Agent 改了什么、下一步最安全动作。 | 不能以 `status/history/branches/remotes` Tab 作为主体验；必须有 recommended action。 |
| 会话织锦 | 导出的 Markdown 不只是聊天记录，而包含决策、偏差、证据与可复用经验。 | 导出预览必须包含概要、原始记录、澄清问答、过滤规则、偏差/决策区。 |

## 4. i18n Namespace Contract

| 功能 | Namespace | 示例 key |
|---|---|---|
| 模型星桥 | `settings.modelNexus.*` | `settings.modelNexus.title`, `settings.modelNexus.health.online` |
| Git 脉络 | `gitAtlas.*` | `gitAtlas.hero.recommendedAction`, `gitAtlas.basket.title` |
| 引导光标 | `composer.deliveryMode.*` | `composer.deliveryMode.queue`, `composer.deliveryMode.guideNow` |
| 上下文脉冲 | `contextPulse.*` | `contextPulse.label`, `contextPulse.unavailable.reason` |
| 会话织锦 | `sessionLoom.*` | `sessionLoom.tabs.export`, `sessionLoom.downloadMarkdown` |

### 4.1 i18n 验收

- 新增 key 必须同时出现在 `en.ts` 与 `zh-CN.ts`。
- UI 文案禁止临时硬编码品牌名。
- 英文品牌名在中文界面中可作为副标题，但主标题使用中文品牌名。
- 组件 aria-label 不能直接复用短 label，应包含状态含义，例如：`上下文已用 82%，高风险`。

## 5. README / PRODUCT 落地规则

README 首屏不应只列功能，而应讲完整工程闭环：

```markdown
Hapi Power turns agent chats into a controllable engineering loop: connect trusted models, steer agents while they run, watch context risk, trace every code change, and preserve the session as project memory.
```

中文：

```markdown
Hapi Power 把 AI 编码对话变成可驾驶、可观测、可复盘的工程闭环：接入可信模型，工作中即时纠偏，观察上下文风险，追踪每次代码变化，并把会话沉淀为项目记忆。
```

## 6. 不可退化检查清单

- [ ] Model Nexus 首屏不是 Provider CRUD 表格。
- [ ] Guide Beam 不是 Stop/Abort 的换皮按钮。
- [ ] Context Pulse 不再出现 `ctx 200K, 100% left` 或剩余 token 主文案。
- [ ] Git Atlas 不是四个 Git 命令 Tab。
- [ ] Session Loom 不是“下载聊天记录”按钮。
- [ ] README 使用五节点顺序，不把五个品牌散落成普通 bullets。
- [ ] Release notes 不混用旧名、新名和内部实现名。
