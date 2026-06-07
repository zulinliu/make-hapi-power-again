# Phase 37 — v0.18.0 五大特色功能重塑：检索上下文与诊断记录

> 日期：2026-06-08
> 类型：设计阶段，仅沉淀方案，不实施代码
> 技能约束：使用 `$impeccable` 的产品界面审美原则 + GSD 既有项目规划方式；项目已存在 `.planning/`，因此不重建项目文档。
> 总目标：不是在原有功能上打补丁，而是把五个需求作为 Hapi Power 的新一代特色功能体系重做品牌、体验、交互、动效和 API 设计。

## 1. 本阶段硬约束

1. **仅设计，不实施**：不改动 `web/`、`hub/`、`cli/`、`shared/` 源码。
2. **全面检索后设计**：先读取现有实现与约束，再提出全新功能形态。
3. **前端效果优先**：所有 API/后端设计服务于明确的 UI、交互、动效和移动端体验。
4. **不影响核心会话**：尤其是“引导模式”必须在失败时安全降级，不破坏排队、发送、取消、权限、附件、定时消息等现有路径。
5. **iOS PWA 优先**：移动端不是桌面缩小版，必须有明确触控目标、底部动作区、安全区、减少动画策略。
6. **中英双语**：功能命名、页面标题、状态文案、下载产物模板都纳入统一 i18n。
7. **品牌化**：每个功能都有名称、文化、Logo 概念、Slogan、README 传播话术。
8. **Git 管理**：仅提交设计文档，避免混入当前工作区已有代码改动。

## 2. 仓库现状与风险

| 项 | 现状 |
|---|---|
| 当前分支 | `feat/v0.17.3` |
| 最新本地规划体系 | `.planning/phases/35-v0.17-file-manager-production/` 与 `.planning/phases/36-v0.17.1-optimization/` |
| 工作区状态 | 存在大量既有代码修改与未跟踪测试文件，主要集中在 GitPortal、RPC、FileManager 等；本阶段不得覆盖或提交这些改动。 |
| 品牌约束 | `PRODUCT.md` 定义“有力、精确、温暖”，Electric Orange / Power Geometry；README 当前仅用普通功能名描述 Provider、Git、Context。 |
| UI 约束 | `web/src/styles/tokens.css` 已有 `--hp-primary`、语义 success/warning/danger、半径、动效时长；应复用而非另起设计语言。 |

## 3. 五大功能代码检索结论

### 3.1 设置页 API 供应商

| 层级 | 文件 | 发现 |
|---|---|---|
| Shared Schema | `shared/src/providers.ts` | 供应商模型包含 `id/name/baseUrl/apiKeyEncrypted/notes/assignments`，缺少协议类型、健康状态、能力、用量支持、延迟、默认模型、最后检测结果等 UX 所需结构。 |
| Hub Routes | `hub/src/web/routes/providers.ts` | CRUD、分配、模型发现、按 flavor 获取模型、读取明文 API Key。`isValidBaseUrl` 阻止 localhost/private IP 字面量，但未做 DNS 解析后的内网拦截、HTTPS 风险分级、协议能力检测。 |
| Discovery | `hub/src/services/modelDiscovery.ts` | 通过 `/v1/models` 多路径候选发现；Google 用 query key，其它用 Bearer/x-api-key。缺少可视化诊断链路和模型能力分类。 |
| Store | `hub/src/store/providerStore.ts` | `providers` 与 `provider_assignments` 足够支撑基础管理，但不保存 health/capability/model cache 元数据。 |
| Session/Machine | `hub/src/web/routes/sessions.ts`, `hub/src/web/routes/machines.ts` | `providerId` 会解密并传入 `providerBaseUrl/providerApiKey`。 |
| Claude CLI | `cli/src/claude/runClaude.ts` | 将 provider 设置写入 `ANTHROPIC_BASE_URL`、`ANTHROPIC_API_KEY` 等环境；与 Claude Code 兼容。 |
| Web | `web/src/components/ProviderSettings.tsx` | 当前是设置页中的折叠列表 + 表单 + chip 分配，功能可用但没有“供应商控制舱”概念；模型发现结果只显示数量，不支持诊断与信任感。 |

**核心问题**：数据模型和 UI 都围绕“配置表单”而非“模型供给网络”。用户真正关心的是：哪条通道在线、给哪个 agent 用、有哪些模型、是否支持 usage/context、是否安全、失败时怎么修。

### 3.2 会话右上角 Git 工具页

| 层级 | 文件 | 发现 |
|---|---|---|
| 入口 | `web/src/components/SessionHeader.tsx` | 桌面端直接显示 Git 图标，移动端收进更多菜单；入口存在但品牌与状态提示弱。 |
| 页面 | `web/src/routes/sessions/git.tsx` | `status/history/branches/remotes` 四 Tab + toolbar。可操作，但是工具集合，不是 Git 工作流。 |
| 状态 | `web/src/components/git/GitStatusPanel.tsx` | 前端解析 `git status --porcelain=v2`；文件行有预览、复制路径、打开，但没有 staged/unstaged 清晰分区、提交篮、冲突态、同步态总览。 |
| 历史/分支/远程 | `web/src/components/git/*` | 表单和列表较直接，缺少 Git 图谱、同步引导、危险动作保护和移动端优先操作。 |
| API | `web/src/api/client.ts`, `hub/src/web/routes/git.ts` | 已有 status/diff/log/branch/commit/clone/push/pull/fetch/remotes 等能力；但返回多数仍是 command response，结构化不足。 |
| 既有脏改动 | `web/src/components/GitPortal/*` 等 | 当前工作区另有 Git Portal 相关改动；本阶段只设计，不碰代码。 |

**核心问题**：现有页面按 Git 命令分类，用户在 AI 会话中需要的是“我现在能不能安全提交/同步/回看 agent 改了什么”。应重构为 Git 决策舱。

### 3.3 会话中的“排队 / 引导”双模式

| 层级 | 文件 | 发现 |
|---|---|---|
| Composer | `web/src/components/AssistantChat/HappyComposer.tsx` | 会话 thinking 时仍可发送，当前默认进入 queued。Escape/停止仍是 abort 语义。 |
| 发送 Hook | `web/src/hooks/mutations/useSendMessage.ts` | `isSessionThinking` 时 optimistic status 为 `queued`；请求体没有 delivery mode。 |
| 队列 UI | `web/src/components/AssistantChat/QueuedMessagesBar.tsx` | 显示、编辑、取消 queued messages；没有插队/引导层级。 |
| REST | `hub/src/web/routes/messages.ts` | `POST /sessions/:id/messages` 只接受 text/localId/attachments/scheduledAt。 |
| MessageService | `hub/src/sync/messageService.ts` | 持久化 message，非未来 scheduled 立即向 CLI 发 `new-message`；`messages-consumed` 后写 `invokedAt`。 |
| CLI Queue | `cli/src/utils/MessageQueue2.ts` | 支持 `push`、`pushImmediate`、`pushIsolateAndClear`、`unshift`、cancel、batch consumed。具备实现“优先插入”的基础。 |
| Claude | `cli/src/claude/claudeRemoteLauncher.ts`, `cli/src/claude/runClaude.ts` | Remote 有 abort controller；runClaude 将 user message push 到 queue；特殊命令用 isolate/clear。没有 guide 语义。 |
| Codex | `cli/src/codex/codexRemoteLauncher.ts` | `handleAbort()` 会 interrupt active turns 并 `session.queue.reset()`，这对 guide 不安全；需要单独 guide path，不能复用 abort 清空队列。 |
| Local launcher | `cli/src/modules/common/launcher/BaseLocalLauncher.ts` | 已有新消息触发切换/中断的机制，可作为 guide 本地模式参考。 |

**核心问题**：排队是“等 agent 当前 turn 完成后继续”，引导是“发现理解偏差，立即纠偏”。技术上不能简单复用 abort，因为 abort 可能清队列、丢 pending、影响核心会话。必须定义 delivery mode、可恢复的中断协议和 UI 明示风险。

### 3.4 上下文用量 UI 与不可用排查

| 层级 | 文件 | 发现 |
|---|---|---|
| UI | `web/src/components/AssistantChat/StatusBar.tsx` | 当前显示 `ctx used/max (x%) · y% left`；移动端是 `ctx 200K, 100% left`。颜色按剩余百分比 <=5/<=10，而非用户要求的已用 60/80 阈值。 |
| 汇总 | `web/src/chat/reducer.ts` | 从最新 normalized message 的 `usage` 取 context；优先 `context_tokens`，否则 `cache_creation + cache_read + input_tokens`；过滤 `scope_role === child`。 |
| Claude normalize | `web/src/chat/normalizeAgent.ts` | 只有同时有 `input_tokens` 和 `output_tokens` 时才保留 usage；保留 `context_window`。 |
| Codex normalize | `web/src/chat/normalizeAgent.ts` | 从 token_count 的 `last/last_token_usage/total` 推断；可读 `context_tokens` 和 `modelContextWindow`。 |
| Budget fallback | `web/src/chat/modelConfig.ts` | Claude 只识别 preset、`claude-` 开头或 flavor=claude 默认；自定义模型若没有 `context_window`，可能无法算百分比。 |
| Claude converter | `cli/src/claude/utils/sdkToLogConverter.ts` | 如果 SDK assistant message 有 `usage`，且 session init 推断到窗口，会注入 `usage.context_window`。没有 usage 则无从显示。 |

#### tsintergy / GLM-5.1 实测记录

- 配置来源：`~/.claude/settings.json`，仅读取非密字段 `ANTHROPIC_BASE_URL=http://new-api.saas-vpp.tsintergy.com`、`ANTHROPIC_MODEL=glm-5.1`；`ANTHROPIC_AUTH_TOKEN` 未打印、未写入文档。
- 测试时间：2026-06-08。
- 请求：Anthropic-compatible `POST /v1/messages`，`model=glm-5.1`，极小 prompt。
- 结果：HTTP 200，响应包含顶层 `usage`，usage keys 包含 `input_tokens`、`output_tokens`、`cache_read_input_tokens`、`server_tool_use`、`service_tier`。
- 结论：**至少该 direct Messages API 路径会返回用量；“不可用”不能简单归因于 tsintergy/GLM-5.1 完全不返回 usage。**

#### 更可能的不可用原因

1. **流式/Claude Code SDK 路径与 direct API 不完全等价**：direct `/v1/messages` 有 usage，不代表 Claude Code stream-json 每个 assistant event 都带完整 usage。
2. **只有 assistant message 有 usage**：agent 正在工作、尚未产生带 usage 的 assistant message 时，UI 没有可用数据。
3. **normalizer 过严**：`input_tokens` 与 `output_tokens` 任一缺失就丢弃 usage；部分代理或代理商可能只给 total/context/cache 字段。
4. **context_window 来源不稳定**：自定义模型 `glm-5.1` 不在 `modelConfig` fallback 中；如果 converter 没注入 `context_window`，百分比无法计算。
5. **父子上下文过滤**：`scope_role === child` 的 usage 被过滤；如果主循环只产生 child/tool usage，父级状态会显示空。
6. **分页窗口问题**：`latestUsage` 只扫描当前已加载 normalized messages；恢复会话时最近 usage 可能不在窗口。
7. **文案误导**：用户看到 `ctx 200K, 100% left` 是“剩余”，但需求是“已用”。即使数据可用也传达错误。

### 3.5 “大纲”工具扩展为导出与总结提炼

| 层级 | 文件 | 发现 |
|---|---|---|
| 大纲生成 | `web/src/chat/outline.ts` | 只把已调用的 `user-text` 转为 outline item；过滤 queued；只保留用户消息 label。 |
| 页面注入 | `web/src/components/SessionChat.tsx` | `buildConversationOutline(reconciled.blocks)` 后传入 HappyThread。 |
| Panel | `web/src/components/AssistantChat/HappyThread.tsx` | `ConversationOutlinePanel` 是右侧绝对定位 aside，仅支持加载更早、跳转用户消息、关闭。 |
| i18n | `web/src/lib/locales/en.ts`, `zh-CN.ts` | 已有 outline 基础键；没有 export/synthesis/download/filter 相关 key。 |
| API | 当前无会话导出/总结接口 | 需要新增导出预览、生成、下载、任务状态与可选 AI 提炼接口。 |

**核心问题**：“大纲”目前是导航工具，不是“会话资产化”工具。用户想要复盘、发现错误引导、沉淀设计方案、下载 MD，这需要将其升级为会话记忆工作台。

## 4. 外部参考调研（提炼原则）

| 参考 | 链接 | 可借鉴原则 |
|---|---|---|
| VS Code Source Control | https://code.visualstudio.com/docs/sourcecontrol/overview | Git UI 应围绕变更、暂存、提交、同步的连续工作流，而不是单纯命令列表。 |
| GitHub Desktop | https://docs.github.com/en/desktop/overview/about-github-desktop | 图形化 Git 的价值是把 branch/history/diff/publish/pull request 放在一个低认知负担流程里。 |
| Postman Vault / Variables | https://learning.postman.com/docs/sending-requests/postman-vault/postman-vault-secrets/ | Secret 管理要把“可用性”和“不可泄露”同时可视化；密钥不应成为普通可复制字段。 |
| OpenAI Projects & API keys | https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects | Provider 不只是 key 列表，还应有 project/service-account/scope/default 等治理概念。 |
| Anthropic Messages API | https://docs.anthropic.com/en/api/messages | usage 是上下文监控的数据来源之一，但 UI 必须明确“数据来源”和“不可用原因”。 |
| Claude Code Interactive Mode | https://docs.anthropic.com/en/docs/claude-code/interactive-mode | 会话中断/命令应清楚表达当前状态与下一步，不应让用户猜测 agent 是否收到纠偏。 |
| ChatGPT Data Export | https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data | 导出不是复制聊天窗口，应生成可保存、可复盘的结构化资产。 |
| MDN PWA Installability | https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable | PWA 体验要考虑 standalone 模式、manifest、安装后导航与浏览器 chrome 缺失场景。 |
| Apple Human Interface Guidelines | https://developer.apple.com/design/human-interface-guidelines/ | iOS 上操作必须清楚、可触达、状态直接，动画克制并尊重减少动态效果。 |

## 5. 本阶段设计输出清单

| 文档 | 用途 |
|---|---|
| `37-BRAND-SYSTEM.md` | 五大功能品牌命名、文化、Logo、Slogan、README 传播口径。 |
| `37-UX-SHAPE.md` | 前端优先的完整 UI / 交互 / 动效 / 移动端设计。 |
| `37-TECH-DESIGN.md` | 后端/API/数据/事件/CLI 协议设计，不实施。 |
| `37-REQUIREMENTS.md` | 可验收需求列表与验收标准。 |
| `37-ROADMAP.md` | 后续实施阶段拆分与质量门禁。 |
| `37-README-BRAND-COPY.md` | README 与文档同步的中英品牌文案草稿。 |
| `.planning/research/2026-06-08-feature-redesign-references.md` | 外部参考和 tsintergy 用量测试记录。 |
