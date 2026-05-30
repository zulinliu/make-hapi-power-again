# Hub

Hapi Power 服务端核心 — Hono HTTP API + Socket.IO 实时通信 + SSE 推送 + 推送通知 + SQLite 持久化。

## 功能

- REST API 提供会话、消息、Git、文件、权限、插件、变更追踪等全部后端服务
- Socket.IO 双向通信（`/cli` 命名空间连接 CLI，`/terminal` 命名空间连接 Web 终端）
- Server-Sent Events 实时推送更新
- Web Push (VAPID) 推送通知
- SQLite 持久化（better-sqlite3）
- EventBus 事件总线，跨模块事件发布/订阅
- GitInternalAPI 供 Hub 内部模块调用 Git 操作
- PTY 管理（node-pty），支持资源限制和进程清理
- 图片二进制上传（Socket.IO binary event）
- 语音转录（Whisper API）
- 编排 Skill（5 种模式：Loop/Handoff/Advisor/Committee/Epic）

## 配置

### 必需

| 变量 | 说明 |
|------|------|
| `CLI_API_TOKEN` | CLI 和 Web 共享密钥，客户端追加 `:<namespace>` 做隔离 |

### 可选

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | HTTP 监听端口 | `3000` |
| `HUB_TOKEN` | Hub 认证令牌 | - |
| `HAPI_LISTEN_HOST` | HTTP 绑定地址 | `127.0.0.1` |
| `ALLOWED_ORIGINS` | CORS 允许来源 | - |
| `DATA_DIR` / `HAPI_HOME` | 数据目录 | `~/.hapi` |
| `DB_PATH` | SQLite 数据库路径 | `DATA_DIR/hapi.db` |
| `OPENAI_API_KEY` | Whisper 语音转录 | - |
| `VAPID_PUBLIC_KEY` | Web Push 公钥 | - |
| `VAPID_PRIVATE_KEY` | Web Push 私钥 | - |
| `VAPID_SUBJECT` | Web Push 联系邮箱/URL | - |
| `HAPI_RELAY_API` | 中继 API 域名 | - |
| `HAPI_RELAY_AUTH` | 中继认证密钥 | - |

## 运行

```bash
# 开发
cd hub && bun run dev

# 从仓库根目录
bun run dev:hub
```

## HTTP API

### 认证 (`src/web/routes/auth.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth` | 获取 JWT 令牌 |
| POST | `/api/bind` | 绑定 Telegram 账号 |

### 会话 (`src/web/routes/sessions.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 列出所有会话 |
| GET | `/api/sessions/:id` | 获取会话详情 |
| PATCH | `/api/sessions/:id` | 重命名会话 |
| DELETE | `/api/sessions/:id` | 删除非活跃会话 |
| POST | `/api/sessions/:id/abort` | 中止会话 |
| POST | `/api/sessions/:id/switch` | 切换到远程模式 |
| POST | `/api/sessions/:id/resume` | 恢复非活跃会话 |
| POST | `/api/sessions/:id/upload` | 上传文件（base64，max 50MB） |
| POST | `/api/sessions/:id/upload/delete` | 删除上传文件 |
| POST | `/api/sessions/:id/archive` | 归档活跃会话 |
| GET | `/api/sessions/:id/slash-commands` | 列出斜杠命令 |
| GET | `/api/sessions/:id/skills` | 列出 Skills |
| POST | `/api/sessions/:id/permission-mode` | 设置权限模式 |
| POST | `/api/sessions/:id/model` | 设置模型偏好 |
| POST | `/api/sessions/:id/effort` | 设置 Claude effort 偏好 |

### 消息 (`src/web/routes/messages.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/:id/messages` | 获取消息（分页） |
| POST | `/api/sessions/:id/messages` | 发送消息 |

### 权限 (`src/web/routes/permissions.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions/:id/permissions/:requestId/approve` | 批准权限请求 |
| POST | `/api/sessions/:id/permissions/:requestId/deny` | 拒绝权限请求 |

### Git (`src/web/routes/git.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/:id/git-status` | Git 状态 |
| GET | `/api/sessions/:id/git-diff-numstat` | Diff 摘要 |
| GET | `/api/sessions/:id/git-diff-file` | 文件 Diff |
| GET | `/api/sessions/:id/file` | 读取文件内容 |
| GET | `/api/sessions/:id/files` | 文件搜索（ripgrep） |

### 机器 (`src/web/routes/machines.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/machines` | 列出在线机器 |
| POST | `/api/machines/:id/spawn` | 在机器上启动新会话 |
| POST | `/api/machines/:id/paths/exists` | 检查路径是否存在 |

### 事件 (`src/web/routes/events.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/events` | SSE 实时推送流 |
| POST | `/api/visibility` | 报告客户端可见性状态 |

### 插件 (`src/web/routes/plugins.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/:id/plugins` | 列出会话插件 |
| POST | `/api/sessions/:id/plugins/install` | 安装插件 |
| DELETE | `/api/sessions/:id/plugins/:pluginId` | 卸载插件 |
| GET | `/api/sessions/:id/plugins/:pluginId/storage` | 获取插件存储 |
| POST | `/api/sessions/:id/plugins/:pluginId/storage` | 设置插件存储 |
| DELETE | `/api/sessions/:id/plugins/:pluginId/storage/:key` | 删除插件存储 |

### Skill 管理 (`src/web/routes/skillManagement.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/:id/skills/search` | 搜索 Skills（skills.sh） |
| POST | `/api/sessions/:id/skills/install` | 安装 Skill |
| DELETE | `/api/sessions/:id/skills/:name` | 卸载 Skill |

### 变更追踪 (`src/web/routes/changeTracking.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/:id/changes` | 获取文件变更列表（按组） |
| POST | `/api/sessions/:id/changes/:changeId/review` | 审查单条变更 |
| POST | `/api/sessions/:id/changes/bulk-review` | 批量审查变更 |
| GET | `/api/sessions/:id/context` | 获取上下文状态 |

### 时间线 (`src/web/routes/timeline.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/:id/timeline` | 获取操作时间线 |
| GET | `/api/sessions/:id/summaries` | 获取会话摘要 |
| POST | `/api/sessions/:id/checkpoints` | 创建检查点 |
| GET | `/api/sessions/:id/checkpoints` | 获取检查点列表 |

### 撤销 (`src/web/routes/undo.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions/:id/undo/preview` | 撤销影响预览 |
| POST | `/api/sessions/:id/undo/execute` | 执行撤销 |
| GET | `/api/sessions/:id/snapshots` | 获取快照列表 |

### 分享 (`src/web/routes/share.ts`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/sessions/:id/shares` | 需要 | 创建分享链接 |
| GET | `/api/sessions/:id/shares` | 需要 | 列出分享 |
| DELETE | `/api/shares/:shareId` | 需要 | 删除分享 |
| GET | `/api/s/:shareId` | 无 | 公开访问分享内容 |

### 推送通知 (`src/web/routes/push.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/push/vapid-public-key` | 获取 VAPID 公钥 |
| POST | `/api/push/subscribe` | 订阅推送 |
| DELETE | `/api/push/subscribe` | 取消订阅 |

### 语音 (`src/web/routes/voiceTranscription.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/voice/transcribe` | Whisper 语音转录 |

### 编排 (`src/web/routes/orchestration.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/orchestration/skills` | 列出编排 Skill |
| GET | `/api/orchestration/skills/:id` | 获取编排 Skill 详情 |

### CLI 内部 (`src/web/routes/cli.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/cli/sessions` | 创建/加载会话 |
| GET | `/cli/sessions/:id` | 按 ID 获取会话 |
| POST | `/cli/machines` | 创建/加载机器 |
| GET | `/cli/machines/:id` | 按 ID 获取机器 |

## Socket.IO

### `/cli` 命名空间（CLI → Hub）

认证方式：CLI API Token

**客户端事件：**

| 事件 | 说明 |
|------|------|
| `message` | 发送消息到会话 |
| `update-metadata` | 更新会话元数据（带版本号） |
| `update-state` | 更新代理状态（带版本号） |
| `session-alive` | 保持会话活跃 |
| `session-end` | 标记会话结束 |
| `machine-alive` | 保持机器在线 |
| `rpc-register` | 注册 RPC 处理器 |
| `rpc-unregister` | 注销 RPC 处理器 |

**Hub 事件：**

| 事件 | 说明 |
|------|------|
| `update` | 广播会话/消息更新 |
| `rpc-request` | 发起 RPC 调用 |

### `/terminal` 命名空间（Web → Hub）

认证方式：JWT

| 事件 | 说明 |
|------|------|
| `terminal:create` | 创建 PTY 会话 |
| `terminal:write` | 发送终端输入 |
| `terminal:resize` | 调整终端尺寸 |
| `terminal:close` | 关闭终端 |
| `terminal:output` | 终端输出（Hub → Web） |
| `image:upload` | 二进制图片上传（meta + Buffer） |

## 源码结构

```
src/
├── web/              HTTP 服务和路由
│   ├── routes/       REST API 端点（25 个文件）
│   └── server.ts     Hono 应用注册
├── socket/           Socket.IO 服务
│   ├── server.ts     Socket.IO 服务器
│   └── handlers/     事件处理器
│       ├── cli/      /cli 命名空间处理
│       ├── terminal.ts  /terminal PTY 处理
│       └── image.ts  图片二进制上传
├── sync/             核心逻辑
│   ├── syncEngine.ts    会话/消息管理
│   ├── sessionCache.ts  内存缓存 + 版本控制
│   ├── messageService.ts 消息处理
│   └── rpcGateway.ts    RPC 路由
├── store/            SQLite 持久化
│   ├── db.ts         数据库迁移（V10+）
│   └── index.ts      Store 接口
├── sse/              Server-Sent Events
├── config/           配置加载、令牌生成
├── notifications/    Web Push 通知
├── visibility/       客户端可见性追踪
├── git/              Git 操作（isomorphic-git）
├── pty/              PTY 管理（node-pty）
├── plugins/          插件系统
├── eventBus.ts       EventBus 事件总线
└── startHub.ts       启动入口
```
