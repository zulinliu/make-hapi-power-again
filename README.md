# Hapi Power

基于 [hapi](https://github.com/twsxtd/hapi) (AGPL-3.0) 的 AI 编码代理全栈开发者工作台。在浏览器中管理 Git、终端、文件编辑、AI 代理会话，支持桌面和移动端。

## 功能

### 核心能力

- **多代理支持** — Claude Code、Codex、Gemini、OpenCode、Cursor Agent、Kimi，统一工作流
- **Git 可视化管理** — 状态查看、提交历史、分支管理、Diff 对比，浏览器内完成
- **PTY 终端** — xterm.js 全功能终端，多会话、分屏、二进制帧传输
- **文件管理 + 代码编辑** — 文件树浏览、拖放操作、Monaco Editor 代码编辑、大文件 Shiki 预览
- **扩展系统** — 插件加载、Skill 管理（skills.sh）、Claude Plugin 市场

### AI 工作流增强

- **变更审查** — 代理文件变更按对话分组，逐文件 approve/reject
- **操作时间线** — 完整操作审计，按类型/结果过滤
- **撤销变更** — 会话/步骤/文件三种粒度回滚，支持重做
- **上下文管理** — 实时用量可视化，压缩通知

### 多端体验

- **移动端速览** — `/m/*` 路由，swipe 手势审批，只读终端
- **会话分享** — 匿名可访问的分享链接，支持范围/时效控制
- **PWA 推送** — Web Push API 代理审批通知
- **语音控制** — 录音转文字（Whisper API），对话式交互
- **白板工具** — Canvas 绘图，直接发送给代理

## 架构

```
┌─────────┐  Socket.IO(/cli)  ┌──────────────────┐  REST/SSE  ┌─────────┐
│   CLI   │ ────────────────  │       Hub        │ ────────── │   Web   │
│ (代理)   │                   │ (Hono + Socket.IO)│             │ (React) │
└─────────┘                   └──────────────────┘             └─────────┘
    │                               │      │                        │
    ├─ 封装 Claude/Codex 等          ├─ SQLite 持久化              ├─ TanStack Router
    ├─ Socket.IO 客户端              ├─ 会话缓存                   ├─ TanStack Query
    └─ RPC 处理器                    ├─ RPC 网关                   ├─ Monaco Editor
                                    ├─ 推送通知                    ├─ xterm.js
                                    └─ 事件总线                    └─ Socket.IO 客户端
```

**Socket.IO 命名空间：**
- `/cli` — CLI 代理连接，CLI API Token 认证
- `/terminal` — Web 终端连接，JWT 认证，同时处理图片二进制上传

**数据流：**
1. CLI 启动代理进程，通过 Socket.IO `/cli` 连接到 Hub
2. 代理事件 → CLI → Hub → SQLite + SSE 广播
3. Web 订阅 SSE `/api/events`，接收实时更新
4. 用户操作 → Web → Hub REST API → RPC 到 CLI → 代理

## 技术栈

| 层 | 技术 |
|----|------|
| 运行时 | [Bun](https://bun.sh) |
| 后端 | Hono + Socket.IO + better-sqlite3 |
| 前端 | React + TanStack Router + TanStack Query + Tailwind CSS |
| 代码编辑 | Monaco Editor + Shiki |
| 终端 | xterm.js + node-pty |
| Git | isomorphic-git |
| 验证 | Zod |
| 构建 | Vite + Bun |
| 设计风格 | Cursor + Linear 融合 |

## 快速开始

### 安装

```bash
git clone <repo-url> && cd make-hapi-power-again
bun install
```

### 开发

```bash
bun run dev          # 启动 Hub + Web 开发服务器
```

Hub 默认监听 `http://localhost:3000`，Web 默认监听 `http://localhost:5173`。

### CLI 使用

```bash
bun run --cwd cli start hub              # 连接到 Hub
bun run --cwd cli start hub --relay      # 通过 E2E 加密中继连接
bun run --cwd cli start codex            # 启动 Codex 模式
bun run --cwd cli start gemini           # 启动 Gemini 模式
```

### 构建

```bash
bun run build:single-exe   # 构建全功能单文件可执行程序
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `bun run dev` | 启动 Hub + Web 开发服务器 |
| `bun run typecheck` | 全包类型检查 |
| `bun run test` | 运行所有测试 |
| `bun run build` | 构建所有包 |
| `bun run build:single-exe` | 构建单文件可执行程序 |

## 环境变量

### Hub

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | Hub 监听端口 | `3000` |
| `HUB_TOKEN` | Hub 认证令牌 | - |
| `OPENAI_API_KEY` | Whisper 语音转录 | - |
| `VAPID_PUBLIC_KEY` | Web Push 公钥 | - |
| `VAPID_PRIVATE_KEY` | Web Push 私钥 | - |
| `ALLOWED_ORIGINS` | CORS 允许的来源 | - |
| `DATA_DIR` | 数据存储目录 | `~/.hapi` |

### CLI

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `HUB_URL` | Hub 地址 | `http://localhost:3000` |
| `CLI_API_TOKEN` | CLI 认证令牌 | 自动生成 |
| `ANTHROPIC_API_KEY` | Claude API 密钥 | - |

## 项目结构

```
make-hapi-power-again/
├── cli/        CLI 二进制，代理封装，runner 守护进程
├── hub/        HTTP API + Socket.IO + SSE + 推送通知
├── web/        React PWA 前端
├── shared/     共享类型、Schema、工具函数
├── docs/       v0.1 设计文档（保留不变）
└── .planning/  GSD 项目管理文档
```

## 致谢

Hapi Power 基于 [hapi](https://github.com/twsxtd/hapi) 项目开发。感谢 hapi 团队提供的优秀基础。

hapi 原始名称含义："哈皮"，中文音译自 [Happy](https://github.com/slopus/happy)。

## 许可证

本项目继承上游 [AGPL-3.0](LICENSE) 许可证。
