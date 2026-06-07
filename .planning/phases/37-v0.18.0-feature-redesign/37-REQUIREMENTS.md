# Phase 37 — v0.18.0 五大特色功能需求与验收标准

> 范围：设计完成后的后续实施需求基线。本文不是实现记录。

## PROVIDER — 模型星桥 / Model Nexus

| ID | 需求 | 验收标准 |
|---|---|---|
| PROVIDER-01 | 将设置页 API 供应商从列表重构为“模型星桥”控制舱。 | 首屏包含健康总览、Provider 卡片、Agent 分配矩阵、最近检测状态；空状态可引导新增。 |
| PROVIDER-02 | 新增 Provider Wizard。 | 支持协议选择、连接输入、能力检测、Agent 分配四步；移动端为 bottom/fullscreen sheet。 |
| PROVIDER-03 | Provider 健康与能力检测。 | 能检测模型 endpoint、基础消息 endpoint、usage 返回、context window、延迟和错误原因；不泄露 key。 |
| PROVIDER-04 | Agent 分配矩阵。 | 可一处查看和修改每个 Agent 的默认 Provider/模型；替代零散 chip 操作。 |
| PROVIDER-05 | 安全治理。 | HTTP/内网/重定向/鉴权失败/usage 缺失有明确风险提示；删除 Provider 前展示影响。 |
| PROVIDER-06 | 品牌落地。 | 页面标题、空状态、README、icon、i18n 使用 `模型星桥 / Model Nexus`。 |

## GIT — Git 脉络 / Git Atlas

| ID | 需求 | 验收标准 |
|---|---|---|
| GIT-01 | Git 页重构为 Git Atlas 决策舱。 | 默认首屏回答分支、变更、推荐动作；不再以四个 Tab 作为主要信息架构。 |
| GIT-02 | 结构化 dashboard API。 | 前端不再依赖页面内解析 stdout；Hub 返回 branch/ahead/behind/changes/remotes/history/recommendedAction。 |
| GIT-03 | 变更地图。 | 文件按来源/状态分组，可预览 diff、打开文件、复制路径、加入提交篮。 |
| GIT-04 | 提交篮。 | 用户可选择文件形成 basket，生成/输入 commit message 后提交；提交结果可回到 timeline。 |
| GIT-05 | 同步中心。 | Fetch/Pull/Push 统一在 Sync sheet，显示方向和风险；force push 在危险区二次确认。 |
| GIT-06 | 移动端。 | Git 在 iOS 上可完成查看变更、预览 diff、提交、同步；核心动作不依赖 hover/右键。 |
| GIT-07 | 特殊状态。 | no-repo、clone-progress、conflict、detached、no-remote 都有专属状态与推荐动作。 |

## GUIDE — 引导光标 / Guide Beam

| ID | 需求 | 验收标准 |
|---|---|---|
| GUIDE-01 | Composer 在 agent thinking 时显示 `排队 / 立即引导` 双模式。 | 默认排队；引导有说明；非 thinking 时不增加复杂度。 |
| GUIDE-02 | SendMessage 支持 deliveryMode。 | REST schema、Web hook、Hub message meta、CLI update 均能区分 queue/guide。 |
| GUIDE-03 | Guide 中断当前 turn 并优先发送。 | Claude/Codex 等支持的 agent 在 guide 后尽快收到纠偏；guide 消息优先于普通 queued。 |
| GUIDE-04 | 保留普通队列。 | Guide 不清空已有 queued messages；失败时降级为 queue。 |
| GUIDE-05 | 不破坏核心会话。 | 发送、取消 queued、messages-consumed、附件、定时消息、权限请求、session end 行为不回归。 |
| GUIDE-06 | 可观测反馈。 | UI 显示 `引导中/已收到/已降级排队`；失败原因可读。 |

## CTX — 上下文脉冲 / Context Pulse

| ID | 需求 | 验收标准 |
|---|---|---|
| CTX-01 | 文案改为中文短标签。 | 中文显示 `上下文：40%`；英文显示 `Context: 40%`；不再显示 `ctx 200K, 100% left`。 |
| CTX-02 | 颜色阈值。 | `<60%` 绿色，`60–80%` 黄色，`>80%` 红色；边界测试覆盖 59/60/80/81。 |
| CTX-03 | Popover 诊断。 | 可查看 used/max、cache、model、数据来源、更新时间、不可用原因。 |
| CTX-04 | 不可用不静默。 | 无 usage 或无 context window 时显示 `上下文：--`，并说明原因。 |
| CTX-05 | Provider 联动。 | 模型星桥可检测并记录 provider 是否返回 usage；Context Pulse 可引用该诊断。 |
| CTX-06 | GLM/tsintergy 验证。 | 实施阶段复测 direct API 与 Claude Code stream-json 两条路径，确认 usage 丢失点。 |

## LOOM — 会话织锦 / Session Loom

| ID | 需求 | 验收标准 |
|---|---|---|
| LOOM-01 | 大纲 Panel 升级为四 Tab。 | `大纲/导出/提炼/资产` 均可访问；移动端全屏 sheet。 |
| LOOM-02 | 完整会话导出。 | 可导出 Markdown，包含标题、时间、session metadata、概要、原始对话、澄清问答、过滤规则。 |
| LOOM-03 | 降噪过滤。 | 可过滤“继续/确认/ok”等噪音，但保留有语义的短答和用户边界指令。 |
| LOOM-04 | 深度提炼。 | 支持设计方案、PRD、决策日志、偏差检查、经验卡等模板。 |
| LOOM-05 | 下载与资产列表。 | 生成的 MD 可直接下载、复制、再次查看；有生成历史。 |
| LOOM-06 | 隐私清洗。 | 导出前提示潜在 secret；可选择遮蔽。 |
| LOOM-07 | i18n 双语。 | UI 与导出模板均支持中文/英文。 |
| LOOM-08 | iOS PWA。 | standalone 模式下下载失败有复制/分享 fallback；生成任务可后台完成并 toast 返回。 |

## BRAND / DOCS — 品牌和文档同步

| ID | 需求 | 验收标准 |
|---|---|---|
| BRAND-01 | 五个功能都有品牌名、icon、slogan。 | README、设置页、会话页、功能空状态使用一致名词。 |
| BRAND-02 | README 更新。 | README/README.zh-CN 使用新品牌叙事，不只写功能列表。 |
| BRAND-03 | 文档统一。 | PRODUCT、规划、用户文档、release notes 中相关描述统一。 |
| BRAND-04 | 视觉一致。 | Icon stroke、颜色、动效时长、卡片半径遵守 Hapi Power tokens。 |

## 特色功能验收门禁

| ID | 需求 | 验收标准 |
|---|---|---|
| BRAND-05 | 不可退化门禁。 | 任一功能首屏不得退化为 CRUD 列表、命令 Tab、普通状态条或下载按钮，必须呈现对应品牌的 signature moment。 |
| BRAND-06 | 五节点传播顺序。 | README、README.zh-CN、PRODUCT、release notes 使用同一套顺序：接入 → 驾驶 → 观测 → 追踪 → 沉淀。 |
| BRAND-07 | 命名契约。 | 所有新增 i18n key 必须符合 `37-BRAND-CONTRACT.md`，并通过 en/zh-CN parity 测试。 |
| BRAND-08 | 可截图品牌瞬间。 | 每个功能至少有一个可传播截图：星桥点亮、立即引导、上下文风险诊断、分支态势、会话织成资产。 |
| DOC-ADDENDUM-01 | 协议补充门禁。 | Guide Beam 实施前必须通过 `37-PROTOCOL-ADDENDUM.md` 的 capability、queue、fallback、幂等要求。 |
| DOC-ADDENDUM-02 | 安全补充门禁。 | Provider、Export、Git、Guide 实施前必须通过 `37-SECURITY-ADDENDUM.md` 的安全清单。 |
| DOC-ADDENDUM-03 | UX 验收矩阵。 | 前端实现必须按 `37-UX-ACCEPTANCE-MATRIX.md` 覆盖视口、焦点、safe-area、reduced motion。 |

## 全局质量门禁

- [ ] TypeScript strict，无新增 `any`。
- [ ] Zod schema 覆盖所有新 API 输入。
- [ ] i18n en/zh-CN parity 测试通过。
- [ ] Web unit/component tests 覆盖关键状态。
- [ ] Hub route tests 覆盖 guide、exports、provider diagnostics、git dashboard。
- [ ] CLI queue/guide tests 覆盖 preserve-queue 与 fallback。
- [ ] iOS Safari 手动验证：Composer、Git Atlas、Session Loom、Provider Wizard。
- [ ] 无 API key/secret 泄露到日志、导出、诊断文档。
- [ ] README/文档无第三方品牌残留署名。
