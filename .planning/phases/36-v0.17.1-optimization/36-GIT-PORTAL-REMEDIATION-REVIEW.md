---
phase: 36-v0.17.1-optimization
scope: file-manager-git-portal
reviewed_at: 2026-06-07T17:49:34Z
branch: feat/v0.17.3
status: production-ready-verified
skills:
  - gsd-new-project
  - impeccable
---

# Git Portal 修复与阶段复审

## 目标

按 Git Portal 深度评审结论，对文件管理器中的 Git 克隆功能进行全链路修复，覆盖后端契约、Hub 路由、RPC scope、CLI 安全、SSE 进度、取消链路、移动端体验、可访问性和测试门禁。目标是达到稳定生产可用。

## 原始评审阻断项

来源：

- `.impeccable/critique/2026-06-07T11-50-34Z__web-src-components-gitportal.md`
- `.planning/phases/36-v0.17.1-optimization/36-SECURITY-REVIEW.md`
- `.planning/ROADMAP-git-portal.md`

原始结论：

- Git Portal UI 和 RPC 骨架已经存在，但 clone 成功闭环、进度链路、取消链路、安全边界和测试覆盖不足。
- 安全红线集中在 RPC scope 绑定、ASKPASS 临时文件、SSRF、防 workspace 越界、Git 参数注入。
- 产品体验红线集中在移动端任务语义、完成页、错误恢复、取消确认、触控目标和可访问性。

## 阶段 1：契约、Hub 路由、RPC 与 SSE

### 修复内容

- `shared/src/schemas.ts`
  - `cloneId` 改为必填 UUID，用于进度、取消和临时文件相关性。
  - `GitCloneRequestSchema` 使用 `strict()`，拒绝未知字段。
  - 明确 `targetDir` 为父目录，`targetName` 为仓库目录名，`destinationPath` 为最终路径，且 `destinationPath` 与 `targetDir` / `targetName` 互斥。
  - 禁止 URL embedded credentials。
  - `GitCloneAuthSchema` 改为 discriminated union，`password` / `token` 必须携带 password，`ssh` 禁止携带 password 和额外字段。
  - `CloneProgressDataSchema` 要求 exactly one scope，只允许 `sessionId` 或 `machineId` 二选一。
- `hub/src/web/routes/gitCloneSafety.ts`
  - 新增 clone request / cancel request parser。
  - 新增 `GitCloneGate`，提供 per-scope 并发限制和速率限制。
- `hub/src/web/routes/git.ts`
  - session clone / cancel 路由使用统一 parser 和 gate。
  - RPC 异常响应改为通用 `Git operation failed`，避免路径和内部错误泄露。
  - Git push / pull / fetch / remote add 参数使用 Zod 严格校验。
- `hub/src/web/routes/machines.ts`
  - machine clone / cancel 路由使用统一 parser 和 gate。
  - machine clone 要求提供 `targetDir` 或 `destinationPath`，避免无目标落盘。
  - gate 使用 `finally release()`，防止异常后 scope 永久占用。
- `hub/src/socket/rpcRegistry.ts`
  - RPC 注册绑定 socket 已认证的 session / machine scope。
  - 拒绝未知 method 和跨 scope 注册。
- `hub/src/socket/handlers/cli/index.ts`
  - `clone:progress` 进入 Hub 前做 schema 校验。
  - 进度 payload 必须匹配 socket 已认证 scope。
- `hub/src/sse/sseManager.ts`
  - clone-progress 按 namespace 过滤。
  - clone-progress 以 `data.sessionId` / `data.machineId` 为唯一投递 scope，忽略不一致的顶层 stray scope。

### 复审结论

- P0：0
- P1：0
- P2：0

原 P2 “clone-progress 允许同时带 sessionId + machineId” 已关闭，当前契约要求 exactly one scope。

## 阶段 2：CLI Git 克隆安全加固

### 修复内容

- `cli/src/modules/common/handlers/git.ts`
  - SSRF 防护覆盖：
    - localhost、private、link-local、multicast。
    - encoded IPv4、octal 风格输入、IPv4-mapped IPv6。
    - DNS 解析到私网拒绝。
    - HTTPS 禁用跟随重定向。
    - HTTPS 使用固定 `http.curloptResolve=host:port:addr`，降低 DNS rebinding 风险。
    - SSH 使用受控 `ssh` 命令，固定 `HostName=<resolved public IP>` 和 `HostKeyAlias=<hostname>`。
    - 显式禁用 `ProxyCommand`、`ProxyJump`、`CanonicalizeHostname`。
    - clone env 删除外部 `GIT_SSH_COMMAND` 后再注入受控 command。
  - ASKPASS 防护：
    - 使用 `mkdtempSync` 创建私有临时目录。
    - 固定脚本名 `askpass.sh`，`cloneId` 不进入路径。
    - 完成后清理临时脚本和目录。
    - username / password / token 提示均可处理。
  - 磁盘预检：
    - 默认最小剩余空间阈值 256MB。
    - 支持 `HAPI_POWER_GIT_CLONE_MIN_FREE_BYTES` 配置。
  - 取消链路：
    - active clone registry 使用 scope-aware key。
    - cancel 先 SIGTERM，5 秒后仍未退出则 SIGKILL。
    - cancel 校验 session / machine scope。
  - Git 周边安全：
    - push / pull / fetch 的 remote / branch 参数拒绝 option-like 注入。
    - branch create 的 `startPoint` 拒绝 option-like 注入。
    - git log 的 `filePath` 经过 workspace path 校验。
    - remote add URL 使用 clone SSRF guard，拒绝 `file://`、私网 DNS、embedded credentials 等。
- `cli/src/api/apiMachine.ts`
  - machine git handlers 使用 workspaceRoots 保护版本。
  - 无 workspaceRoots 时拒绝 machine clone，避免任意路径落盘。

### 复审结论

- P0：0
- P1：0
- P2：0

安全说明：DNS rebinding 已通过预解析固定和 Git redirect 降级处理降低风险，但生产环境仍建议配合 egress firewall 或 allowlist。

## 阶段 3：前端产品体验与 Impeccable 修复

### 修复内容

- `web/src/lib/git-portal-events.ts`
  - 新增全局 clone-progress CustomEvent bridge。
- `web/src/hooks/useSSE.ts`
  - SSE 收到 clone-progress 后转发到 Git Portal。
- `web/src/components/GitPortal/useGitClone.ts`
  - 前端生成 UUID `cloneId`。
  - 请求发送 `{ targetDir: parentDir, targetName: repoName }`。
  - REST success fallback 进入 done，避免成功后 UI 卡在 connecting。
  - cancel 调用 Hub cancel API。
  - 支持失败重试和切换 Token 认证。
  - cancel 后忽略晚到 success / done 事件。
  - 完成后清理 auth。
- `web/src/components/GitPortal/GitPortal.tsx`
  - 取消确认从 `window.confirm` 改为内联 `alertdialog`。
  - 不再 clone 成功后立即关闭，让用户看到完成页和后续动作。
- `web/src/components/GitPortal/GitPortalProgress.tsx`
  - 增加 `role="progressbar"` 和 `aria-valuenow/min/max`。
  - low-end / reduced-motion 下仍保留屏幕阅读器可读状态。
  - 危险按钮使用可读 danger token。
- `web/src/components/GitPortal/GitPortalHistory.tsx`
  - 移除 button 嵌套 button。
  - 收藏按钮可键盘访问。
- `web/src/styles/tokens.css`
  - 增加 `--hp-primary-readable`、`--hp-danger-readable`、`--hp-danger-action` 等 token。
  - 主按钮文本对比度按 WCAG AA 调整。
- 文案和视觉语义
  - 用户可见文案转为 “Clone repository / Import from Git / 克隆仓库 / 从 Git 导入”。
  - 文件管理器桌面工具栏、移动底栏、新会话卡片改用 Git branch / repository 语义图标。
  - 动画从装饰性 portal 改为 repository frame + branch graph。
- `web/src/components/NewSession/index.tsx`
  - 新增从 Git 导入入口。
  - clone 完成主动作支持 “Use this directory / 使用此目录”。

### 复审结论

- P0：0
- P1：0
- P2：2

剩余 P2：

1. 内部组件命名仍保留 `GitPortal` 和 `gp-portal-*` class。该问题不影响用户可见体验，后续可作为重命名清理处理。
2. first-use 空状态仍有少量旧视觉隐喻残留风险。当前主路径未阻断，可后续通过更明确的 repo/branch 插画替换。

## 阶段 4：测试覆盖

新增或更新测试：

- `shared/src/gitCloneRequest.test.ts`
  - clone request / cancel request strict schema。
  - auth mode semantics。
  - targetDir / targetName / destinationPath 合同。
  - clone-progress exactly one scope。
- `hub/src/web/routes/gitCloneSafety.test.ts`
  - clone parser、cancel parser、gate 并发和速率行为。
- `hub/src/web/routes/gitCloneRoutes.test.ts`
  - session clone payload 转发。
  - cancel 路由。
  - push / pull / fetch 参数注入拒绝。
  - remote add unsafe URL 拒绝。
  - RPC error 响应脱敏。
- `hub/src/web/routes/machinesGitClone.test.ts`
  - machine clone / cancel 和 gate 释放。
- `hub/src/socket/rpcRegistry.gitPortal.test.ts`
  - RPC scope 注册拒绝未知 method 和跨 scope。
- `hub/src/socket/handlers/cli/cloneProgress.test.ts`
  - clone-progress schema 和 scope 校验。
- `hub/src/sse/sseManager.test.ts`
  - clone-progress namespace 和 scope 路由。
  - data scope 优先于不一致顶层 scope。
- `cli/src/modules/common/handlers/gitClone.test.ts`
  - SSRF、ASKPASS、cancel、SSH pinning。
  - push / pull / fetch / startPoint / log / remote add 安全。
- `cli/src/api/apiMachine.test.ts`
  - 无 workspaceRoots 的 machine clone 拒绝。
- `web/src/api/client.gitPortal.test.ts`
  - API client clone / cancel。
- `web/src/components/GitPortal/useGitClone.test.tsx`
  - 状态机、SSE done、REST fallback、cancel 后忽略晚到事件。
- `web/src/lib/git-portal-storage.test.ts`
  - localStorage schema 和历史/收藏行为。

## 当前验证状态

已通过的聚焦门禁：

```bash
cd hub && bun test src/web/routes/gitCloneRoutes.test.ts src/socket/handlers/cli/cloneProgress.test.ts src/sse/sseManager.test.ts
# 16 pass

cd shared && bun test src/gitCloneRequest.test.ts
# 10 pass
```

最终门禁已通过：

```bash
cd cli && bunx vitest run src/modules/common/handlers/gitClone.test.ts
# 15 pass

cd shared && bun test src/gitCloneRequest.test.ts
# 11 pass

cd hub && bun test src/web/routes/gitCloneRoutes.test.ts src/web/routes/machinesGitClone.test.ts src/web/routes/gitCloneSafety.test.ts src/socket/rpcRegistry.gitPortal.test.ts src/socket/handlers/cli/cloneProgress.test.ts src/sse/sseManager.test.ts
# 27 pass

cd web && bun run test src/components/GitPortal/useGitClone.test.tsx src/api/client.gitPortal.test.ts src/lib/git-portal-storage.test.ts src/hooks/useSSE.test.ts
# 15 pass

bun run typecheck
# pass

git diff --check
# pass

scripts/brand-check.sh
# pass

bun run test
# cli 788 pass / 12 skipped, hub 323 pass, web 687 pass, shared 48 pass

bun run build
# pass
```

真实链路烟测：

```bash
POST /api/machines/:machineId/git-clone
url: https://github.com/octocat/Hello-World.git
targetDir: /home/tester/project/hapi-git-portal-smoke
depth: 1

# HTTP 200
# success: true
# elapsed: 5s
# .git directory present
```

运行服务：

- Hub: `http://127.0.0.1:3106/`，HTTP 200
- Web: `http://127.0.0.1:3210/`，HTTP 200
- Runner: connected，machine `a10e197c-773f-4830-b4ed-ebc60d0e42aa`

## 阶段 5：卡死复现后的后端收尾

用户复测发现 clone 仍可能卡住。复现结果：

- API clone 已启动 `git clone`，目标目录和 `.git` 已创建。
- `git` 父进程取消后，`git-remote-https` 子进程可能继续挂住。
- Git 自身 `http.lowSpeed*` 对部分连接/子进程挂起场景不足以保证及时返回。

追加修复：

- `cli/src/modules/common/handlers/git.ts`
  - clone 子进程使用独立 process group。
  - cancel / fallback kill 改为终止整个进程组，覆盖 `git-remote-https` 等子进程。
  - 新增应用层无输出 watchdog，默认 120 秒无 stdout/stderr 即 SIGTERM。
  - watchdog 触发后返回明确错误：`git clone stalled with no output ...`。
  - 失败、取消、watchdog 均清理 clone 半成品目录，避免下一次重试被 “destination exists” 卡住。
  - 保留 `HAPI_POWER_GIT_CLONE_STALL_TIMEOUT_MS` 作为运行时调节项。
- `cli/src/modules/common/handlers/gitClone.test.ts`
  - 增加 stalled clone 终止和半成品清理覆盖。
  - clone 安全测试从 11 个增加到 15 个。

复审结论：

- P0：0
- P1：0
- P2：0

运行时复审补充：

- 子代理最终只读复审结论：运行时稳定性 P0/P1/P2 均为 0。
- pre-spawn cancel race 已关闭：DNS/path validation 期间收到 cancel 会写入 tombstone，spawn 前消费 tombstone 并直接返回 `Clone cancelled`。
- cancel / watchdog 已强制收敛：先 SIGTERM，grace 后 SIGKILL，并通过 `forceFinish` 清理半成品目录和 resolve，不再依赖子进程一定触发 `close`。

## 阶段 6：用户复测失败后的最小补丁

用户再次复测报告 clone 仍失败后，真实 API smoke 复现到一个环境相关问题：

- Git Portal clone 禁用了 global/system Git config，安全上关闭了 `insteadOf`、credential helper、hooks 等风险。
- 但该机器的 GitHub 访问依赖 URL-matched Git proxy 配置；完全禁用 proxy 后，HTTPS clone 走直连并触发 Git low-speed failure。

最小修复：

- 仍禁用 global/system Git config、credential helper、hooks、`GIT_CONFIG_*` 和危险 Git/SSH env。
- 仅在 HTTPS clone 前读取 `git config --global --get-urlmatch http.proxy <url>` 的 URL-matched proxy 值。
- 仅把合法 proxy URL 作为显式 `-c http.proxy=...` 传给当前 clone；不继承 `insteadOf`、credential helper 或其他全局配置。
- `http.lowSpeedTime` 从 30 秒调整为 120 秒，降低慢网络误杀。
- 应用层 no-output watchdog 默认同步调整为 120 秒，仍保留 `HAPI_POWER_GIT_CLONE_STALL_TIMEOUT_MS` 可调。
- 增加测试覆盖 URL-matched proxy 继承，同时验证 global config 仍被禁用。

补丁后验证：

```bash
cd cli && bunx vitest run src/modules/common/handlers/gitClone.test.ts
# 15 pass

bun run test:cli
# 89 files passed / 1 skipped, 788 pass / 12 skipped

bun run typecheck
# pass

cd hub && bun test src/web/routes/gitCloneRoutes.test.ts src/web/routes/machinesGitClone.test.ts src/web/routes/gitCloneSafety.test.ts src/socket/rpcRegistry.gitPortal.test.ts src/socket/handlers/cli/cloneProgress.test.ts src/sse/sseManager.test.ts
# 27 pass

cd web && bunx vitest run src/components/GitPortal/useGitClone.test.tsx src/api/client.gitPortal.test.ts src/lib/git-portal-storage.test.ts
# 11 pass

cd shared && bun test src/gitCloneRequest.test.ts
# 11 pass

bun run build
# pass

git diff --check && scripts/brand-check.sh
# pass
```

补丁后真实链路烟测：

```bash
POST /api/machines/:machineId/git-clone
url: https://github.com/octocat/Hello-World.git
targetDir: /home/tester
targetName: hapi-git-portal-smoke-*
depth: 1

# HTTP 200
# success: true
# elapsed: 5s
# .git directory present
# smoke directory cleaned
```

## 阶段 7：前端可访问性微收尾

完成性审计时补掉一个可选 P2：

- `web/src/components/GitPortal/GitPortalHistory.tsx`
  - 收藏星标按钮增加 `aria-pressed={isFavorite}`，让屏幕阅读器明确知道收藏开关状态。

验证：

```bash
bun run typecheck:web
# pass

cd web && bunx vitest run src/components/GitPortal/useGitClone.test.tsx src/api/client.gitPortal.test.ts src/lib/git-portal-storage.test.ts src/hooks/useSSE.test.ts
# 15 pass
```

## 生产风险与运行时建议

这些不是当前发布阻断项，但应在生产部署中明确：

1. DNS rebinding：代码已固定预检解析结果并禁用 HTTP redirect，但更稳妥的生产边界是 egress firewall 或 allowlist。
2. Hub gate：当前为进程内 gate。单进程部署可用，集群部署需 Redis 或 DB distributed lock。
3. 超大仓库：磁盘预检降低风险，但无法精确预估所有仓库体积。生产建议增加磁盘配额、告警和 per-machine clone job 监控。
4. localStorage 历史：clone URL 元数据以明文保存。已清理 credentials，但共享浏览器配置文件仍可读取历史。
5. Git LFS / submodule：当前 clone 安全边界覆盖主 clone 过程。若后续启用 LFS 或 recursive submodule，需要单独复审 egress 和凭据传播。

## 最终准入结论

最终结论：Git Portal 的原始 P0 / P1 阻断项已关闭；后端安全 P1 与卡死问题均已收口；真实 machine clone API 烟测通过；全量测试、构建、typecheck、diff-check、brand-check 均通过。当前功能达到生产可用准入标准。
