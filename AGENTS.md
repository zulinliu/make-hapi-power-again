# AGENTS.md

AI Agent 工作指南。开始前先读本文档，需要细节时再读各包 README。

## 项目概述

Hapi Power — AI 编码代理全栈开发者工作台。CLI 封装多种 AI 代理（Claude Code/Codex/Gemini/OpenCode/Cursor/Kimi），通过 Socket.IO 连接到 Hub 服务器，Hub 提供 REST API + SSE 实时推送 + Socket.IO 双向通信，Web 前端提供完整的浏览器内开发体验。

## 仓库结构

```
cli/      CLI 二进制，代理封装，runner 守护进程
hub/      Hono HTTP API + Socket.IO + SSE + 推送通知
web/      React PWA 前端（TanStack Router + Query）
shared/   共享类型、Schema、RPC 方法、工具函数
docs/     v0.1 设计文档（保留不变）
```

Bun workspaces 单仓，`shared` 被 cli/hub/web 共同依赖。

## 架构

```
┌─────────┐  Socket.IO(/cli)  ┌──────────────────┐  REST/SSE/Socket.IO  ┌─────────┐
│   CLI   │ ────────────────  │       Hub        │ ──────────────────── │   Web   │
│ (代理)   │                   │ (Hono + Socket.IO)│                      │ (React) │
└─────────┘                   └──────────────────┘                      └─────────┘
    │                               │       │                                  │
    ├─ 代理封装（claude/codex/       ├─ SQLite (better-sqlite3)           ├─ TanStack Router
    │  gemini/opencode/cursor/kimi)  ├─ EventBus 事件总线                 ├─ TanStack Query
    ├─ Socket.IO 客户端             ├─ 会话缓存                          ├─ Monaco Editor
    ├─ RPC 处理器（51个方法）        ├─ RPC 网关                          ├─ xterm.js
    └─ Runner 守护进程              ├─ SSE 广播                          ├─ Socket.IO 客户端
                                    ├─ 推送通知 (Web Push)               └─ Canvas 白板
                                    └─ GitInternalAPI
```

### Socket.IO 命名空间

| 命名空间 | 认证方式 | 用途 |
|----------|---------|------|
| `/cli` | CLI API Token | CLI 代理连接、RPC、会话同步 |
| `/terminal` | JWT | Web 终端、图片二进制上传 |

### 数据流

1. CLI 启动代理 → Socket.IO `/cli` 连接 Hub
2. 代理事件 → CLI → Hub (`message` event) → SQLite + SSE 广播
3. Web 订阅 SSE `/api/events` → 实时更新
4. 用户操作 → Web → Hub REST → RPC 到 CLI → 代理

## 开发命令

```bash
# 开发
bun run dev                    # Hub + Web 并发启动
bun run dev:hub                # 仅 Hub
bun run dev:web                # 仅 Web

# 类型检查
bun run typecheck              # 全包
bun run typecheck:cli          # CLI
bun run typecheck:hub          # Hub
bun run typecheck:web          # Web

# 测试
bun run test                   # 全包
bun run test:cli / test:hub / test:web / test:shared

# 构建
bun run build                  # 构建所有包
bun run build:single-exe       # 构建单文件可执行程序
```

## 关键源码目录

### CLI (`cli/src/`)

| 目录/文件 | 说明 |
|-----------|------|
| `commands/` | CLI 子命令（auth、claude、codex、gemini、cursor、kimi、opencode、runner、hub、mcp、doctor、notify） |
| `commands/registry.ts` | 命令注册表 |
| `api/` | Hub 连接（Socket.IO 客户端、认证） |
| `claude/` `codex/` `gemini/` `cursor/` `kimi/` `opencode/` | 各代理封装 |
| `runner/` | 后台守护进程，远程启动支持 |
| `modules/` | 工具实现（ripgrep、difftastic、git） |
| `agent/` | 多代理支持 |

### Hub (`hub/src/`)

| 目录/文件 | 说明 |
|-----------|------|
| `web/routes/` | REST API 端点（20+ 路由文件） |
| `web/server.ts` | Hono 应用注册所有路由 |
| `socket/server.ts` | Socket.IO 服务器，注册命名空间 |
| `socket/handlers/cli/` | `/cli` 命名空间事件处理 |
| `socket/handlers/terminal.ts` | `/terminal` 命名空间 PTY 处理 |
| `socket/handlers/image.ts` | 二进制图片上传处理 |
| `sync/` | 核心逻辑（SyncEngine、SessionCache、MessageService、RPC Gateway） |
| `store/` | SQLite 持久化（better-sqlite3） |
| `store/db.ts` | 数据库迁移（V10+） |
| `sse/` | Server-Sent Events 管理器 |
| `config/` | 设置加载、令牌生成 |
| `notifications/` | Web Push (VAPID) 通知 |
| `visibility/` | 客户端可见性追踪 |
| `git/` | Git 操作（isomorphic-git） |
| `pty/` | PTY 管理（node-pty） |
| `plugins/` | 插件系统 |
| `eventBus.ts` | EventBus 事件总线 |

### Web (`web/src/`)

| 目录/文件 | 说明 |
|-----------|------|
| `routes/` | TanStack Router 页面 |
| `routes/sessions/` | 会话视图（chat、files、terminal） |
| `routes/mobile/` | 移动端路由 `/m/*` |
| `components/` | UI 组件 |
| `components/SessionChat.tsx` | 主聊天界面 |
| `components/AssistantChat/` | assistant-ui 集成 |
| `components/ImagePasteDrop.tsx` | 图片粘贴/拖拽上传 |
| `components/VoiceRecorder.tsx` | 录音转文字 |
| `components/Whiteboard.tsx` | Canvas 白板工具 |
| `components/git/` | Git 管理组件 |
| `components/Editor/` | Monaco 编辑器集成 |
| `hooks/queries/` | TanStack Query 查询钩子 |
| `hooks/mutations/` | TanStack Query 变更钩子 |
| `hooks/useSSE.ts` | SSE 订阅 |
| `hooks/useTerminalSocket.ts` | 终端 Socket.IO 连接 |
| `hooks/useBinaryUpload.ts` | 二进制文件上传 |
| `hooks/usePushNotifications.ts` | Web Push 推送 |
| `router.tsx` | 路由定义（19 个路由） |
| `api/client.ts` | API 客户端封装 |

### Shared (`shared/src/`)

| 文件 | 说明 |
|------|------|
| `types.ts` | 核心类型（Session、Message、Machine、FileChange、TimelineEntry） |
| `schemas.ts` | Zod 验证 Schema |
| `socket.ts` | Socket.IO 事件类型定义 |
| `rpcMethods.ts` | 51 个 RPC 方法名 |
| `modes.ts` | 权限/模型模式定义 |
| `flavors.ts` | 代理类型（claude/codex/gemini/opencode/cursor/kimi） |
| `messages.ts` | 消息解析工具 |
| `eventBus.ts` | EventBus 类型定义 |
| `gitInternalApi.ts` | GitInternalAPI 类型 |
| `voice.ts` | 语音相关类型 |
| `utils.ts` | 通用工具函数 |

## Hub API 路由总览

| 路由组 | 路径前缀 | 说明 |
|--------|---------|------|
| auth | `/api` | 认证（令牌获取/验证） |
| sessions | `/api/sessions` | 会话 CRUD、上传、权限模式 |
| messages | `/api/sessions/:id/messages` | 消息查询、发送 |
| events | `/api/events` | SSE 实时推送 |
| git | `/api/sessions/:id` | Git 操作（状态/历史/分支/diff/log/commit） |
| cli | `/cli` | CLI 内部接口（会话/机器） |
| machines | `/api/machines` | 机器信息、远程启动 |
| permissions | `/api/sessions/:id/permissions` | 权限审批 |
| plugins | `/api/sessions/:id/plugins` | 插件管理（session-scoped） |
| skillManagement | `/api/sessions/:id/skills` | Skill 搜索/安装/卸载（session-scoped） |
| changeTracking | `/api/sessions/:id` | 变更追踪、审查、上下文状态 |
| timeline | `/api/sessions/:id` | 操作时间线、摘要、检查点 |
| undo | `/api/sessions/:id` | 撤销预览/执行、快照列表 |
| share | `/api/sessions/:id/shares` `/api/s/:shareId` | 会话分享（保护+公开） |
| push | `/api/push` | Web Push 订阅 |
| voice | `/api/voice` | 语音设置（ElevenLabs） |
| voiceTranscription | `/api/voice/transcribe` | Whisper 转录 |
| orchestration | `/api/orchestration/skills` | 编排 Skill |

## 常见任务

| 任务 | 关键文件 |
|------|---------|
| 添加 CLI 命令 | `cli/src/commands/`、`cli/src/commands/registry.ts` |
| 添加 Hub API | `hub/src/web/routes/`，在 `hub/src/web/server.ts` 注册 |
| 添加 Socket.IO 事件 | `hub/src/socket/handlers/`、`shared/src/socket.ts` |
| 添加 Web 路由 | `web/src/routes/`、`web/src/router.tsx` |
| 添加 Web 组件 | `web/src/components/` |
| 修改会话逻辑 | `hub/src/sync/syncEngine.ts`、`hub/src/sync/sessionCache.ts` |
| 修改消息处理 | `hub/src/sync/messageService.ts` |
| 添加 RPC 方法 | `shared/src/rpcMethods.ts`、`hub/src/sync/rpcGateway.ts` |
| 添加通知类型 | `hub/src/notifications/` |
| 添加共享类型 | `shared/src/types.ts`、`shared/src/schemas.ts` |

## 重要模式

### RPC

CLI 注册处理器（`rpc-register`），Hub 通过 `rpcGateway.ts` 路由请求。响应通过 `rpc-response` 事件回传。

### EventBus

Hub 内部事件总线，支持跨模块事件发布/订阅。类型定义在 `shared/src/eventBus.ts`。

### 版本化更新

CLI 发送 `update-metadata`/`update-state` 时携带版本号，Hub 拒绝过时更新。

### 会话模式

- `local`：终端控制，Web 只读
- `remote`：Web 控制，可切换

### 权限模式

`default` / `acceptEdits` / `bypassPermissions` / `plan`

### GitInternalAPI

Hub 内部 API，供其他模块（变更追踪、撤销）调用 Git 操作，无需经过 RPC。

### 路径安全中间件

所有文件操作路由必须经过路径安全检查，阻止路径遍历攻击。

### 数据库访问模式

路由访问 SQLite 通过 `(store as unknown as { db: Database }).db`。

### SyncEngine 延迟获取

Socket 服务器创建早于 SyncEngine，使用 `getSyncEngine?: () => SyncEngine | null` getter 模式。

## 测试

- 框架：Vitest（`bun run test`）
- 测试文件：`*.test.ts` 紧邻源码
- Hub 测试：`hub/src/**/*.test.ts`
- CLI 测试：`cli/src/**/*.test.ts`
- Web 测试：`web/src/**/*.test.ts` / `web/src/**/*.test.tsx`
- Shared 测试：`shared/src/**/*.test.ts`

## 规则

- TypeScript strict，禁止 `any`（用 `unknown` + 类型收窄）
- Zod 做运行时验证（Schema 在 `shared/src/schemas.ts`）
- 路径别名 `@/*` 映射到 `./src/*`（各包独立）
- 4 空格缩进
- 不可变数据，禁止直接修改
- 系统边界验证输入，内部代码信任类型
- 不做向后兼容，自由 breaking
