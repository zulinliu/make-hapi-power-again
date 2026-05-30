# Phase 2: Git 管理 — 实施计划

**前置**: Phase 1 完成
**目标**: 浏览器内完整的 Git 可视化管理能力

## 现有能力

- CLI Git handler: `git-status`, `git-diff-numstat`, `git-diff-file` (child_process execFile)
- 路径安全: validatePath 保护 cwd 和 filePath
- 前端: 无专用 Git 界面，仅通过 RPC 调用

## 执行计划

### Plan 02-01: Git 后端 RPC 扩展

**新增 RPC 方法** (shared/src/rpcMethods.ts):
- `GitLog` — 提交历史 (`git log --oneline --graph`)
- `GitBranch` — 分支列表 (`git branch -a`)
- `GitBranchCreate` — 创建分支 (`git checkout -b`)
- `GitBranchSwitch` — 切换分支 (`git checkout`)
- `GitBranchMerge` — 合并分支 (`git merge`)
- `GitBranchDelete` — 删除分支 (`git branch -d/-D`)
- `GitCommit` — 提交 (`git commit`)
- `GitAdd` — 暂存 (`git add`)
- `GitAutoCommit` — 自动提交（供 GitInternalAPI 使用）

**CLI Handler** (cli/src/modules/common/handlers/git.ts):
- 扩展 registerGitHandlers 添加新方法
- 所有命令使用 validatePath + timeout 保护

### Plan 02-02: GitInternalAPI + SSRF 防护

**新增**:
- `shared/src/gitInternalApi.ts` — GitInternalAPI 接口定义
- `hub/src/git/gitService.ts` — Hub 端 Git 服务（调用 CLI RPC）
- Clone URL 验证: 拒绝 `file://` 协议
- 凭证存储: AES-256-GCM 加密 (hub/src/git/credentialStore.ts)

### Plan 02-03: Git 前端界面

**新增组件**:
- `web/src/routes/sessions/git.tsx` — Git 管理页面
- `web/src/components/git/GitStatusPanel.tsx` — 状态面板
- `web/src/components/git/GitHistory.tsx` — 提交历史
- `web/src/components/git/GitBranchManager.tsx` — 分支管理
- `web/src/components/git/GitDiffView.tsx` — Diff 视图

**路由注册**: router.tsx 新增 `/sessions/$sessionId/git` 路由
