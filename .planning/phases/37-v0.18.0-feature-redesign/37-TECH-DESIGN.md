# Phase 37 — 技术与 API 设计（不实施）

> 本文只定义未来实施方向，不改源码。所有接口命名需在实施前与现有 shared schema 对齐。

## 0. 评审后前置门禁

本技术设计必须与以下补充文档一起使用：

- `37-PROTOCOL-ADDENDUM.md`：Guide Beam capability、queue isolate、fallback、幂等。
- `37-SECURITY-ADDENDUM.md`：Provider namespace/SSRF/redaction、Export 隐私、Git 危险操作。
- `37-UX-ACCEPTANCE-MATRIX.md`：iOS PWA、A11y、动效、视口验收。
- `37-BRAND-CONTRACT.md`：canonical naming、五节点顺序、signature moment。

任何 Phase 38+ 实施不得绕过这些前置门禁。

## 1. 模型星桥 / Model Nexus

### 1.1 数据模型扩展

当前 Provider 只有配置字段。建议扩展为“配置 + 健康 + 能力 + 分配”。

```ts
type ProviderProtocol = 'anthropic' | 'openai' | 'gemini' | 'auto'

type ProviderHealthStatus = 'unknown' | 'checking' | 'online' | 'degraded' | 'offline' | 'blocked'

type ProviderCapability = {
    modelsEndpoint: boolean
    messagesEndpoint: boolean
    streaming: boolean | null
    tokenUsage: boolean | null
    contextWindow: number | null
    toolUse: boolean | null
    imageInput: boolean | null
}

type ProviderHealth = {
    status: ProviderHealthStatus
    latencyMs: number | null
    checkedAt: number | null
    errorCode: string | null
    errorMessage: string | null
    protocolDetected: ProviderProtocol | null
    capabilities: ProviderCapability
}
```

### 1.2 API 建议

| Method | Path | 用途 |
|---|---|---|
| `GET` | `/api/providers/overview` | Provider + assignments + health + model cache 一次返回，供控制舱首屏使用。 |
| `POST` | `/api/providers/:id/check` | 执行连通性、模型发现、usage smoke test。 |
| `POST` | `/api/providers/:id/discover-models` | 保留现有接口，但返回 protocol、latency、capabilities、warnings。 |
| `PATCH` | `/api/providers/assignments` | 批量更新 Agent 分配矩阵，减少多次 chip 操作。 |
| `POST` | `/api/providers/:id/rotate-key` | 更新 key 并自动触发 health check。 |
| `POST` | `/api/providers/:id/reveal-key-token` | 如确需 reveal，用一次性短 token + 二次确认，不建议保留普通 `GET api-key`。 |

### 1.3 安全设计

- `isValidBaseUrl` 应从“字符串判断”升级为“解析 + DNS 解析 + 重定向检查 + 内网网段拦截”。
- HTTP 允许但必须在 UI 标记为 yellow risk；默认推荐 HTTPS。
- 检测日志不写入 API key、Authorization、完整错误 body 中可能的 secret。
- Reveal API key 不作为主流程功能；默认只显示 `•••• last4` 或 `已保存`。
- Provider 删除前显示影响：哪些 Agent 默认模型会失效。

### 1.4 与上下文用量联动

Provider health check 应记录：

- 是否返回 `usage.input_tokens/output_tokens`。
- 是否返回 `context_window` 或可推断 context window。
- 是否支持 count tokens endpoint。
- 若不支持，Context Pulse popover 可链接到 Provider 诊断。

---

## 2. Git 脉络 / Git Atlas

### 2.1 结构化 Git Dashboard

当前页面多处解析 stdout。建议 Hub 侧提供结构化 dashboard：

```ts
type GitDashboard = {
    repo: {
        isRepo: boolean
        root: string | null
        branch: string | null
        head: string | null
        upstream: string | null
        ahead: number
        behind: number
        detached: boolean
        conflicted: boolean
    }
    changes: GitChangeGroup[]
    remotes: GitRemote[]
    recentCommits: GitCommitSummary[]
    recommendedAction: 'inspect' | 'commit' | 'pull' | 'push' | 'resolve-conflict' | 'clone' | 'none'
}
```

`GitChangeGroup` 第一版可按 status 分组，第二版再关联 agent turn。

### 2.2 API 建议

| Method | Path | 用途 |
|---|---|---|
| `GET` | `/api/sessions/:id/git-dashboard` | 一次返回 Hero、变更地图、远端、历史摘要。 |
| `GET` | `/api/sessions/:id/git-diff?path=...` | 返回结构化 diff 或文本 diff，支持 preview pane。 |
| `POST` | `/api/sessions/:id/git-commit-basket` | 提交所选文件与 message；可复用现有 commit handler。 |
| `POST` | `/api/sessions/:id/git-sync` | 统一 fetch/pull/push action，返回阶段结果。 |
| `GET` | `/api/sessions/:id/git-activity` | 后续关联 agent turn/change tracking。 |

### 2.3 前端状态机

```ts
type GitAtlasState =
    | { kind: 'loading' }
    | { kind: 'no-repo' }
    | { kind: 'ready'; dashboard: GitDashboard; basket: CommitBasket }
    | { kind: 'syncing'; dashboard: GitDashboard; operation: 'fetch' | 'pull' | 'push' }
    | { kind: 'conflict'; dashboard: GitDashboard }
    | { kind: 'error'; message: string }
```

### 2.4 质量重点

- 强推、删除分支、删除 remote 必须独立危险确认。
- 不应在前端用字符串拼 shell；所有命令参数走已有 schema/handler。
- 移动端 diff 需虚拟滚动或截断大 diff，避免 Safari 卡顿。
- Git command 失败应返回可读原因，而不是只显示 raw stderr。

---

## 3. 引导光标 / Guide Beam

### 3.1 请求协议

扩展 `SendMessageRequestSchema`：

```ts
type MessageDeliveryMode = 'queue' | 'guide'

SendMessageRequest = {
    text: string
    localId?: string
    attachments?: AttachmentMetadata[]
    scheduledAt?: number | null
    deliveryMode?: MessageDeliveryMode // default 'queue'
}
```

约束：

- `scheduledAt != null` 时只能 `queue`。
- `attachments` 第一版只能 `queue`，或 guide 前必须确认附件已上传并可被 agent 读取。
- 非 thinking 时 `guide` 自动等同普通发送，但保留 meta 供统计。

### 3.2 Message meta

持久化 content meta：

```ts
meta: {
    sentFrom: 'webapp'
    deliveryMode: 'queue' | 'guide'
    guide: {
        requestedAt: number
        interruptPolicy: 'preserve-queue'
    } | null
}
```

### 3.3 Hub → CLI 协议

不要把 guide 伪装成普通 `new-message` 后再让 CLI 猜测。建议新增或扩展 update body：

```ts
type NewMessageUpdate = {
    t: 'new-message'
    sid: string
    message: Message
    deliveryMode?: 'queue' | 'guide'
}
```

或新增：

```ts
type GuideMessageUpdate = {
    t: 'guide-message'
    sid: string
    message: Message
    policy: 'interrupt-current-preserve-queue'
}
```

推荐：**新增 `guide-message`**，避免老 CLI 把引导当普通排队。兼容策略：若 CLI 未 ack 支持 guide，Hub 降级为普通 `new-message` 并通知 Web。

### 3.4 CLI 处理原则

#### Claude

- 新增 `session.onGuideMessage` 或在 `onUserMessage` 中识别 deliveryMode。
- `ClaudeRemoteLauncher` 新增 `guide()`：
  1. 请求当前 turn abort。
  2. 不关闭 session，不清空普通 queue。
  3. abort settle 后 `queue.unshiftGuideIsolated(message)` 或 `unshift(..., isolate=true)`。
  4. guide 被 `collectBatch()` 消费后发 `messages-consumed`。
- 不复用 `/clear`、`/compact` 的 `pushIsolateAndClear`，因为 guide 不应清空待发送消息。

#### Codex

- 不能复用现有 `handleAbort()`，因为它会 `session.queue.reset()`。
- 新增 `handleGuideInterrupt()`：
  1. `interruptActiveTurns('guide')`。
  2. abort 当前 controller 或 wait loop，但不 reset queue。
  3. reset reasoning/diff processors 的当前 turn state。
  4. `session.queue.unshift(guideMessage, mode, localId)` 并确保下一轮优先处理。

#### 其它 Agent

- Gemini/Kimi/OpenCode/Cursor 先定义 capability：`supportsGuideInterrupt`。
- 不支持时 UI 仍显示引导但发送后降级为 queue，Popover 说明“该 Agent 暂不支持即时引导”。

### 3.5 Web 状态

新增 optimistic status：

```ts
type MessageStatus = 'sending' | 'queued' | 'guiding' | 'sent' | 'failed'
```

- `guiding` 在队列条中显示 `引导中`。
- Hub SSE 新增 guide ack/fallback event：
  - `guide-interrupt-started`
  - `guide-consumed`
  - `guide-fallback-queued`

### 3.6 失败模式

| 失败 | 行为 |
|---|---|
| CLI 不支持 guide | 降级 queue，Web toast：`该 Agent 暂不支持引导，已排队发送`。 |
| interrupt 超时 | 保留 message，降级 queue，不清空现有 queue。 |
| Agent 已结束 thinking | 直接普通发送，状态 sent。 |
| guide message 被取消 | 若未 consumed，从 queue 移除；若已 consumed，提示不可取消。 |
| Hub 重启 | message meta 持久化，未 invoked 的 guide 可重新发给 CLI，但必须避免重复 interrupt storm；用 localId 去重。 |

---

## 4. 上下文脉冲 / Context Pulse

### 4.1 前端计算

```ts
type ContextUsageView = {
    available: boolean
    usedPercent: number | null
    usedTokens: number | null
    maxTokens: number | null
    tone: 'success' | 'warning' | 'danger' | 'unknown'
    source: 'provider-usage' | 'codex-token-count' | 'fallback-window' | 'unknown'
    unavailableReason: string | null
}
```

计算规则：

1. 若有 `usage.context_tokens`，用它作为 used。
2. 否则用 `cache_creation + cache_read + input_tokens`，同时在 tooltip 标注“估算”。
3. context window 来源优先：`usage.context_window` > session/model metadata > provider capability > flavor fallback。
4. 没有 maxTokens 时，不显示百分比，显示 `上下文：--` 并给 reason。
5. 颜色按 usedPercent 阈值，不按 remaining。

### 4.2 后端/CLI 增强

- Claude converter 若没有 usage，不伪造 used；但可发送 `usageUnavailableReason`。
- Provider health 可提供 `defaultContextWindow`，例如用户可手动为 `glm-5.1` 配置 200K/1M。
- Session state 可缓存最近一次 parent usage，避免分页窗口导致 StatusBar 消失。
- Codex token_count 与 Claude usage 统一到 shared `UsageData`。

### 4.3 tsintergy 结论落地

实测 direct API 返回 usage，所以实施时应：

1. 在 Claude Code stream-json 日志中确认 `glm-5.1` assistant message 是否也包含 usage。
2. 若 stream-json 丢 usage，问题在 Claude Code/代理层，而不是 provider direct API。
3. 模型星桥 health check 应保存“direct API usage ✓”，Context Pulse popover 可提示“Provider 支持 usage，但当前会话尚未收到 agent usage”。

### 4.4 测试建议

- Normalizer 保留只有 `input_tokens` 无 `output_tokens` 的 usage 时是否可计算 context。
- 自定义模型无 `claude-` 前缀但有 provider contextWindow 时能显示百分比。
- `scope_role=child` 不污染父会话，但父会话无 usage 时要解释。
- 移动端输出完全为中文：`上下文：40%`。
- 阈值：59 green，60 yellow，80 yellow，81 red。

---

## 5. 会话织锦 / Session Loom

### 5.1 数据来源

- `store.messages`：完整 message history，包括 `content/meta/createdAt/invokedAt/scheduledAt`。
- `chat/normalizeAgent`：前端已有 block 结构可用于预览，但导出应以服务端原始消息为准。
- Session metadata：title、path、agent、model、created/updated。
- 可选：Git branch、worktree、provider、context usage 快照。

### 5.2 API 设计

| Method | Path | 用途 |
|---|---|---|
| `GET` | `/api/sessions/:id/conversation-outline` | 返回服务端结构化 outline，避免仅扫描已加载消息。 |
| `POST` | `/api/sessions/:id/exports/preview` | 返回过滤后的导出预览、统计、敏感信息提示。 |
| `POST` | `/api/sessions/:id/exports` | 生成 Markdown 文件，参数包含 range/filter/language/template。 |
| `GET` | `/api/sessions/:id/exports` | 列出已生成资产。 |
| `GET` | `/api/sessions/:id/exports/:exportId/download` | 下载 `.md`。 |
| `POST` | `/api/sessions/:id/synthesis` | 创建提炼任务，可选择模板和深度。 |
| `GET` | `/api/sessions/:id/synthesis/:jobId` | 查询任务状态和预览。 |

### 5.3 请求参数

```ts
type ConversationExportRequest = {
    language: 'zh-CN' | 'en'
    format: 'markdown'
    range: { type: 'all' } | { type: 'last'; count: number } | { type: 'time'; from: number; to: number }
    include: {
        userMessages: boolean
        assistantMessages: boolean
        toolSummaries: boolean
        clarificationQA: boolean
        contextStats: boolean
    }
    filters: {
        trivialReplies: boolean
        duplicateContinues: boolean
        systemNoise: boolean
        redactSecrets: boolean
    }
    template: 'raw' | 'design' | 'prd' | 'decisions' | 'retrospective' | 'drift-check'
}
```

### 5.4 降噪算法

- `trivialReplies` 只在不影响上下文时过滤。
- 若短答是 AI 上一条问题的回答，则保留并归入“需求澄清问答”。
- 连续 `继续` 只保留第一次，并在摘要中记录 `用户多次要求继续`。
- Tool result 不全文导出，默认转成摘要：工具名、目标文件、成功/失败、关键错误。
- Secret redaction 使用模式匹配 + 用户确认，不自动删除原始数据。

### 5.5 Synthesis 执行策略

两种模式：

1. **本地确定性摘要**：不调用模型，生成 raw export + 基础统计 + outline。
2. **Agent/LLM 深度提炼**：调用当前 session provider 或用户选择 provider，使用专门 prompt，输出设计方案。

必须让用户知道是否调用外部模型，因为会话内容可能包含敏感信息。

### 5.6 文件存储

- 初版可将生成文件保存在 Hub 数据目录：`~/.hapi-power/exports/{sessionId}/{exportId}.md`。
- DB 仅保存 metadata：exportId、sessionId、template、language、createdAt、filePath、size、checksum。
- 下载时设置安全文件名：`hapi-power-session-{title}-{YYYYMMDD-HHmm}.md`。

---

## 6. i18n、移动端、A11y 技术要求

### 6.1 i18n key 命名建议

- `settings.modelNexus.*`
- `gitAtlas.*`
- `composer.deliveryMode.queue`
- `composer.deliveryMode.guide`
- `contextPulse.*`
- `sessionLoom.*`

所有新增 key 必须同时写 `en.ts` 和 `zh-CN.ts`，并补 parity 测试。

### 6.2 移动端要求

- 所有 action button 最小 44px。
- Sheet 使用 safe-area inset bottom。
- iOS PWA standalone 下下载失败时提供 copy fallback。
- 长任务可离开 panel，完成后 toast 回到对应资产。
- Diff/Markdown 大内容需要虚拟滚动或分块渲染。

### 6.3 A11y

- Queue/Guide segmented control 使用 `role=tablist` 或 radio group。
- Context color 同时提供文字与 `aria-label`：`上下文已用 82%，高风险`。
- Git file rows 支持键盘打开、加入提交篮、预览。
- Provider health 不只用颜色，必须有 label。
