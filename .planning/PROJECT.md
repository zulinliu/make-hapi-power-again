# Hapi Power

## What This Is

**Hapi Power** 是一个面向 AI 编码代理的全栈开发者工作台（Bun + Hono + React 19 monorepo），将远程代理管理、本地开发工具链（文件管理 + 代码编辑 + PTY 终端 + Git 管理）、扩展生态系统（插件 + Skill + Claude Plugin）、模型供应商治理、会话驾驶、上下文观测和项目记忆沉淀融合为统一的 Web 体验。项目基于 hapi（AGPL-3.0）上游源码二次开发，保留 CLI-Hub-Web 三层架构，在其上构建完整的 AI 编码工程闭环。

## Core Value

**把 AI 编码对话变成可驾驶、可观测、可复盘的工程闭环：接入可信模型，工作中即时纠偏，观察上下文风险，追踪每次代码变化，并把会话沉淀为项目记忆。**

## v0.18.0 五节点能力环

| 顺序 | 节点 | 品牌能力 | 工程价值 |
|---|---|---|---|
| 1 | 接入 | 模型星桥 / Model Nexus | 统一治理 Provider、健康检测、能力缓存和 Agent 分配。 |
| 2 | 驾驶 | 引导光标 / Guide Beam | Agent 工作中仍能即时纠偏，且不清空普通队列。 |
| 3 | 观测 | 上下文脉冲 / Context Pulse | 用 `上下文：40%` 和诊断信息展示可靠性风险。 |
| 4 | 追踪 | Git 脉络 / Git Atlas | 聚合分支态势、变更地图、Diff、提交篮和同步风险。 |
| 5 | 沉淀 | 会话织锦 / Session Loom | 把对话导出、提炼并转为可复用项目记忆。 |

## Requirements

### Validated

<!-- 从 hapi 上游继承的已验证能力 -->

- ✓ CLI ↔ Hub ↔ Web 三层通信架构（Socket.IO + SSE + REST） — hapi 上游
- ✓ 会话管理与消息流同步（SyncEngine） — hapi 上游
- ✓ Web→CLI RPC 远程调用路由（RPCGateway） — hapi 上游
- ✓ React 19 + TanStack Router/Query 前端架构 — hapi 上游
- ✓ Hono + Bun 后端框架 + SQLite 数据库 — hapi 上游
- ✓ Tailwind CSS 4 深色主题 UI — hapi 上游
- ✓ SSE 实时消息推送 — hapi 上游
- ✓ Monorepo 工作区结构（cli/ + hub/ + web/ + shared/） — hapi 上游

### Active

<!-- v0.1 新增功能 -->

**Module A — Git 管理**
- [ ] 浏览器内 Git 可视化管理（状态面板、历史记录、分支管理、差异查看）
- [ ] Git 操作 API 统一到 Session 中心隔离模型（/api/sessions/:id/git/*）
- [ ] GitInternalAPI 内部接口供其他模块调用（autoCommit、resetToCommit）
- [ ] Git 凭证加密存储（AES-256-GCM + auth_tag）
- [ ] SSRF 防护（Clone URL 白名单仅 https/ssh）

**Module B — PTY 终端**
- [ ] 浏览器内 xterm.js 终端（多会话、分屏、自适应尺寸）
- [ ] Socket.IO /pty 命名空间 + JWT 认证中间件
- [ ] PTY 资源限制（rlimit：内存 512MB、CPU 3600s、FD 256、全局上限 256）
- [ ] 二进制帧传输集成（Socket.IO binary event）
- [ ] 进程组清理（销毁时 kill 整个进程组）

**Module C — 文件管理 + 代码编辑器**
- [ ] react-complex-tree 文件树（懒加载、拖放、虚拟化、内联重命名）
- [ ] 完整文件操作 API（CRUD + 剪贴板 + 搜索 + 上传/下载）
- [ ] Monaco Editor 代码编辑器集成（路由级懒加载、语言检测、自动保存）
- [ ] 文件预览面板（代码高亮、图片、Markdown、PDF）
- [ ] 路径安全中间件（URL 解码 + NFC 正规化 + realpathSync）
- [ ] 文件上传限制（100MB、类型白名单、ZIP bomb 检测）

**Module D — 插件系统 + Skill 管理 + Claude Plugin 管理**
- [ ] 插件系统（Blob URL 动态加载 + ErrorBoundary 隔离 + 运行时权限网关）
- [ ] Skill 管理（skills.sh 集成 + git sparse-checkout 安装）
- [ ] Claude Plugin 管理（市场仓库浏览/安装/更新）
- [ ] 统一 Skill 存储路径（~/.claude/skills/）

**Module E — AI 工作流增强**
- [x] ~~变更审查流程（基于 ToolCall 追踪 + 三态审查模型 + DiffView 复用）~~ → v0.12.0 已删除
- [x] ~~代理操作时间线 + 会话摘要（增量摘要 + 检查点机制）~~ → v0.12.0 已删除
- [x] ~~撤销变更（Git 优先回滚 + 文件快照兜底 + 三种粒度）~~ → v0.12.0 已删除
- [x] ~~移动端代码文档速览（专用 /m/* 路由 + PWA 推送通知）~~ → v0.12.0 已删除
- [x] ~~会话分享（只读快照 + 范围控制 + 时效控制）~~ → v0.12.0 已删除

**Module F — 代理体验增强**
- [ ] 二进制帧传输（图片/截图 → 代理，Socket.IO binary event）
- [x] ~~语音对话界面（浏览器麦克风 → Whisper API → 代理）~~ → v0.12.0 已删除
- [x] ~~Skill 编排系统（Loop、Handoff、Advisor、Committee、Epic）~~ → v0.12.0 已删除
- [x] ~~简易白板工具（Canvas 绘图 → base64 → 代理）~~ → v0.12.0 已删除

**Module G — 会话上下文管理**
- [x] 上下文脉冲（Context Pulse）：`上下文：40%` 已用比例、59/60/80/81 阈值、不可用原因诊断
- [ ] 压缩事件通知与详情查看
- [ ] 手动压缩触发

**Module H — 模型星桥 / Model Nexus（v0.18.0 升级）**
- [x] Provider namespace 隔离、CRUD、健康检测、能力缓存、模型缓存和 Agent 分配矩阵
- [x] API Key 加密存储（AES-256-GCM，SQLite 存储）与二次确认 reveal
- [x] 模型自动发现和 SSRF 防护（DNS、redirect、IPv6、metadata IP、userinfo、端口、超时、响应大小）
- [x] 供应商配置 Hub→CLI RPC 下发（融入现有 sessionConfigRpc 机制）
- [x] ModelSelector 下拉框融合（自定义供应商无缝嵌入现有模型选择器）
- [x] 支持 Claude / Codex / Gemini / OpenCode 四种代理
- [x] Settings 页面升级为“模型星桥 / Model Nexus”控制舱
- [x] 多供应商切换 + 会话级供应商绑定

**Module I — API 协议转换（v0.8 规划）**
- [ ] Hub 端 API 协议代理（Anthropic ↔ OpenAI Chat/Responses 双向转换）
- [ ] Gemini Native 格式转换
- [ ] Codex Responses API 转换
- [ ] 熔断器 + 故障转移
- [ ] 流式响应透传

**Module J — v9 UI 统一优化（feat/v9）**
- [ ] SessionHeader 响应式工具栏（桌面端直接显示 Git/扩展/大纲图标，移动端收入"..."菜单）
- [ ] 所有子页面布局统一（CSS 变量、max-w-content、安全区域、返回按钮、Tab 指示器、padding）
- [ ] 右键菜单全局适配（桌面端右键、移动端"..."按钮，统一封装 useContextMenu hook）
- [ ] Git 状态页文件预览（点击变更文件预览内容）

**Module K — v0.18.0 特色工作流**
- [x] 引导光标 / Guide Beam：deliveryMode、capability handshake、isolated guide queue、fallback queue、`messages-consumed` 时序
- [x] Git 脉络 / Git Atlas：结构化 dashboard、变更地图、Diff preview、Commit Basket、Sync Center、危险操作服务端确认
- [x] 会话织锦 / Session Loom：服务端全量 outline、Markdown 导出、默认 redaction、本地提炼、资产下载/复制/share fallback

**Cross-cutting（跨模块）**
- [ ] Hub EventBus 事件总线（ADR-003：跨模块事件通知）
- [ ] 统一导航架构（ADR-008：侧边栏导航）
- [ ] 路由级代码分割（ADR-006：Monaco/Mermaid/xterm 懒加载）
- [ ] 统一错误响应格式（ADR-007：ApiResponse<T>）
- [ ] 统一数据库迁移（ADR-009：V10 迁移脚本）
- [ ] Cursor + Linear 融合设计系统（Canvas #0A0A0B，5 色语义系统，Inter Variable）
- [ ] i18n 国际化架构预留
- [ ] 可访问性基础（焦点环、ARIA 属性、对比度修正）

### Out of Scope

- **插件 iframe/Web Worker 隔离** — v0.2 评估，v0.1 用 ErrorBoundary + 运行时网关
- **终端触摸优化**（专用工具栏、手势系统） — 延后到 v0.2
- **PTY 会话跨 Hub 重启持久化** — 延后到 v0.2
- **Git 操作委托独立 Worker 服务** — 水平扩展方案延后到 v0.2
- **移动端终端输入** — 安全考虑，v0.1 仅只读
- **实时协作编辑** — 非核心场景，延后
- **OAuth 第三方登录** — hapi 上游认证体系足够
- **视频通话/屏幕共享** — 超出开发工具台范围
- **原生桌面应用** — 浏览器优先，Tauri/Electron 延后
- **分享密码保护/访问次数限制** — v0.2

## Context

- **上游项目**：hapi（AGPL-3.0），提供 CLI-Hub-Web 基础架构，已全量拷贝为初始代码基线
- **技术栈已定**：Bun + Hono + React 19 + TanStack Router/Query + Tailwind CSS 4 + SQLite + Socket.IO + SSE
- **设计评审已完成**：经过三轮专业评审（UI/UX + 前端架构 + 系统架构 + 安全），11 项架构决策（ADR-001~011）已穿透到所有模块文档
- **安全发现已修复**：8 项安全发现（N-1~N-8）已全部在设计层面修复并穿透到对应模块
- **分支策略**：dev 分支为主开发分支，feat/v1 为当前功能分支
- **开发服务器**：本地 3210 端口，公网 https://test.example.com
- **参考项目**：Aider、OpenHands、Langfuse、LangGraph、Cursor、Claude Code

## Constraints

- **License**: 上游 hapi 为 AGPL-3.0，本项目必须保持 AGPL-3.0 兼容
- **Tech Stack**: 固定 Bun + Hono + React 19 + TanStack + Tailwind CSS 4 + SQLite，不引入替代框架
- **Browser-first**: 所有功能必须在浏览器中可用，不依赖本地 IDE
- **Monorepo**: 保持 cli/ + hub/ + web/ + shared/ 结构
- **Real-time**: 实时通信统一使用 Socket.IO（ADR-001），不再引入 ws
- **Security**: 所有文件操作必须经过路径规范化中间件（ADR-010）
- **Performance**: Monaco/Mermaid/xterm 等大型依赖必须路由级懒加载（ADR-006）
- **Design System**: 统一使用 Cursor + Linear 融合风格（Canvas #0A0A0B，5 色语义）

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Socket.IO 统一传输层（ADR-001） | 消除 Socket.IO vs WebSocket 混用冲突，二进制帧通过 Socket.IO binary event | ✓ Good |
| Session 中心隔离模型（ADR-002） | 统一所有模块到 /api/sessions/:id/ 路径，消除 userId vs session 隔离分裂 | ✓ Good |
| Hub EventEmitter 事件总线（ADR-003） | 跨模块事件通知（file:changed、git:status:changed、agent:status 等） | ✓ Good |
| Git 操作统一管理（ADR-004） | autoCommit 等操作通过 GitInternalAPI 间接调用，避免多模块直接操作 Git | ✓ Good |
| 代码编辑器归入文件管理（ADR-005） | 代码编辑器是文件管理的自然延伸，不单独成模块 | ✓ Good |
| 路由级代码分割（ADR-006） | Monaco ~800KB、Mermaid ~1MB 必须懒加载 | ✓ Good |
| 统一错误响应格式（ADR-007） | ApiResponse<T> 标准信封 | ✓ Good |
| 统一导航架构（ADR-008） | 侧边栏整合 Chat/Git/Files/Terminal/Settings/Extensions | ✓ Good |
| 统一数据库迁移（ADR-009） | V10 迁移脚本覆盖所有新增表 | ✓ Good |
| 安全增强穿透（ADR-010） | N-1~N-8 安全发现全部穿透到对应模块设计 | ✓ Good |
| 技术验证前置（ADR-011） | Phase 0.5 验证 node-pty + Bun 兼容性等关键技术风险 | — Pending |
| v0.7 供应商全局池模型（ADR-012） | 统一管理 API 供应商，避免按应用分散配置 | — Pending |
| v0.7 Hub→CLI RPC 配置下发（ADR-013） | 融入现有 sessionConfigRpc，不修改 CLI 配置文件 | — Pending |
| v0.7 AES-256-GCM API Key 加密（ADR-014） | SQLite 加密存储，优于 cc-switch 的明文方案 | — Pending |
| v0.8 协议转换延后（ADR-015） | v0.7 仅做配置+发现，协议转换由中转服务或 v0.8 Hub 代理实现 | — Pending |
| v0.18 五节点能力环（ADR-016） | README、PRODUCT、功能页面和 release notes 使用接入 → 驾驶 → 观测 → 追踪 → 沉淀顺序 | ✓ Good |
| v0.18 Guide capability handshake（ADR-017） | 旧 CLI 不支持立即引导时降级 queue，避免 stuck 和队列丢失 | ✓ Good |
| v0.18 默认导出脱敏（ADR-018） | Session Loom 默认 redaction，外部 LLM 提炼默认关闭并显式确认 | ✓ Good |

## v0.12.0 功能精简 (2026-06-04)

为了聚焦核心实用功能、保持代码库整洁，v0.12.0 删除了 9 项非核心功能（白板、Skill编排、移动端路由、变更审查、撤销、时间线、会话分享、语音录制、实时语音）。详见 STATE.md v0.12.0 章节。

**当前活跃功能清单（仅以下功能在代码库中存在）：**

| 模块 | 功能 | 状态 |
|------|------|------|
| 会话管理 | 创建/列表/详情/删除会话 | ✓ 活跃 |
| AI 聊天 | 多代理聊天（Claude/Codex/Gemini/OpenCode） | ✓ 活跃 |
| 文件管理 | 文件树 + Monaco Editor + 预览 | ✓ 活跃 |
| Git 管理 | 状态/历史/分支/diff/commit/push | ✓ 活跃 |
| PTY 终端 | xterm.js + Socket.IO 多会话 | ✓ 活跃 |
| 扩展系统 | 插件 + Skill 搜索/安装 + Claude Plugin | ✓ 活跃 |
| 供应商配置 | 自定义 API 供应商 + 模型发现 | ✓ 活跃 |
| 图片上传 | 二进制帧传输（Socket.IO） | ✓ 活跃 |
| 推送通知 | Web Push + Badge API + ServerChan + Telegram | ✓ 活跃 |
| PWA | Service Worker + 离线 + 安装引导 | ✓ 活跃 |
| i18n | 中英双语 | ✓ 活跃 |

## v0.18.0 特色能力补充 (2026-06-09)

| 模块 | 功能 | 状态 |
|------|------|------|
| 模型星桥 | Provider 治理、健康检测、能力缓存、Agent 分配矩阵、Wizard、安全 reveal | ✓ 活跃 |
| 引导光标 | 排队 / 立即引导、capability fallback、isolated guide queue、队列保留 | ✓ 活跃 |
| 上下文脉冲 | `上下文：40%`、阈值风险、usage 来源、不可用诊断 | ✓ 活跃 |
| Git 脉络 | Git dashboard、变更地图、Diff preview、Commit Basket、Sync Center | ✓ 活跃 |
| 会话织锦 | 大纲、导出预览、Markdown 导出、redaction、本地提炼、资产管理 | ✓ 活跃 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-05 after v0.12.0 功能精简*
