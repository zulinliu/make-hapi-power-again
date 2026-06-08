[English](./README.md) | [中文](./README.zh-CN.md)

<p align="center">
  <img src="docs/assets/logo-lockup.svg" alt="Hapi Power" width="400">
</p>

<p align="center">
  <strong>随时AI，编程自在 — 一个工作台，驾驭所有 AI 编程 Agent。</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/tag/zulinliu/make-hapi-power-again" alt="version">
  <img src="https://img.shields.io/github/license/zulinliu/make-hapi-power-again" alt="license">
  <img src="https://img.shields.io/github/stars/zulinliu/make-hapi-power-again" alt="stars">
</p>

<p align="center">
  <a href="#为什么选择-hapi-power">为什么</a> ·
  <a href="#hapi-power-五节点工作流">五节点工作流</a> ·
  <a href="#功能特色">功能</a> ·
  <a href="#安装">安装</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#架构">架构</a> ·
  <a href="./CHANGELOG.md">更新日志</a>
</p>

---

## 为什么选择 Hapi Power?

大多数 AI 编码工具把你锁定在一个代理、一个终端、一台机器上。Hapi Power 提供统一工作台，让你在 Claude Code、Codex、Gemini 等代理间自由切换——随时随地，任意设备。

Hapi Power 把 AI 编码对话变成可驾驶、可观测、可复盘的工程闭环：接入可信模型，工作中即时纠偏，观察上下文风险，追踪每次代码变化，并把会话沉淀为项目记忆。

**在手机上编程。** 滑动屏幕审批 AI 代理的代码变更，监控终端输出，通过或驳回文件编辑——全部在手机上完成，无需电脑。

**浏览器中的完整开发套件。** 模型星桥、引导光标、上下文脉冲、Git 脉络、会话织锦、全功能文件操作、Monaco 代码编辑器和终端访问。与 AI 代理协作编码所需的一切，一个地方搞定。

**秒级部署到任意服务器。** 单文件、零依赖。自建部署到任何服务器，或一条命令本地运行。

---

## Hapi Power 五节点工作流

1. **接入**：模型星桥连接可信模型通道，检测健康与能力，并为每个 Agent 分配合适模型。
2. **驾驶**：引导光标让你在 Agent 工作中即时纠偏，同时保留普通消息队列。
3. **观测**：上下文脉冲用 `上下文：40%` 一眼提示可靠性风险，并解释不可用原因。
4. **追踪**：Git 脉络把分支状态、Agent 改动、Diff、提交篮和远端同步风险放在一张 Git 地图里。
5. **沉淀**：会话织锦把对话转成 Markdown 导出、决策记录、偏差检查和可复用项目记忆。

---

## 截图

<p align="center">
  <img src="docs/assets/screenshot-desktop.png" alt="桌面端：登录页" width="720">
</p>

<table align="center">
  <tr>
    <td align="center"><b>会话列表</b></td>
    <td align="center"><b>新建会话 — 选择 AI 代理</b></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshot-sessions.png" alt="会话列表" width="360"></td>
    <td><img src="docs/assets/screenshot-new-session.png" alt="多代理选择" width="360"></td>
  </tr>
  <tr>
    <td align="center"><b>设置与模型星桥</b></td>
    <td align="center"><b>暗色模式</b></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshot-settings.png" alt="模型星桥供应商配置" width="360"></td>
    <td><img src="docs/assets/screenshot-dark.png" alt="暗色模式" width="360"></td>
  </tr>
</table>

<p align="center">
  <img src="docs/assets/screenshot-mobile.png" alt="移动端：登录" height="360">
  &nbsp;&nbsp;
  <img src="docs/assets/screenshot-mobile-sessions.png" alt="移动端：会话" height="360">
</p>

<table align="center">
  <tr>
    <td align="center"><b>接入：模型星桥</b></td>
    <td align="center"><b>驾驶：引导光标</b></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshot-model-nexus.png" alt="模型星桥健康状态、能力摘要和 Agent 分配矩阵" width="360"></td>
    <td><img src="docs/assets/screenshot-guide-beam.png" alt="移动端引导光标排队和立即引导模式" width="240"></td>
  </tr>
  <tr>
    <td align="center"><b>观测：上下文脉冲</b></td>
    <td align="center"><b>追踪：Git 脉络</b></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshot-context-pulse.png" alt="上下文脉冲显示上下文 40% 和用量诊断" width="360"></td>
    <td><img src="docs/assets/screenshot-git-atlas.png" alt="Git 脉络分支态势、变更地图、Diff 预览、提交篮和同步中心" width="360"></td>
  </tr>
</table>

<p align="center">
  <b>沉淀：会话织锦</b><br>
  <img src="docs/assets/screenshot-session-loom.png" alt="会话织锦移动端导出预览和脱敏状态" height="360">
</p>

---

## 功能特色

**模型星桥（Model Nexus）** — 统一接入 Anthropic/OpenAI/Gemini/自定义兼容供应商，自动检测模型、延迟、usage 与上下文能力，并为每个 Agent 分配默认模型通道。

**引导光标（Guide Beam）** — Agent 正在工作时，继续输入默认排队；发现理解偏差时可切换“立即引导”，优先送达纠偏，同时保留会话和队列。

**上下文脉冲（Context Pulse）** — 用 `上下文：40%` 这样的短标签显示上下文占用，低于 60% 绿色，60–80% 黄色，高于 80% 红色，并提供不可用诊断。

**Git 脉络（Git Atlas）** — 在会话中用一张 Git 地图查看分支、Agent 改动、Diff、提交篮和远端同步风险；从手机也能完成检查、提交和同步。

**会话织锦（Session Loom）** — 将“大纲”升级为会话资产工作台，一键导出完整对话 Markdown，过滤噪音，生成设计方案、PRD、决策日志、偏差检查和经验卡。

**移动端优先 PWA** — 响应式移动端 UI、点击和长按手势审批变更、只读终端、针对 iOS 深度优化 PWA 体验。随时随地用手机审批 AI 代理的代码变更。

**单文件部署** — 构建产物为内嵌 Web 资源的自包含可执行文件——一个文件即完整平台，零外部依赖，秒级部署到任意服务器。

<details>
<summary><strong>查看完整功能列表</strong></summary>

### AI 工作流

**引导光标** — Composer 发送模式区分普通排队和立即引导；不支持或旧版 Agent 会自动降级排队，不会丢消息。

**上下文脉冲** — 实时上下文占用按已用百分比展示，不再使用旧的余量文案；弹层展示来源、used/max、模型、缓存和不可用原因。

**会话织锦** — 服务端大纲和导出读取完整会话历史，默认开启敏感信息脱敏，并提供复制、下载和系统分享兜底。

### 平台特色

**模型星桥** — 配置第三方 API 端点，通过安全健康检测自动发现模型、缓存能力，并按会话或代理类型绑定 Provider。API 密钥以 AES-256-GCM 加密存储。

**Git 脉络** — 结构化 Git dashboard、Diff preview、Commit Basket、Sync Center、选中文件提交和危险操作服务端确认。

**文件管理** — 在浏览器中浏览目录树，新建、重命名、移动、复制、上传、下载、搜索文件，并用 Monaco 预览和编辑。

**权限模式** — 每种代理支持独立的权限模式。Claude：default、acceptEdits、bypassPermissions、plan。Codex/Gemini/Kimi：default、read-only、safe-yolo、yolo。Cursor：default、plan、ask、yolo。OpenCode：default、plan、yolo。

**移动端优先 PWA** — 响应式移动端 UI，点击和长按手势审批变更，只读终端，针对 iOS 深度优化 PWA 体验，支持安装引导和离线访问。

**加密中继** — 安全隧道用于 CLI 到 Hub 的远程连接。通过 `hub --relay` 参数启动，零配置安全远程访问。

**单文件部署** — 构建产物为内嵌 Web 资源的自包含可执行文件，支持 macOS（ARM/x64）、Linux（ARM/x64）、Windows 跨平台构建。

**国际化** — 完整中英文界面支持，在设置中一键切换语言。

### 聊天体验

**富消息渲染** — 完整 Markdown 渲染，支持 GitHub Flavored Markdown、Mermaid 图表、KaTeX 数学公式、Shiki 代码语法高亮。

**图片粘贴与拖拽** — 直接粘贴或拖拽图片到聊天，AI 代理将接收图片进行视觉分析和代码生成。

**Slash 命令自动补全** — 每种代理的内置命令（`/compact`、`/clear`、`/plan`、`/stats` 等）支持内联自动补全。

**Skill 与插件管理** — 浏览和搜索 skills.sh 市场，按会话安装或卸载 Skill。管理插件——一切在浏览器中完成，轻松扩展 AI 代理的能力。

</details>

---

## 安装

### 下载可执行文件（推荐）

从 [GitHub Releases](https://github.com/zulinliu/make-hapi-power-again/releases) 下载最新版本。

### Homebrew（macOS / Linux）— 即将支持

<!-- ```bash
brew tap zulinliu/hapi-power
brew install hapi-power
``` -->

### 从源码构建

前置条件：[Bun](https://bun.sh) >= 1.0，Node.js >= 18

```bash
git clone https://github.com/zulinliu/make-hapi-power-again.git
cd make-hapi-power-again
bun install
```

---

## 快速开始

### 1. 启动 Hub

```bash
bun run dev
```

Hub API 监听 `http://localhost:3016`，Web UI 监听 `http://localhost:5173`（Vite 开发服务器）。

### 2. 连接 AI 代理

```bash
# Claude Code（默认）
hapi-power claude

# OpenAI Codex
hapi-power codex

# Google Gemini
hapi-power gemini

# 启动 E2E 加密中继 Hub
hapi-power hub --relay
```

### 3. 打开浏览器

桌面端访问 `http://localhost:5173`，或在手机上打开同一地址，随时随地编程。生产模式（单文件部署）下，Web UI 由 Hub 直接提供，访问端口 `3016`。

### 4. 构建单文件可执行程序

```bash
bun run build:single-exe
```

---

## 使用说明

### CLI 命令

| 命令 | 说明 |
|------|------|
| *（默认）* | 使用 Claude Code 连接到 Hub |
| `codex` | 启动 Codex 模式 |
| `gemini` | 启动 Gemini 模式 |
| `cursor` | 启动 Cursor Agent 模式 |
| `opencode` | 启动 OpenCode 模式 |
| `kimi` | 启动 Kimi 模式 |
| `hub` / `server` | 启动 Hub 服务器 |
| `hub --relay` | 启动带加密中继的 Hub |
| `runner start` | 启动后台 Runner 守护进程 |
| `resume` | 恢复之前的会话 |
| `doctor` | 运行诊断检查 |
| `mcp` | MCP 服务器管理 |
| `auth` | 管理认证 |

### 环境变量

**Hub：**

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `HAPI_POWER_LISTEN_PORT` | Hub 监听端口 | `3016` |
| `HAPI_POWER_LISTEN_HOST` | Hub 监听地址 | `127.0.0.1` |
| `CLI_API_TOKEN` | CLI 和 Web 认证的共享密钥 | 自动生成 |
| `HAPI_POWER_HOME` | 数据存储目录 | `~/.hapi-power` |
| `CORS_ORIGINS` | CORS 允许的来源（逗号分隔） | — |
| `HAPI_POWER_PUBLIC_URL` | 外部访问的公网 URL | `http://localhost:{port}` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API 令牌（用于认证） | — |
| `VAPID_SUBJECT` | Web Push 联系方式（邮箱或 URL） | `mailto:admin@YOUR_DOMAIN` |
| `HAPI_POWER_RELAY_API` | 加密中继 API 域名 | `YOUR_RELAY_DOMAIN` |
| `HAPI_POWER_RELAY_AUTH` | 中继认证密钥 | — |

**CLI：**

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `HAPI_POWER_API_URL` | Hub 地址 | `http://localhost:3016` |
| `CLI_API_TOKEN` | CLI 认证令牌 | 自动生成 |
| `HAPI_POWER_HOME` | 数据存储目录 | `~/.hapi-power` |
| `ANTHROPIC_API_KEY` | Claude API 密钥 | — |
| `OPENAI_API_KEY` | OpenAI API 密钥（Codex、Whisper） | — |

### 模型星桥

在设置 → 模型星桥中配置第三方 API 提供方：

1. 添加 Provider：填写 namespace、协议、Base URL 和 API Key
2. 运行健康与能力检测，发现模型、usage 支持、上下文窗口和延迟
3. 将 Provider 与默认模型分配给代理类型（Claude、Codex、Gemini 等）
4. 创建或控制会话时选择对应的模型通道

API 密钥使用 AES-256-GCM 加密，永远不会明文存储。

---

## 架构

```
┌─────────┐  Socket.IO(/cli)  ┌──────────────────┐  REST/SSE  ┌─────────┐
│   CLI   │ ────────────────  │       Hub        │ ────────── │   Web   │
│ (代理)   │                   │ (Hono + Socket.IO)│  Socket.IO │ (React) │
└─────────┘                   └──────────────────┘            └─────────┘
    │                               │       │                       │
    ├─ 代理封装                      ├─ SQLite 持久化               ├─ TanStack Router
    │  (Claude/Codex/Gemini/        ├─ 会话缓存                    ├─ TanStack Query
    │   OpenCode/Cursor/Kimi)       ├─ RPC 网关                    ├─ Monaco Editor
    ├─ Socket.IO 客户端             ├─ 推送通知                     ├─ xterm.js
    └─ RPC 处理器                    └─ EventPublisher             └─ Socket.IO 客户端
```

三层 Monorepo 架构，通过 Socket.IO 和 REST/SSE 连接：

1. **CLI** 启动 AI 代理进程，通过 Socket.IO `/cli` 命名空间连接 Hub
2. **Hub** 持久化数据到 SQLite，通过 SSE 广播事件，路由 RPC 调用
3. **Web** 订阅 SSE 接收实时更新，使用 Socket.IO 传输终端和二进制数据，通过 Hub REST API 发送用户操作

---

## 技术栈

| 层 | 技术 |
|----|------|
| 运行时 | [Bun](https://bun.sh) |
| 后端 | [Hono](https://hono.dev) + Socket.IO + bun:sqlite |
| 前端 | [React 19](https://react.dev) + TanStack Router + TanStack Query + Tailwind CSS |
| 代码编辑 | Monaco Editor + Shiki |
| 终端 | xterm.js + Bun.Subprocess |
| Git | 系统 `git` CLI via RPC |
| 验证 | Zod |
| 构建 | Vite + Bun |
| 实时通信 | Socket.IO + SSE |

---

## 文档

- [CLI 参考](./cli/README.md) — 命令、配置、代理设置
- [Hub API 参考](./hub/README.md) — REST 端点、Socket.IO 事件
- [Web 架构](./web/README.md) — 路由、组件、数据流
- [AGENTS.md](./AGENTS.md) — 贡献者和 AI 代理的开发指南

---

## 贡献

欢迎贡献！详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

贡献即表示你同意代码以 AGPL-3.0 许可证发布，并确认你有权在该许可证下提交代码。

---

## 许可证

Hapi Power 基于 [AGPL-3.0](./LICENSE) 许可证开源：

- **免费使用** — 自行部署、修改、用于任何目的
- **你的代码归你** — 你自己项目的代码不受此许可证影响；使用 Hapi Power 开发项目不会改变你项目的许可证
- **共享改进** — 如果你修改了 Hapi Power 并以网络服务形式提供，需在相同许可证下共享修改

---

## 致谢

Hapi Power 是 [hapi](https://github.com/nicepkg/hapi) 项目的修改版本，感谢 nicepkg 团队在代理通信协议和 Web UI 方面的出色工作。

CLI 模块包含源自 [happy-cli](https://github.com/slopus/happy-cli)（作者 Kirill Dubovitskiy，MIT 许可证）的代码。
