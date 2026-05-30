# CLI

Hapi Power 命令行工具 — 封装多种 AI 编码代理，连接到 Hub 实现远程管理和多端协同。

## 功能

- 封装 6 种 AI 代理：Claude Code、Codex、Cursor Agent、Gemini、OpenCode、Kimi
- Socket.IO 客户端连接到 Hub
- 51 个 RPC 方法供 Hub 远程调用
- 后台 Runner 守护进程
- MCP stdio 桥接
- 诊断和认证工具

## 命令

### 代理会话

| 命令 | 说明 |
|------|------|
| `hapi` | 启动 Claude Code 会话 |
| `hapi codex` | 启动 Codex 模式 |
| `hapi codex resume <sessionId>` | 恢复 Codex 会话 |
| `hapi cursor` | 启动 Cursor Agent 模式 |
| `hapi gemini` | 启动 Gemini 模式（远程模式） |
| `hapi opencode` | 启动 OpenCode 模式 |
| `hapi kimi` | 启动 Kimi 模式 |
| `hapi resume [sessionId]` | 列出/恢复可恢复会话 |

### 认证

| 命令 | 说明 |
|------|------|
| `hapi auth status` | 显示认证配置 |
| `hapi auth login` | 交互式输入令牌 |
| `hapi auth logout` | 清除凭据 |
| `hapi connect` | 连接到 Hub |

### Runner 管理

| 命令 | 说明 |
|------|------|
| `hapi runner start` | 启动 Runner 守护进程 |
| `hapi runner stop` | 停止 Runner |
| `hapi runner status` | Runner 状态诊断 |
| `hapi runner list` | 列出活跃会话 |
| `hapi runner stop-session <id>` | 终止指定会话 |
| `hapi runner logs` | 日志路径 |

`runner start` 接受 `--workspace-root <path>` 参数（可重复），限定 Web 文件浏览范围。

### 其他

| 命令 | 说明 |
|------|------|
| `hapi hub` | 启动捆绑的 Hub |
| `hapi server` | `hapi hub` 别名 |
| `hapi mcp` | MCP stdio 桥接 |
| `hapi doctor` | 完整诊断信息 |
| `hapi doctor clean` | 清理残留进程 |
| `hapi notify` | 发送测试通知 |
| `hapi hookForwarder` | Hook 事件转发 |

## 配置

### 必需

| 变量 | 说明 |
|------|------|
| `CLI_API_TOKEN` | 共享密钥，必须与 Hub 匹配 |

### 可选

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `HUB_URL` / `HAPI_API_URL` | Hub 地址 | `http://localhost:3000` |
| `HAPI_HOME` | 配置/数据目录 | `~/.hapi` |
| `HAPI_CLAUDE_PATH` | 指定 claude 可执行文件路径 | PATH 中的 `claude` |
| `HAPI_EXTRA_HEADERS_JSON` | 额外 HTTP 头 | - |
| `HAPI_HTTP_MCP_URL` | 默认 MCP 目标 | - |
| `ANTHROPIC_API_KEY` | Claude API 密钥 | - |

### Runner

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `HAPI_RUNNER_HEARTBEAT_INTERVAL` | 心跳间隔（ms） | `60000` |
| `HAPI_RUNNER_HTTP_TIMEOUT` | HTTP 超时（ms） | `10000` |

## 典型流程

1. 启动 Hub：`hapi hub`
2. 设置 CLI_API_TOKEN（环境变量或 `hapi auth login`）
3. 启动代理：`hapi`（Claude Code）、`hapi codex` 等
4. 在 Web 或移动端监控和操控

## 数据存储

`~/.hapi/` 目录（或 `$HAPI_HOME`）：

- `settings.json` — 用户设置（machineId、token）
- `runner.state.json` — Runner 状态（pid、port、heartbeat）
- `logs/` — 日志文件

## 依赖

- Claude CLI（`claude` 在 PATH 中）用于 Claude Code 模式
- Cursor Agent CLI（`agent` 在 PATH 中）用于 Cursor 模式
- Bun 用于从源码构建

## 源码结构

```
src/
├── commands/          CLI 子命令
│   ├── registry.ts    命令注册表
│   ├── auth.ts        认证命令
│   ├── claude.ts      Claude 子命令
│   ├── codex.ts       Codex 子命令
│   ├── cursor.ts      Cursor 子命令
│   ├── gemini.ts      Gemini 子命令
│   ├── kimi.ts        Kimi 子命令
│   ├── opencode.ts    OpenCode 子命令
│   ├── runner.ts      Runner 命令
│   ├── hub.ts         Hub 命令
│   ├── mcp.ts         MCP 桥接
│   ├── doctor.ts      诊断命令
│   └── notify.ts      通知命令
├── api/               Hub 通信（Socket.IO + REST）
├── claude/            Claude Code 集成
├── codex/             Codex 模式集成
├── cursor/            Cursor Agent 集成
├── gemini/            Gemini 集成（ACP）
├── kimi/              Kimi 集成
├── opencode/          OpenCode 集成
├── agent/             多代理通用支持
├── runner/            后台守护进程
├── modules/           工具实现（ripgrep、difftastic、git）
├── parsers/           输出解析器
├── ui/                终端 UI（Ink 组件）
├── bootstrap.ts       启动入口
├── configuration.ts   配置加载
├── persistence.ts     设置持久化
└── lib.ts             公共工具
```
