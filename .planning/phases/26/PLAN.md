# Phase 26: Git Clone + Remote 管理

**Goal**: 实现 Git Clone UI、Remote 管理、凭证管理，打通项目初始化核心流程
**Requirements**: INIT-01~05

## 架构决策

- **使用系统 git** — 项目已有成熟的 `execFile('git', ...)` 模式
- **Clone 进度用 `spawn` + Socket.IO 事件** — 新增 `clone:progress` 专用事件
- **RPC 模式扩展** — clone 用异步模式（非 emitWithAck），其他 remote 操作复用同步 RPC

## 实现计划

### 26-01: 后端 — RPC 方法 + CLI Handler + Hub 路由

**文件变更清单:**

1. `shared/src/rpcMethods.ts` — 新增 6 个 RPC 方法
   - `git-clone`, `git-remote-list`, `git-remote-add`, `git-remote-remove`
   - `git-push`, `git-pull`（Phase 27 用，先注册）

2. `shared/src/socket.ts` — 新增 `clone:progress` 事件类型
   - phase: 'counting' | 'compressing' | 'writing' | 'resolving' | 'done' | 'error'
   - progress, message, bytesReceived, bytesTotal

3. `cli/src/modules/common/handlers/git.ts` — 新增 clone + remote handlers
   - `runGitCloneStreaming()` — spawn + stderr 解析 + 进度推送
   - `runRemoteCommand()` — 列表/添加/删除 remote
   - 取消机制：记录 spawn 进程引用

4. `hub/src/web/routes/git.ts` — 新增 4 个 REST 端点
   - POST `/sessions/:id/git-clone` — 触发 clone
   - GET `/sessions/:id/git-remotes` — 列出 remotes
   - POST `/sessions/:id/git-remotes` — 添加 remote
   - DELETE `/sessions/:id/git-remotes/:name` — 删除 remote

5. `hub/src/sync/rpcGateway.ts` — 新增 clone 相关方法

6. `hub/src/socket/handlers/cli/index.ts` — 转发 clone:progress 事件

### 26-02: 前端 — CloneDialog + Remote 管理 UI

**文件变更清单:**

1. `web/src/api/client.ts` — 新增 API 方法
   - `gitClone()`, `getGitRemotes()`, `addGitRemote()`, `removeGitRemote()`

2. `web/src/components/git/GitCloneDialog.tsx` — Clone 对话框
   - URL 输入 + validateCloneUrl 校验
   - 目标目录输入
   - 进度条 + 状态文本
   - 取消按钮

3. `web/src/components/git/GitRemoteManager.tsx` — Remote 管理
   - Remote 列表
   - 添加/删除 remote
   - 凭证配置

4. `web/src/routes/sessions/git.tsx` — Git 管理页集成
   - 新增 "Clone" 按钮触发 GitCloneDialog
   - 新增 "Remotes" Tab 展示 GitRemoteManager

### 26-03: 质量门禁

1. `cd web && npx tsc --noEmit`
2. `cd web && npx vitest run`
3. 端到端验证：启动服务 → Clone 一个公开仓库 → 确认文件出现

## 依赖关系

```
26-01 (后端) → 26-02 (前端) → 26-03 (质量门禁)
```

## 关键技术点

- **Clone 进度解析**: `git clone --progress` 输出格式
  - `Receiving objects:  45% (1234/5678), 2.30 MiB | 1.20 MiB/s`
  - `Resolving deltas:  67% (890/1234)`
  - 正则: `/(\d+)%.*\((\d+)\/(\d+)\)/`

- **安全**: 复用 `validateCloneUrl()` 拒绝 file:// 协议
- **超时**: clone RPC 超时设为 600 秒（大型仓库）
- **并发**: 每个 session 同时只允许一个 clone 操作
