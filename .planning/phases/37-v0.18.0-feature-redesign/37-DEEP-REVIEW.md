# Phase 37 — 多子代理全方位深度评审报告

> 评审日期：2026-06-08
> 评审对象：提交 `a183138 docs: 设计五大特色功能品牌化重塑方案` 中的 Phase 37 设计文档
> 评审方式：4 个子代理并行只读评审 + 主代理按 SPACE-review-board 多角色方法归并
> 评审范围：产品/品牌、前端 UX/iOS PWA、技术架构/协议、质量/安全/可发布性
> 文件改动策略：本报告只沉淀评审结论，不修改 Phase 37 原始方案正文。

## 1. 总体判定

**结论：⚠️ 有条件通过，不建议直接进入实现。**

Phase 37 的总体方向正确：它已经把 API 供应商、Git、会话引导、上下文监控、大纲导出提炼从普通功能列表提升为五个特色能力，并且形成了品牌、UX、API 和实施路线。

但当前文档仍存在 5 类进入实现前必须补齐的问题：

1. **Guide Beam 协议细节不足**：如果直接按当前思路实现，存在卡死 queued/guiding、清空队列、提前 invoked、旧 CLI 不兼容等高风险。
2. **Provider / Export 安全标准不够可执行**：SSRF、namespace、key reveal、诊断脱敏、导出隐私和外部模型提炼默认策略需要补成门禁级要求。
3. **Git Atlas 的 Commit Basket 缺少现有代码可行性闭环**：当前 commit paths 在 CLI 侧可能无法按预期生效，不能只做 UI 设计。
4. **品牌命名与传播顺序需 canonical 化**：否则实施时容易退回“API Key 列表 / Git Tab / 下载聊天记录”等普通功能。
5. **iOS PWA / A11y / 动效验收还停留在原则级**：需要组件级、视口级、焦点级、减少动画级验收矩阵。

## 2. 子代理评审摘要

| 子代理视角 | 结论 | 核心判断 |
|---|---|---|
| 产品/品牌 | 有条件通过 | 已有特色功能气质，但需收敛 canonical naming、五节点传播顺序、signature moment 和 Phase 状态说明。 |
| 前端 UX / iOS PWA | B+ 有条件通过 | 方向正确，但缺组件级规格、iOS PWA 验收、焦点管理、滚动/键盘边界、动效降级。 |
| 技术架构/协议 | C+ 有条件通过 | Guide 独立 delivery mode 方向正确，但能力协商、isolated queue、CLI meta、Provider namespace/SSRF、Git basket、Export job 仍有阻断缺口。 |
| 质量/安全/发布 | B- 黄灯 | docs-only 提交合规，但发布门禁不通过；安全实现标准不足，工作区存在大量非本阶段脏改动。 |

## 3. 通过条件与不可上线条件

### 3.1 进入实现前必须满足

1. 新增 `37-PROTOCOL-ADDENDUM.md` 或等价协议补充文档，明确 Guide Beam 的 capability handshake、queue isolate、旧 CLI fallback、messages-consumed 时序、重启幂等。
2. 新增 Provider / Export 安全门禁：SSRF 测试矩阵、namespace 隔离、key reveal 策略、日志脱敏、导出隐私默认策略。
3. 明确 Git Commit Basket 与现有 CLI commit handler 的差距：paths 是否生效、是否自动 add、如何保留/回滚 staging。
4. 将五个功能命名、i18n namespace、README 传播顺序、signature moment 写成 canonical contract。
5. 补充 iOS PWA / A11y / reduced-motion 验收矩阵。

### 3.2 不可直接进入实现的条件

存在以下任一情况，不建议开工编码：

- Guide 仍直接发送 `guide-message` 给未声明支持的 CLI。
- Guide 仍复用 Codex/local abort reset 路径。
- Provider 仍无 namespace 与 SSRF 强校验方案。
- Export/synthesis 默认可把完整会话发送到外部模型。
- Git Atlas Commit Basket 仍无法保证只提交选中文件。
- README/PRODUCT/功能页面继续混用 `API 星桥 / Model Nexus / API Providers` 等非 canonical 命名。

## 4. 阻断项（Blocker）

| # | 问题 | 角色 | 所在方向 | 修改建议 |
|---|---|---|---|---|
| B1 | Guide 发给旧 CLI 可能卡死消息：未知 update 既不会 enqueue，也不会 `messages-consumed`。 | 研发、测试 | Guide Beam | 增加 CLI capability handshake；不支持 guide 时 Hub 必须降级 `new-message` queue，并发 SSE/toast。 |
| B2 | 当前 `MessageQueue2.unshift()` 不是 guide 语义；同 mode 普通 queued 可能被一起 batch。 | 研发 | Guide Beam | 新增 `unshiftIsolated()` / `pushGuide()`：优先、单独消费、保留队列。 |
| B3 | Codex/local abort reset 路径会清空 queue，不能作为 guide 实现。 | 研发、测试 | Guide Beam | 为 Claude/Codex/local 分别设计 guide interrupt path，不复用会 reset queue 的 abort。 |
| B4 | CLI 侧 message meta 可能剥离未知字段，`deliveryMode` 只放 JSON meta 不可靠。 | 研发 | Guide Beam | 扩展 shared/socket/api schema，确保 CLI 保留并识别 delivery mode。 |
| B5 | Provider 当前无 namespace，未来 Model Nexus 可能跨 namespace 暴露 provider 配置/分配。 | 研发、安全 | Model Nexus | 数据库迁移增加 namespace；所有 provider API 按 namespace 查询和写入。 |
| B6 | Provider SSRF 设计仍原则化，不能只靠 URL 字符串判断。 | 安全、测试 | Model Nexus | 补 DNS/redirect/IPv6/metadata/userinfo/端口/响应大小/超时完整测试矩阵。 |
| B7 | Git Commit Basket 可能无法按 paths 提交，因为现有 CLI handler 可能忽略 paths。 | 研发、测试 | Git Atlas | 在技术补充中明确 commit selected paths 的真实实现策略与回滚策略。 |
| B8 | Session Loom 外部模型提炼可能泄露完整会话、路径、remote、tool output、provider host。 | 法务/安全 | Session Loom | `redactSecrets` 默认开启；外部 LLM 提炼默认关闭且显式确认；下载鉴权与 exportId 不可枚举。 |

## 5. 重要项（Major）

| # | 问题 | 角色 | 修改建议 |
|---|---|---|---|
| M1 | Phase / 版本 / 状态文档存在历史 Phase 37 与 v0.18.0 Phase 37 混淆。 | 产品、项目管理 | 在 `STATE.md` 增加“v0.18.0 Phase 37 状态说明”，说明该提交仅为设计阶段，历史 Phase 37 不同。 |
| M2 | 品牌命名未唯一规范：`API 星桥` vs `Model Nexus` 语义不完全一致。 | 产品/品牌 | 建立 Canonical Naming Contract；建议统一为“模型星桥 / Model Nexus”或同步调整英文。 |
| M3 | README 草稿仍偏功能列表，不足以表达完整工作流。 | 产品/运营 | 以“接入 → 驾驶 → 观测 → 追踪 → 沉淀”作为 README 主叙事。 |
| M4 | 缺少“不得退化为普通功能”的品牌验收门禁。 | 产品、测试 | 增加 BRAND-05~08：每个功能必须有 signature moment。 |
| M5 | iOS sheet/drawer/bottom dock 可能互相抢占聊天底部空间。 | UI/UX | 增加 390×844、430×932、iPad、桌面四档截图验收。 |
| M6 | 焦点管理、返回焦点、Escape/浏览器返回、safe-area、键盘弹出未形成组件级标准。 | UI/UX、测试 | 所有 sheet/popover/drawer 增加焦点陷阱和返回行为验收。 |
| M7 | 动效较多，实施时可能变成装饰或影响可访问性。 | UI/UX | 为每个动效写 `prefers-reduced-motion` 替代状态；失败态以展开错误为主，少用 shake。 |
| M8 | Context Pulse 数据来源与不可用原因需要分层：provider 支持 usage ≠ 当前 agent stream 收到 usage。 | 研发、测试 | 建立 `ContextUsageView` + session latest parent usage cache + provider capability 联动。 |
| M9 | Provider health/capability/model cache 需要落库和 TTL，不应只是 transient check。 | 研发 | 迁移新增 health/capability/model cache 表或 JSON 列。 |
| M10 | Git sync 长操作缺 job/progress/cancel/in-flight lock。 | 研发、UX | 统一 Sync Center 前补 job 或至少 in-flight lock 与重复点击保护。 |
| M11 | Export 大会话可能内存过高，文件清理策略未定义。 | 研发、安全 | 导出流式/分块写；exports metadata 表记录 TTL/size/checksum；支持删除/过期清理。 |
| M12 | 工作区存在大量非本阶段 dirty/untracked 文件，后续提交易混入。 | 项目管理 | 后续实施前先清理/隔离工作区，或新建干净分支/工作区。 |

## 6. 建议项（Minor）

| # | 问题 | 建议 |
|---|---|---|
| m1 | Guide 控件文案 `引导` 可能被误解成新手引导。 | 控件层使用 `立即引导`，品牌层保留 `引导光标 / Guide Beam`。 |
| m2 | Session Loom 仍从“大纲”入口进入，品牌感可能弱。 | Panel 主标题使用“会话织锦”，`大纲` 只作为第一个 Tab。 |
| m3 | System event 设计为 11px text + border-left，字号偏小且接近只靠颜色。 | 改为 12/13px、图标、浅色 pill 或 timeline dot。 |
| m4 | Provider 星图容易做成装饰。 | 星图仅作为状态关系表达，卡片主 CTA 必须清楚可见。 |
| m5 | Electric Orange 用途过多可能稀释语义。 | 橙色只用于品牌主动作/激活，不承担 warning/danger。 |

## 7. 建议新增的补充文档

### 7.1 `37-PROTOCOL-ADDENDUM.md`

必须覆盖：

- Guide capability handshake。
- `deliveryMode` schema 与 CLI meta 保留。
- `guide-message` 与旧 CLI fallback。
- `unshiftIsolated()` / `pushGuide()` 语义。
- `messages-consumed` 时序：只能 queue collect 后触发。
- Claude/Codex/local 分别的 interrupt path。
- Hub 重启/CLI 重连幂等与 interrupt storm 防护。

### 7.2 `37-SECURITY-ADDENDUM.md`

必须覆盖：

- Provider namespace 隔离。
- SSRF 完整 case：IPv4/IPv6/IPv4-mapped、metadata IP、DNS→private、redirect→private、userinfo、非 http(s)、端口、响应大小、超时。
- 统一 sanitizer / redaction allowlist。
- Session Loom export 默认 redaction、外部模型默认关闭、exportId 不可枚举、下载鉴权、文件权限、TTL 清理。
- Git remote URL / stderr / clone progress credential redaction。

### 7.3 `37-UX-ACCEPTANCE-MATRIX.md`

必须覆盖：

- iPhone 390×844、430×932、iPad、desktop。
- 44px touch target、16px input、safe-area、keyboard。
- Sheet/drawer/popover focus trap / return focus / Escape / browser back。
- `prefers-reduced-motion` 下禁用 shake、飞入、循环 pulse、扫光。
- 大 diff / 大 Markdown 虚拟滚动或分块。

### 7.4 `37-BRAND-CONTRACT.md`

必须覆盖：

- Canonical Naming Contract。
- 五节点顺序：接入 → 驾驶 → 观测 → 追踪 → 沉淀。
- Signature moment：模型星桥点亮、Git Hero 推荐动作、立即引导、上下文诊断、会话织成资产。
- README/PRODUCT/i18n/release notes 同步规则。

## 8. 高风险回归清单

### Guide Beam

- Guide unsupported CLI fallback。
- Guide preserve queue。
- Guide isolated 不与普通 queued batch。
- Guide cancel before consumed。
- Guide + scheduled/attachments 禁止或降级。
- Hub restart 不重复 interrupt。
- Permission request active 时不绕过权限。

### Model Nexus

- Namespace 隔离。
- DNS/redirect SSRF。
- Key reveal TTL/一次性/审计。
- Header/query/body/error redaction。
- Provider health cache TTL。

### Git Atlas

- Commit basket selected paths。
- 已 staged 文件保留策略。
- Force push server-side confirmation。
- Remote credential redaction。
- Long sync duplicate click lock。

### Context Pulse

- 59/60/80/81 阈值。
- Partial usage。
- 自定义模型 context window。
- Provider supports usage 但 stream 未返回 usage。
- 分页恢复 latest usage cache。

### Session Loom

- 全量历史导出，不依赖前端已加载 messages。
- 长会话流式导出。
- Secret redaction snapshot。
- 外部 LLM 显式确认。
- iOS PWA download/share/copy fallback。
- 未授权 download 拒绝。

## 9. 推荐下一步

建议在任何源码实现前，先做一个 docs-only 修订提交：

1. 新增 `37-PROTOCOL-ADDENDUM.md`。
2. 新增 `37-SECURITY-ADDENDUM.md`。
3. 新增 `37-UX-ACCEPTANCE-MATRIX.md`。
4. 新增 `37-BRAND-CONTRACT.md`。
5. 在 `37-REQUIREMENTS.md` 追加 BLOCKER/Major gate。
6. 在 `37-ROADMAP.md` 把这些补充文档设为 Phase 37.1 前置门禁。

只有完成以上补充后，Phase 38+ 才适合开始实现。
