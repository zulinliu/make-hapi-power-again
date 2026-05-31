---
phase: 31
name: Git 管理优化
slug: git-management-optimization
date: 2026-05-31
---

# Phase 31 CONTEXT: Git 管理优化

## Domain

Git 管理功能的全面体验优化：修复 i18n 缺失、已知 bug，补齐 commit/fetch UI，让 Git 管理在中文环境下完全可用。

## Decisions

### i18n 国际化

- **7 个 Git 组件全部接入 i18n**：git.tsx、GitStatusPanel.tsx、GitHistory.tsx、GitBranchManager.tsx、GitCloneDialog.tsx、GitRemoteManager.tsx、GitPushDialog.tsx、GitPullDialog.tsx
- **约 40+ 处英文硬编码**需替换为 t() 调用
- **i18n key 命名规范**：`git.xxx` 前缀（如 `git.status.loading`、`git.history.title`）
- **对比参考**：`web/src/routes/sessions/files.tsx` 已正确使用 t()，作为范例

### Bug 修复

- **GitPushDialog upstream 无效**：变量 `upstream` 声明且 UI 有复选框，但 handlePush() 构建参数时未使用。修复：当 upstream=true 时添加 `--set-upstream` 参数
- **重复解析器合并**：GitStatusPanel.tsx 内含简化版 parseGitStatus()，与 gitParsers.ts 的 parseStatusSummaryV2() 功能重叠。统一使用 gitParsers.ts 版本

### Commit UI（双模式）

- **模式 1：Status 面板嵌入式快捷提交**
  - 在 GitStatusPanel 底部添加 commit 输入框 + 提交按钮
  - 一键暂存全部变更并提交（类似 VS Code Source Control 面板）
  - 输入消息后回车即提交
- **模式 2：详细提交弹窗（GitCommitDialog）**
  - 选择要暂存的文件（checkbox 列表，区分 staged/unstaged）
  - 输入 commit message（textarea）
  - 可选：签名提交（--gpg-sign）、 amend（--amend）
  - 触发入口：Git 页面顶部 "Commit" 按钮

### Fetch UI

- **简单按钮**：在 Git 页面顶部的 Pull 按钮旁添加 Fetch 按钮
- **执行流程**：点击后调用 git fetch，显示 loading 状态，完成后显示结果（是否获取到新提交）
- **无弹窗**：直接执行 fetch origin，不选择 remote

### 不做的事（延迟）

- stash、tag、rebase、reset、checkout(单文件)、cherry-pick、blame、submodule
- 上述操作不属于日常必须，未来可按需添加

## Code Context

### 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `web/src/i18n/locales/en.ts` | 添加 git.* i18n key |
| `web/src/i18n/locales/zh-CN.ts` | 添加 git.* i18n key |
| `web/src/routes/sessions/git.tsx` | i18n 接入 |
| `web/src/components/git/GitStatusPanel.tsx` | i18n + 嵌入式 commit UI |
| `web/src/components/git/GitHistory.tsx` | i18n |
| `web/src/components/git/GitBranchManager.tsx` | i18n |
| `web/src/components/git/GitCloneDialog.tsx` | i18n |
| `web/src/components/git/GitRemoteManager.tsx` | i18n |
| `web/src/components/git/GitPushDialog.tsx` | i18n + upstream bug fix |
| `web/src/components/git/GitPullDialog.tsx` | i18n |
| `web/src/components/git/GitCommitDialog.tsx` | 新建：详细提交弹窗 |
| `shared/src/rpcMethods.ts` | 确认 GitCommit RPC 已注册 |
| `cli/src/modules/common/handlers/git.ts` | 可能需要调整 commit handler |
| `hub/src/web/routes/git.ts` | 可能需要添加 fetch HTTP 路由 |

### 已有可复用资产

- `web/src/lib/gitParsers.ts`：完整 porcelain=v2 解析器，Status 面板应直接使用
- `web/src/hooks/queries/useGitStatusFiles.ts`：React Query hook，组合 status + diff
- `web/src/api/client.ts`：gitCommit() 方法已存在（行 285）
- `cli/src/modules/common/handlers/git.ts`：GitCommit handler 已实现（行 405-414）

### RPC 方法可用性

- GitCommit：后端完整（CLI handler 行 405-414），前端 API client 已有 gitCommit()
- GitFetch：后端完整（CLI handler 行 516-522），但 Hub 无 HTTP 路由、前端无 API client 方法

## Deferred Ideas

- Git stash 管理（暂存/恢复/查看列表）
- Git tag 管理（创建/列表/删除/推送）
- Git rebase 交互（变基操作 UI）
- Git blame 视图（在编辑器中显示每行最后修改信息）
- Git submodule 支持
- Git cherry-pick 操作
- Git 单文件 checkout/restore
