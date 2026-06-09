# Phase 39 — 引导光标与上下文脉冲实施记录

> 日期：2026-06-08
> 分支：`feat/v0.18.0`
> 范围：Guide Beam / Context Pulse
> 适用基线：`37-PROTOCOL-ADDENDUM.md`、`37-SECURITY-ADDENDUM.md`、`37-UX-ACCEPTANCE-MATRIX.md`、`37-BRAND-CONTRACT.md`

## 1. 阶段目标

本阶段把会话输入和状态条从“普通排队 + ctx left”升级为两项 v0.18.0 品牌能力：

1. **引导光标 / Guide Beam**：在 Agent thinking 时提供 `排队 / 立即引导` 双模式。Guide 请求必须经过 CLI capability handshake；不支持时自动降级为普通 queue；支持时进入 CLI isolated guide queue，保留普通 queued messages，且只在 queue collect 后触发 `messages-consumed`。
2. **上下文脉冲 / Context Pulse**：StatusBar 统一显示 `上下文：40%` / `Context: 40%`，按已用比例 `<60 / 60-80 / >80` 显示风险，缺少 usage 或 context window 时显示 `上下文：--` 并提供诊断信息。

## 2. 实施计划

### 2.1 Shared / 协议

- 新增 `MessageDeliveryMode` schema：`queue | guide`，缺省 `queue`。
- 扩展 `SendMessageRequestSchema`：`scheduledAt + guide` 与 `attachments + guide` 由 schema 拒绝，避免绕过限制。
- 扩展 session capabilities：`guideInterrupt.supported / preservesQueue / isolatedDelivery / version`。
- 扩展 Socket update：新增 `guide-message`，只在 Hub capability gate 通过时发送。
- 扩展 SSE event：`guide-requested`、`guide-fallback-queued`、`guide-consumed`、`guide-failed`。

### 2.2 Hub

- `MessageService.sendMessage` 持久化 `content.meta.deliveryMode` 与 `content.meta.guide`。
- 如果请求 guide 但 session 不在 thinking，按普通 `new-message` 发送，同时保留 meta。
- 如果请求 guide 且 CLI capability 缺失或不完整，降级普通 queue，并向 Web 发 `guide-fallback-queued`。
- 如果 capability 通过，发送 `guide-message` update，并发 `guide-requested`。
- `messages-consumed` 收到 guide localId 后额外发 `guide-consumed`，不提前写 `invokedAt`。

### 2.3 CLI

- `ApiSessionClient` 支持 `guide-message`，旧 update 仍兼容。
- CLI metadata 声明 Guide capability，支持 `preservesQueue` 与 `isolatedDelivery`。
- `MessageQueue2` 新增 `pushGuide()`：队首插入、`isolate=true`、不清空普通 queue。
- Claude / Codex 对 `meta.deliveryMode === 'guide'` 的消息使用 `pushGuide()`；特殊命令仍走原有 isolate clear，不把 Guide 映射为 abort/reset。
- cancel 仍通过 `cancelByLocalId()` 删除未 collect 的 guide；collect 后由既有 Race-B 逻辑返回 invoked。

### 2.4 Web

- `useSendMessage`、`ApiClient.sendMessage`、runtime send path 传递 `deliveryMode`。
- 设置页新增 `跟进行为 / Follow-up Behavior`，默认 `排队 / Queue`，可切换 `引导 / Guide`；Composer 在 thinking 且无附件/无定时消息时按该持久设置决定 follow-up 发送模式，并提供轻量快捷切换。
- 发送 guide 时 optimistic message 标记为 queued，但 meta 包含 guide state，QueuedMessagesBar 显示 `引导中 / 已降级排队`。
- StatusBar 替换旧 `ctx used/max left` 文案为 Context Pulse，移动端不再显示 token-left。
- i18n 新增 `composer.deliveryMode.*` 与 `contextPulse.*`，en/zh-CN 对齐。

## 3. 测试计划

- Shared：`deliveryMode` 默认值、scheduled/attachments 拒绝。
- Hub：旧 CLI capability 缺失降级 queue；capability 通过时发送 `guide-message`；consumed 后才发 `guide-consumed`。
- CLI：`pushGuide()` 不清 queue、单独 collect、不与普通 queue batch、cancel before collect。
- Web：`useSendMessage` 传 deliveryMode；Context Pulse 阈值 59/60/80/81；无 usage 显示 unavailable。
- i18n parity：新增 key 同时存在于 en/zh-CN。

## 4. 自审门禁

- Guide 不调用 `pushIsolateAndClear()` 或 `reset()`。
- Guide 与普通 queued batch 隔离。
- 不支持 capability 时不 stuck，消息仍可被普通 queue 消费。
- `messages-consumed` 只由 CLI queue collect 后触发。
- Context Pulse 中文主文案为 `上下文：40%`。
- `59/60/80/81` 阈值测试覆盖。
- 新增用户可见文案全部 i18n。

## 5. 实施范围

本阶段已完成 Guide Beam 与 Context Pulse 的端到端链路：

- Shared 协议：新增 `MessageDeliveryMode`、Guide capability schema、`guide-message` Socket update、Guide SSE 事件、REST send message 校验。
- Hub：新增 Guide capability 当前连接握手 gate、permission pending gate、fallback/consumed guide meta 持久化、late fallback 防回滚、`deliveryMode` 入库与 SSE 分发。
- CLI：Codex 显式声明 Guide capability；`ApiSessionClient` 按 Socket update 类型区分 `guide-message` 与 `new-message`；`MessageQueue2` 支持 isolated guide queue 和保留队列的管理命令；Codex remote guide interrupt 等待旧 turn 终端事件后再消费。
- Web：设置页支持持久化 `跟进行为 / Follow-up Behavior`；Composer 依据该设置在 thinking 时选择 queue/guide，并保留快捷切换；发送链路传递 `deliveryMode`；QueuedMessagesBar 展示 Guide requested/fallback/consumed；StatusBar 渲染 `上下文：40%` / `Context: 40%` 与阈值状态。
- Context Pulse 安全：CLI app-server、legacy Codex event、Web normalize 三个 token usage 入口均只保留数值白名单、thread/turn scope 与 `last/total` 嵌套对象，剔除 prompt/header/path/token/apiKey 等字段。
- 安全扫描门禁：`providerSecurity.test.ts` 中用于脱敏测试的高置信 secret 前缀样例改为运行时拼接，避免源码静态残留真实前缀形态。

## 6. 修改文件

核心修改覆盖以下区域：

- `shared/src/apiTypes.ts`、`shared/src/schemas.ts`、`shared/src/socket.ts`、`shared/src/types.ts`
- `hub/src/sync/messageService.ts`、`hub/src/sync/syncEngine.ts`、`hub/src/store/messages.ts`、`hub/src/store/messageStore.ts`
- `hub/src/socket/handlers/cli/*`、`hub/src/socket/server.ts`、`hub/src/startHub.ts`、`hub/src/web/routes/messages.ts`
- `cli/src/api/apiSession.ts`、`cli/src/api/types.ts`、`cli/src/agent/sessionFactory.ts`
- `cli/src/codex/runCodex.ts`、`cli/src/codex/codexRemoteLauncher.ts`、`cli/src/codex/session.ts`
- `cli/src/utils/MessageQueue2.ts`、`cli/src/codex/utils/appServerEventConverter.ts`、`cli/src/codex/utils/codexEventConverter.ts`
- `web/src/api/client.ts`、`web/src/hooks/mutations/useSendMessage.ts`、`web/src/hooks/useSSE.ts`
- `web/src/lib/assistant-runtime.ts`、`web/src/lib/message-window-store.ts`、`web/src/lib/message-delivery.ts`
- `web/src/components/AssistantChat/*`、`web/src/components/SessionChat.tsx`
- `web/src/chat/normalizeAgent.ts`、`web/src/lib/locales/en.ts`、`web/src/lib/locales/zh-CN.ts`
- 对应测试文件：CLI、Hub、Shared、Web 的 queue、Guide、Context Pulse、i18n、schema 与脱敏测试。

说明：`.codegraph/codegraph.db` 仍为未纳入本阶段的无关 dirty 文件，不参与 stage 和 commit。

## 7. 测试结果

已通过：

- `bun run test:cli -- src/utils/MessageQueue2.test.ts src/codex/runCodex.test.ts src/codex/codexRemoteLauncher.test.ts src/agent/sessionFactory.test.ts src/codex/utils/appServerEventConverter.test.ts src/codex/utils/codexEventConverter.test.ts`
  - 6 files / 150 tests passed
- `bun run test:hub -- src/sync/messageService.test.ts src/socket/handlers/cli/sessionHandlers.test.ts`
  - 2 files / 48 tests passed
- `bun run test:hub -- src/services/providerSecurity.test.ts`
  - 1 file / 13 tests passed
- `bun run test:web -- src/lib/message-window-store.test.ts src/hooks/useSSE.test.ts src/components/AssistantChat/QueuedMessagesBar.test.tsx src/components/AssistantChat/StatusBar.test.tsx src/hooks/mutations/useSendMessage.test.tsx src/lib/locales/guide-context-i18n.test.ts src/chat/normalize.test.ts src/components/AssistantChat/HappyComposer.test.tsx`
  - 8 files / 88 tests passed
- `bun run test:shared -- src/apiTypes.test.ts src/schemas.test.ts`
  - 2 files / 8 tests passed
- `bun run typecheck`
  - CLI / Web / Hub typecheck passed
- `git diff --check`
  - passed；仅 Windows 换行提示
- `bun run check:git-standards`
  - passed
- `bun run check:sensitive-info`
  - passed

## 8. 自审结论

- Guide 不复用会清空 queue 的 abort/reset 路径；Codex `/goal`、`/clear`、`/compact` 使用 `pushIsolatePreservingQueue()`，保留 pending guide 与普通 queue。
- Guide 使用 isolated queue，`pushGuide()` 队首插入且单独 collect，不与普通 queued batch 合并。
- Hub 只在持久化 metadata 支持 Guide 且当前 Socket 成功声明 `guideInterrupt.supported/preservesQueue/isolatedDelivery` 时发送 `guide-message`；旧 CLI、未握手连接、非 thinking、permission pending 均降级 `new-message`。
- CLI 以 Socket update 类型决定 guide/queue，fallback `new-message` 即使 content meta 仍记录 Guide 状态，也会进入普通 queue。
- `messages-consumed` 的 Guide consumed 路径位于 CLI queue collect 后：先 `markMessagesInvoked`，再发 `messages-consumed`，再落库并广播 `guide-consumed`。
- `guide-fallback` 使用 `onlyUninvoked` 更新，late fallback 不覆盖已 consumed guide。
- Context Pulse 中文主文案满足 `上下文：40%`，阈值 59/60/80/81 已由 `StatusBar.test.tsx` 覆盖。
- 新增 Guide / Context Pulse 用户可见文案已做 en/zh-CN parity 测试。
- Thinking 状态文案已移除随机英文列表，改为 `status.thinking` i18n；状态栏右侧信息允许收缩和换行，降低移动端横向溢出风险。
- 失败 Guide 消息重试会保留原始 `deliveryMode: guide`，重试 optimistic 状态仍为 `guiding`，并由 `useSendMessage.test.tsx` 覆盖。
- Composer 的 per-send 分段控件已调整为设置页持久偏好：默认排队；选择引导后，thinking 中的新消息才走 Guide delivery；Guide 不可用时仍降级为 queue。

## 9. 附录门禁

- `37-PROTOCOL-ADDENDUM`：满足本阶段相关要求。Guide capability handshake、isolated queue、fallback queue、consumed 时序、localId 幂等与旧 CLI 降级均有实现和测试覆盖。
- `37-SECURITY-ADDENDUM`：满足本阶段相关要求。Guide 不绕过 permission pending；token usage 默认白名单化；敏感信息扫描通过；provider 脱敏测试不再静态保留高置信 secret 前缀。
- `37-UX-ACCEPTANCE-MATRIX`：满足本阶段可测试项。Composer 默认排队，thinking 且无附件/定时/权限请求时可选择立即引导；Context Pulse 显示比例、风险阈值与不可用状态；i18n parity 已覆盖。
- `37-BRAND-CONTRACT`：满足“驾驶 / 观测”节点命名与表达。用户侧文案使用“立即引导”“上下文：{percent}%”，避免第三方品牌残留。

## 10. 已知风险

- 本阶段以单元/组件/协议测试为主，未启动完整 dev server 做 Playwright 移动端截图验证。移动端视觉风险已通过组件结构、safe-area 约束和 reduced-motion 规则做静态自审，后续 Git Atlas / Session Loom 阶段仍需追加端到端视觉巡检。
- `messages-consumed` 仍保留既有取消 race、session-end sweep 等非 Guide synthetic 路径；本阶段保证 Guide consumed 事件只由 queue collect 后触发，不重构历史事件语义。
- token usage 白名单逻辑目前在 CLI 两个转换器与 Web normalizer 各自实现，避免跨包抽象扩大改动面；后续若继续扩展 Context Pulse 字段，应同步更新三处白名单测试。

## 11. 评审记录

当前阶段已按用户要求启动三路子代理复审，范围包括研发/测试、安全、UX/i18n。

- UX/i18n 复审：结论 `NEEDS_FIX`，无 blocker。提出三项 warning：StatusBar 随机英文 thinking 文案含第三方品牌风险、右侧状态组移动端溢出风险、Guide segmented control 键盘交互缺测试。已修复：删除随机英文数组，新增 `status.thinking` 中英 i18n；右侧状态组改为可收缩/换行/截断；新增 `HappyComposer.test.tsx` 覆盖 Guide radiogroup 键盘交互。
- 研发/测试复审：结论 `NEEDS_FIX`，无 blocker。提出一项 warning：失败 Guide 消息重试未保留原始 `deliveryMode`。已修复：`retryMessage()` 从原消息 meta 恢复 `deliveryMode`，Guide 重试保持 `guiding` 状态，并新增回归测试。
- 安全复审：结论 `PASS`。确认 token usage 白名单重建、Guide fallback/consumed meta 落库、capability handshake、providerSecurity 静态 secret 扫描均满足安全门禁。
- 修复后复验：CLI 150、Hub 48 + Provider 13、Web 88、Shared 8 均通过；`bun run typecheck`、`git diff --check`、`bun run check:git-standards`、`bun run check:sensitive-info` 均通过。

## 12. 下一阶段建议

- 进入 Phase 40 Git Atlas：优先服务端结构化 git-dashboard API、selected paths 真实生效验证、危险操作二次确认与移动端差异图适配。
- 在 Git Atlas 阶段补一次 Playwright 移动端 smoke，覆盖 Composer + StatusBar + queued bar 的 safe-area、键盘与 reduced-motion。

## 13. 2026-06-09 跟进行为体验修正

### 实施范围

- 将 Guide Beam 的发送方式从 Composer 内一次性 `排队 / 立即引导` 分段控件，调整为设置页中的持久 `跟进行为`。
- 默认值保持 `排队`，可切换为 `引导`。Composer 在 thinking 且 Guide 可用时按该偏好决定 `deliveryMode`；Guide 不可用、存在附件、定时消息或权限请求时仍强制 queue。
- Composer 保留轻量快捷切换按钮，但它写入同一个持久偏好，不再形成临时 per-send 状态。

### 修改文件

- `web/src/hooks/useFollowUpBehavior.ts`
- `web/src/hooks/useFollowUpBehavior.test.ts`
- `web/src/routes/settings/index.tsx`
- `web/src/routes/settings/index.test.tsx`
- `web/src/components/AssistantChat/HappyComposer.tsx`
- `web/src/components/AssistantChat/HappyComposer.test.tsx`
- `web/src/lib/locales/en.ts`
- `web/src/lib/locales/zh-CN.ts`
- `web/src/lib/locales/guide-context-i18n.test.ts`
- `.planning/phases/37-v0.18.0-feature-redesign/39-GUIDE-BEAM-CONTEXT-PULSE-IMPLEMENTATION.md`

### 测试结果

- `cd web; bun run test -- src/hooks/useFollowUpBehavior.test.ts src/components/AssistantChat/HappyComposer.test.tsx src/routes/settings/index.test.tsx src/lib/locales/guide-context-i18n.test.ts`
  - 4 files / 24 tests passed
- 移动端真实化验收：使用 390×844 视口访问 `http://127.0.0.1:5176/settings?acceptance=follow-up-behavior-mobile`。
  - 默认显示 `Follow-up Behavior Queue`。
  - 下拉展开后可见 `Queue` / `Guide` 两个选项，选项未被裁剪。
  - 选择 `Guide` 后刷新仍显示 `Follow-up Behavior Guide`。
  - 切回 `Queue` 后刷新仍显示 `Follow-up Behavior Queue`。

### 自审结论

- 满足 `37-PROTOCOL-ADDENDUM`：本次只调整 Web 侧发送偏好入口，不改 Hub/CLI Guide protocol；capability handshake、isolated queue、fallback queue、`messages-consumed` 时序均保持原实现。
- 满足 `37-SECURITY-ADDENDUM`：未新增外部请求、敏感信息落盘或 redaction 变更；localStorage 仅保存枚举值 `queue | guide`。
- 满足 `37-UX-ACCEPTANCE-MATRIX`：默认排队；用户可在设置页明确选择“引导”；Composer 中途发送时行为与设置一致。
- 满足 `37-BRAND-CONTRACT`：中文主入口使用“跟进行为”，保留五节点中“驾驶”语义，新增文案 en/zh-CN parity 覆盖。

### 已知风险

- 本次移动端验收覆盖设置项下拉、持久化和刷新回归；未重新覆盖真实 iOS Safari 键盘弹出场景，后续完整 PWA 回归仍需单独跑键盘与 safe-area 检查。

## 14. 2026-06-09 引导中断竞态与会话页精简修正

### 实施范围

- 深度复查 Guide Beam 从 Web `deliveryMode=guide`、Hub capability gate、CLI isolated guide queue 到 Codex app-server interrupt 的完整链路。
- 修复 CLI 中断目标竞态：当 session 已进入 thinking、但 `turn/started` 或 `startTurn()` 返回的 `turnId` 尚未建立时，Guide 不再立即降级为普通 queue，而是在短窗口内等待可中断目标出现。
- 保留安全降级：等待窗口结束仍没有 parent/child turn target 时，继续 `downgradePendingGuides()` 并上报 `interrupt-failed`，避免 Guide stuck。
- 精简会话页 Composer：移除 thinking 状态下额外显示的 `跟进行为：排队/引导` 与快捷切换按钮；会话页仍读取设置页持久偏好决定发送 `queue | guide`，但不再占用 StatusBar 与输入框之间的纵向空间。

### 修改文件

- `cli/src/codex/codexRemoteLauncher.ts`
- `cli/src/codex/codexRemoteLauncher.test.ts`
- `web/src/components/AssistantChat/HappyComposer.tsx`
- `web/src/components/AssistantChat/HappyComposer.test.tsx`
- `.planning/phases/37-v0.18.0-feature-redesign/39-GUIDE-BEAM-CONTEXT-PULSE-IMPLEMENTATION.md`

### 测试结果

- `bun run --cwd cli test -- src/codex/codexRemoteLauncher.test.ts`
  - 1 file / 59 tests passed
- `bun run --cwd web test -- src/components/AssistantChat/HappyComposer.test.tsx`
  - 1 file / 2 tests passed
- `bun run typecheck:cli`
  - passed
- `bun run typecheck:web`
  - passed

### 自审结论

- 当前需求“引导模式应直接打断插入新对话”在 Web/Hub 协议层已存在实现，真实失败点更可能是 CLI turn target 建立前过早 fallback。本次已用回归测试覆盖 `turnId` 延迟出现时 Guide 等待并成功 interrupt 的路径。
- Guide 仍不调用 `handleAbort()`、`queue.reset()` 或 `pushIsolateAndClear()`，不会清空普通 queued messages。
- Guide 仍使用 `pushGuide()` 的 isolated queue；降级时只把 pending guide 转为普通 queue，并保持普通 queue 顺序。
- `messages-consumed` 时序未改动，仍由 CLI queue collect 后触发。
- 会话页不再渲染“跟进行为”内容，设置入口保留在设置页，减少移动端纵向挤压并避免遮挡 Context Pulse 信息。

### 附录门禁

- `37-PROTOCOL-ADDENDUM`：满足。Guide capability handshake、isolated delivery、fallback queue、queue collect 后 consumed 的协议边界保持不变，并补齐 interrupt target 竞态覆盖。
- `37-SECURITY-ADDENDUM`：满足。本次没有放宽 Guide capability gate、permission pending gate 或任何队列清空路径；没有新增外部请求、敏感信息落盘或 redaction 改动。
- `37-UX-ACCEPTANCE-MATRIX`：满足。设置页持久 `跟进行为` 仍决定中途发送模式；会话页去除重复控件后，StatusBar 与 Context Pulse 可用空间更稳定。
- `37-BRAND-CONTRACT`：满足。保留“引导 / Guide”驾驶节点语义，会话页避免重复展示说明性文案，用户侧表达更克制。

### 已知风险

- 本次验证覆盖单元/组件层和 TypeScript 类型检查；尚未重新启动完整 Hub + Web + CLI 做真实 app-server interrupt 端到端录屏验收。
- 等待窗口为 750ms，目的是覆盖 `thinking=true` 与 `turnId` 建立之间的短竞态；若未来 Codex app-server 在极慢环境下延迟更大，仍会安全降级为 queue，但不会卡死。

### 下一阶段建议

- 在下一轮移动端真实化验收中，使用设置页切到“引导”，进入真实 Codex 会话，在 thinking 期间发送一条纠偏消息，观察是否触发 interrupt 并优先消费 Guide。
- 同时复查 QueuedMessagesBar 的 Guide 状态提示是否在窄屏下保持单行截断或自然换行，避免与 Context Pulse 争夺空间。

## 15. 2026-06-09 引导发送真实能力收敛

### 实施范围

- 修复 Web Composer 只依据 `跟进行为=引导` 就发送 `deliveryMode=guide` 的问题。
- 新增 Web 侧 Guide capability 判断，只有当前会话 metadata 同时声明 `supported`、`preservesQueue`、`isolatedDelivery` 时，Composer 才显示“Send guide now”并写入 `deliveryModeRef=guide`。
- 未声明真实 Guide interrupt 能力的 Claude/OpenCode/Gemini/Cursor/Kimi、旧 CLI 或重连未确认会话，即使用户偏好为“引导”，会话页也按 queue 发送，避免 UI 承诺无法兑现的中断行为。
- 保持设置页“跟进行为”作为持久偏好入口，会话页不重新显示该设置项，减少移动端纵向挤压。

### 修改文件

- `web/src/types/api.ts`
- `web/src/lib/session-capabilities.ts`
- `web/src/lib/session-capabilities.test.ts`
- `web/src/components/SessionChat.tsx`
- `web/src/components/AssistantChat/HappyComposer.tsx`
- `web/src/components/AssistantChat/HappyComposer.test.tsx`
- `.planning/phases/37-v0.18.0-feature-redesign/39-GUIDE-BEAM-CONTEXT-PULSE-IMPLEMENTATION.md`

### 测试结果

- `bun run --cwd web test -- src/components/AssistantChat/HappyComposer.test.tsx src/lib/session-capabilities.test.ts`
  - 2 files / 5 tests passed
- `bun run typecheck:web`
  - passed

### 自审结论

- 满足用户反馈的核心预期：会话页不再误导不支持真实中断的会话进入 Guide；支持真实能力的 Codex 会话仍可在 thinking 期间按偏好发送 Guide。
- 本次没有改动 Hub/CLI 队列协议，不触碰 abort/reset，不影响既有 `pushGuide()` isolated queue 与 `messages-consumed` 时序。
- 会话页仍不展示“跟进行为”文字或控件，Context Pulse 和输入框区域不会被该设置挤占。

### 附录门禁

- `37-PROTOCOL-ADDENDUM`：满足。Web 侧现在与 Hub 的 capability handshake 门禁一致，旧 CLI 和未声明能力会话降级 queue，不会 stuck。
- `37-SECURITY-ADDENDUM`：满足。未新增外部请求、敏感信息落盘或权限绕过；Guide 仍受 permission pending、附件、定时发送等 gate 限制。
- `37-UX-ACCEPTANCE-MATRIX`：满足。非真实可用时不显示 Guide 发送态；真实可用时只通过发送按钮状态表达，不额外占用会话页空间。
- `37-BRAND-CONTRACT`：满足。保留“引导 / Guide”驾驶语义，同时避免对不支持能力的会话作过度承诺。

### 已知风险

- 本次验证为组件测试和类型检查，尚未启动完整 Hub + CLI 做真实 Codex Guide interrupt 端到端验收。
- Context Pulse 的已用量为 0、详情弹层无法收回、定时发送弹层遮挡输入框等新问题未纳入本次提交，按用户要求留到下一步处理。

### 下一阶段建议

- 进入 Context Pulse 专项修复前，先复查 usage 数据从 CLI/Hub 到 Web normalizer 的来源链路，再处理详情 popover 和 ScheduleTimePicker 移动端遮挡问题。

## 16. 2026-06-09 Context Pulse 用量与移动端弹层修正

### 实施范围

- 修复 OpenAI 兼容供应商 usage 字段无法进入 Context Pulse 的问题：`prompt_tokens / promptTokens` 映射为输入 token，`completion_tokens / completionTokens` 映射为输出 token，`prompt_tokens_details.cached_tokens` 等明确缓存字段映射为 cache read。
- 同步 CLI app-server、legacy Codex event、ACP prompt response 与 Web normalizer 四条 usage 链路，避免 tsintergy / OpenCode / Codex 不同入口出现“已用一直为 0”的分叉。
- 保持 usage 白名单脱敏策略，只允许明确 token 数值字段、scope 字段与 usage 嵌套对象通过，继续剔除 prompt、header、path、apiKey 等敏感内容。
- 将 Context Pulse 详情从原生 `<details>` 改为受控弹层，支持显式关闭按钮、Escape 关闭、外部点击关闭，并在关闭后恢复焦点。
- 修正移动端“定时发送”弹层定位：移除贴底 bottom sheet 逻辑，统一基于时钟按钮和 visualViewport 定位，优先在输入框上方展开，避免遮挡 composer。

### 修改文件

- `cli/src/agent/backends/acp/AcpSdkBackend.ts`
- `cli/src/agent/backends/acp/AcpSdkBackend.test.ts`
- `cli/src/codex/utils/appServerEventConverter.ts`
- `cli/src/codex/utils/appServerEventConverter.test.ts`
- `cli/src/codex/utils/codexEventConverter.ts`
- `cli/src/codex/utils/codexEventConverter.test.ts`
- `web/src/chat/normalizeAgent.ts`
- `web/src/chat/normalize.test.ts`
- `web/src/components/AssistantChat/StatusBar.tsx`
- `web/src/components/AssistantChat/StatusBar.test.tsx`
- `web/src/components/AssistantChat/ScheduleTimePicker.tsx`
- `web/src/components/AssistantChat/ScheduleTimePicker.test.ts`
- `web/src/components/AssistantChat/ScheduleTimePicker.test.tsx`
- `.planning/phases/37-v0.18.0-feature-redesign/39-GUIDE-BEAM-CONTEXT-PULSE-IMPLEMENTATION.md`

### 测试结果

- `bun run --cwd web test -- src/chat/normalize.test.ts src/components/AssistantChat/StatusBar.test.tsx src/components/AssistantChat/ScheduleTimePicker.test.ts src/components/AssistantChat/ScheduleTimePicker.test.tsx`
  - 4 files / 63 tests passed
- `bun run --cwd cli test -- src/codex/utils/appServerEventConverter.test.ts src/codex/utils/codexEventConverter.test.ts src/agent/backends/acp/AcpSdkBackend.test.ts`
  - 3 files / 57 tests passed
- `bun run typecheck:web`
  - passed
- `bun run typecheck:cli`
  - passed
- `git diff --check`
  - passed；仅 Windows 换行提示

### 自审结论

- Context Pulse 现可处理 OpenAI 兼容 usage schema，内网与公网 API 供应商在 usage 字段语义上不再被区别对待。
- Context Pulse 仍依赖供应商或 Agent 实际返回 usage；如果上游完全不返回 token usage，UI 会继续显示 `上下文：--` 与等待用量原因。
- usage 处理没有放宽为任意字段透传，安全白名单仍覆盖 token/path/header/apiKey 等常见敏感项剔除。
- 详情弹层新增关闭按钮、Escape 与外部点击关闭，解决移动端展开后难以收回的问题。
- 定时发送弹层不再固定在屏幕底部，避免覆盖主输入框；定位函数已有窄屏锚点回归测试。

### 附录门禁

- `37-PROTOCOL-ADDENDUM`：满足。本次不改 Guide protocol、queue collect 或 `messages-consumed` 时序；仅修复 usage 归一化和 UI 弹层。
- `37-SECURITY-ADDENDUM`：满足。usage 仍按白名单重建，未新增外部请求、敏感信息落盘或 provider SSRF 策略变更。
- `37-UX-ACCEPTANCE-MATRIX`：满足。Context Pulse 继续使用 `上下文：{percent}%`，详情可关闭，定时发送移动端不再遮挡输入框。
- `37-BRAND-CONTRACT`：满足。保留“观测：上下文脉冲”表达，未新增第三方品牌残留。

### 已知风险

- 本次尚未用真实 tsintergy `glm-5.1` 发起完整一轮对话验证，因为需要用户本地供应商配置和真实会话运行环境；已通过四条数据入口的回归测试覆盖字段兼容性。
- 如果上游只返回累计 total usage 而不返回当前 turn usage，Context Pulse 会按现有策略优先 last、再 fallback total；这是既有语义，本次未扩大为复杂聚合。

### 下一阶段建议

- 在真实移动端验收时，用 tsintergy `glm-5.1` 发一轮短对话，确认消息 metadata 中出现 usage 后 StatusBar 从 `上下文：--` 更新为百分比。
- 同时验证 Context Pulse 详情关闭、定时发送弹层位置、iOS 键盘弹出后 visualViewport 重新定位。
