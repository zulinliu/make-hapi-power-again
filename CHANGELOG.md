# Changelog

All notable changes to Hapi Power will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.18.0] - 待发布

### Added

- **接入：模型星桥 / Model Nexus**，把模型 Provider 治理升级为控制舱，支持 namespace 隔离、健康检测、能力缓存、模型发现、Agent 分配矩阵、四步 Wizard 与安全 reveal。
- **驾驶：引导光标 / Guide Beam**，在 Agent thinking 时提供“排队 / 立即引导”双模式，支持 deliveryMode、capability handshake、isolated guide queue、旧 CLI fallback 与队列保留。
- **观测：上下文脉冲 / Context Pulse**，用 `上下文：40%` / `Context: 40%` 展示上下文占用，补充 usage 来源、不可用原因、provider capability 诊断和 59/60/80/81 阈值状态。
- **追踪：Git 脉络 / Git Atlas**，新增结构化 git-dashboard、变更地图、Diff preview、Commit Basket、Sync Center、selected paths 提交和危险同步服务端确认。
- **沉淀：会话织锦 / Session Loom**，把会话大纲升级为资产工作台，支持服务端全量 outline、导出预览、Markdown 导出、默认 redaction、本地提炼、资产历史、下载/复制/share fallback。

### Security

- Provider SSRF 防护覆盖 scheme、userinfo、私网/metadata IP、IPv6、DNS、redirect、端口策略、超时和响应大小限制。
- Session Loom 导出默认开启敏感信息遮蔽，外部模型提炼默认关闭且必须显式确认。
- Git Atlas 对 force push、删除分支、删除 remote 等危险操作增加服务端确认，并对 remote URL、stdout、stderr 和同步结果做 credential 脱敏。
- Guide Beam 不绕过 permission pending、attachments 和 scheduled restrictions；不支持 capability 时降级为普通排队，避免消息 stuck 或丢失。

### Changed

- README、README.zh-CN、PRODUCT 和规划文档统一采用五节点顺序：接入 → 驾驶 → 观测 → 追踪 → 沉淀。
- 设置页、会话 Composer、状态栏、Git 页面和会话资产面板的新增文案完成 en / zh-CN i18n parity。

### Validation

- 发布准备阶段已通过 `bun run typecheck`、`bun run test`、`bun run build`、`bun run check:git-standards`、`bun run check:sensitive-info` 和 `git diff --check`。
- 尚未创建 `v0.18.0` tag 或 GitHub Release；正式发布前仍需补齐五张 signature moment 截图和 iOS PWA 实机验收。

## [0.15.0] - 2026-06-06

### Changed

- Brand redesign: new "Power Hub" logo (energy chevron on platform)
- Color system migrated from Ink Teal to Electric Orange (oklch 68% 0.18 55)
- Unified design system across Web App and Marketing Website
- New slogan: "随时AI，编程自在" / "Code free, powered by AI"
- Typography: removed Source Serif 4, unified on Geist Sans
- Updated all SVG/PNG icon assets (favicon, PWA, Apple touch icons)
- Updated website visual style: from Neo-Brutalist to Power Geometry
- Updated all locale files (en, zh) with new brand copy

## [0.10.0] - 2026-06-04

### Changed

- Login page redesigned with Claude-style visual direction

## [0.9.0] - 2026-06-03

### Changed

- UI unification with SubPageLayout component, CSS variables, and context menus
- Unified page layout system across all session sub-pages

## [0.8.0] - 2026-06-03

### Changed

- Skill management UI redesign with online install and marketplace browsing
- Mobile layout fixes and responsive improvements

### Fixed

- Service worker cache optimization for faster loads

## [0.7.0] - 2026-06-02

### Added

- Custom model API provider configuration with CRUD management
- Model auto-discovery via `/v1/models` endpoint probing
- Provider-to-agent-flavor assignment system
- API key encryption with AES-256-GCM in SQLite
- Provider config delivery from Hub to CLI via RPC injection
- Model selector with custom provider integration

## [0.6.0] - 2026-05-31

### Added

- Visual Git management: status, commit, diff, branch, push, pull, clone
- File CRUD operations: create, delete, rename, move, copy, upload, download
- Markdown file preview with syntax highlighting
- File context menu with path copy and directory browsing

### Changed

- Production hardening and stability improvements

## [0.5.0] - 2026-05-31

### Added

- Core developer workflow: clone repository, edit files, review changes, push, create PR
- Session change tracking and file snapshot system

## [0.4.0] - 2026-05-31

### Added

- PWA service worker with precaching and navigation fallback
- PWA install prompt with iOS Safari guide
- Badge API integration for notification counts

### Changed

- Brand cleanup from upstream naming

## [0.3.0] - 2026-05-31

### Changed

- Full brand independence from upstream project
- Environment variables renamed with `HAPI_POWER_` prefix

## [0.2.0] - 2026-05-31

### Added

- iOS PWA optimization with keyboard handling and standalone mode support
- Mobile UX with dedicated `/m/*` routes and swipe gestures
- i18n framework with Chinese and English (397+ translation keys)

## [0.1.0] - 2026-05-30

### Added

- Full platform MVP with CLI, Hub, and Web packages
- Multi-agent support: Claude Code, Codex, Gemini, OpenCode, Cursor Agent, Kimi
- Socket.IO-based real-time communication between CLI, Hub, and Web
- React PWA frontend with TanStack Router, TanStack Query, Monaco Editor, xterm.js
- Hub HTTP API (20+ route files) with Hono framework
- SQLite persistence for sessions, messages, and machines
- Change review with file-level approve/reject
- Granular undo at session, step, and file granularity
- Monaco code editor with Shiki syntax highlighting
- Full PTY terminal via xterm.js with WebSocket transport
- E2E encrypted relay tunnel via WireGuard (tunwg)
- Single-file executable build for cross-platform deployment
- Homebrew formula auto-update via GitHub Actions
