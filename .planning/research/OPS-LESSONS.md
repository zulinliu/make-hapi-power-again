# 运维踩坑记录：http_proxy 导致 Runner 502 + 机器注册全流程

> 日期: 2026-05-31
> 版本: v0.4 验证阶段
> 影响: 无法创建会话、机器名称异常、目录浏览不可用

## 事故现象

在 v0.4 开发完成后进行真机验证时，发现三个连锁问题：

1. **创建会话报错**: `Directory is outside this machine's workspace roots`
2. **机器名称显示异常**: 下拉框显示 UUID 前 8 位而非主机名
3. **目录浏览功能缺失**: 新建会话时没有"浏览"按钮选文件夹

## 根因分析

### 根因 1: http_proxy 导致 Runner 注册 502

**环境**: 本机配置了 `http_proxy=http://172.30.1.62:7890` 用于外网访问

**机制**: CLI runner 使用 axios 发送 HTTP 请求注册机器到 hub。axios 会读取 `http_proxy` / `https_proxy` 环境变量，自动通过代理转发所有 HTTP 请求，包括对 `localhost:3206` 的请求。

**结果**: 代理服务器无法正确转发 localhost 请求，返回 HTTP 502 Bad Gateway。Runner 持续重试（最多 60 次，指数退避 1s~30s），始终失败。

**修复**: 启动 runner 时设置 `NO_PROXY=localhost,127.0.0.1`:

```bash
NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 \
  hapi-power runner start --workspace-root /home/liuzl
```

### 根因 2: 机器 metadata 为 null（数据库残留）

**场景**: 在排查过程中，先用 curl 手动测试了 `POST /cli/machines` 创建了一条空 metadata 的机器记录。

**机制**: hub 的 `getOrCreateMachine` 实现是 get-OR-create，不是 upsert。一旦机器记录存在，后续注册请求不会更新 metadata 字段。

**结果**: Runner 成功注册后，hub 返回的是之前创建的空 metadata 记录。前端 `MachineSelector` 组件读取 `metadata.host` 显示机器名，metadata 为 null 时回退到 `machine.id.slice(0, 8)`（UUID 前 8 位）。

**修复**: 清理 SQLite 数据库中残留记录，重启 hub + runner。

### 根因 3: workspace root 过窄

**场景**: 首次启动 runner 时使用 `--workspace-root /home/liuzl/agent/make-hapi-power-again/make-hapi-power-again`（项目子目录）。

**机制**: hub 在创建会话时会验证目录是否在机器的 `workspaceRoots` 范围内。超出范围的目录被拒绝。

**结果**: 用户尝试在任何其他目录创建会话时都被拒绝。

**修复**: 使用更宽的 workspace root: `--workspace-root /home/liuzl`。

## 完整的服务启动流程（正确版）

### 前置条件

- 确认官方 hapi 服务运行在 3006 端口（不要冲突）
- hapi-power 使用独立数据目录 `~/.hapi-power`

### 环境变量清单

| 变量 | 值 | 用途 |
|------|-----|------|
| `HAPI_POWER_HOME` | `~/.hapi-power` | hapi-power 数据目录 |
| `HAPI_POWER_LISTEN_PORT` | `3206` | hub 监听端口 |
| `HAPI_POWER_LISTEN_HOST` | `0.0.0.0` | hub 监听地址 |
| `HAPI_POWER_API_URL` | `http://localhost:3206` | CLI 连接 hub 的 URL |
| `NO_PROXY` | `localhost,127.0.0.1` | 防止代理拦截本机请求 |
| `VITE_HUB_PROXY` | `http://127.0.0.1:3206` | web dev server 代理目标 |

### 启动顺序

```bash
PROJECT_DIR=/home/liuzl/agent/make-hapi-power-again/make-hapi-power-again
cd $PROJECT_DIR

# 1. 启动 Hub
HAPI_POWER_HOME=~/.hapi-power \
HAPI_POWER_LISTEN_PORT=3206 \
HAPI_POWER_LISTEN_HOST=0.0.0.0 \
bun run dev:hub

# 2. 启动 Web Dev Server（新终端）
VITE_HUB_PROXY=http://127.0.0.1:3206 \
bun run dev:web

# 3. 启动 CLI Runner（新终端）
HAPI_POWER_HOME=~/.hapi-power \
HAPI_POWER_API_URL=http://localhost:3206 \
NO_PROXY=localhost,127.0.0.1 \
no_proxy=localhost,127.0.0.1 \
bun run cli/src/index.ts runner start \
  --workspace-root /home/liuzl

# 4. 确认验证
# - 浏览器访问 http://172.30.1.63:5173
# - 登录 token: 见 ~/.hapi-power/settings.json -> cliApiToken
# - 创建会话: 机器下拉应显示主机名，目录浏览应可用
```

### 验证清单

- [ ] Hub 启动: `curl -s http://127.0.0.1:3206/` 返回 HTML
- [ ] Runner 注册: 日志中看到 `Machine registered: <uuid>`
- [ ] 机器在线: API 返回 `active: true`, metadata 非 null
- [ ] 机器名正确: 前端下拉显示主机名而非 UUID
- [ ] 目录浏览: 新建会话可浏览文件系统
- [ ] 会话创建: 可在任意 workspace root 内目录创建会话

## 关键代码路径

| 环节 | 文件 | 说明 |
|------|------|------|
| Runner 注册 | `cli/src/runner/run.ts:692` | `api.getOrCreateMachine()` with retry |
| API 请求 | `cli/src/api/api.ts:160` | axios.post, 受 http_proxy 影响 |
| Hub CLI 路由 | `hub/src/web/routes/cli.ts` | `/cli/machines` 端点 |
| 机器存储 | `hub/src/store/machines.ts:37` | getOrCreateMachine: get-OR-create 非 upsert |
| 机器名显示 | `web/src/components/NewSession/MachineSelector.tsx:4` | metadata?.host fallback to id.slice(0,8) |
| Workspace 校验 | `hub/src/web/routes/machines.ts` | spawn 时验证目录在 workspaceRoots 内 |

## 防范措施

### 1. Runner 启动脚本

在项目根目录提供启动脚本，内置 NO_PROXY:

```bash
# scripts/start-runner.sh
#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export HAPI_POWER_HOME="${HAPI_POWER_HOME:-$HOME/.hapi-power}"
export HAPI_POWER_API_URL="${HAPI_POWER_API_URL:-http://localhost:3206}"
export NO_PROXY="${NO_PROXY:-},localhost,127.0.0.1"
export no_proxy="${no_proxy:-},localhost,127.0.0.1"
exec bun run "$PROJECT_DIR/cli/src/index.ts" runner start "$@"
```

### 2. 开发环境检查

在 GSD 工作流的验证阶段，增加开发环境健康检查：

- Hub 响应检查
- Runner 进程检查
- 机器在线检查
- 代理设置检查（warn 如果 `http_proxy` 设置但 `NO_PROXY` 未包含 localhost）

### 3. 注意事项

- **绝不要用 curl 手动创建机器记录**（会导致 metadata 为 null）
- **如果需要清理机器数据**: `sqlite3 ~/.hapi-power/hapi-power.db "DELETE FROM machines;"`
- **重启 hub 会清除内存缓存**，但数据库保留（这是正常的）
- **Runner 断线后会自动重连**，但如果 hub 重启，需要等 runner 重试周期
