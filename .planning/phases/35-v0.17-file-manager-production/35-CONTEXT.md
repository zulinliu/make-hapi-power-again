---
phase: 35-v0.17-file-manager-production
version: v0.17.0
created: 2026-06-06
branch: feat/v0.17.0
status: completed
skills:
  - gsd-new-project
  - impeccable
---
# Phase 35 Context: v0.17.0 全功能文件管理器生产化

## 触发背景

v0.17.0 的目标是交付一个生产稳定使用的全功能文件管理器模块。用户审查发现当前文件管理器仍存在明显断点：没有显性返回上一级，新建文件和新建文件夹入口冗余，显示隐藏文件不可用，除目录浏览和从目录新建会话外大量操作不可用，文件预览编辑入口不清晰且全局浏览点击文件无反应。

本阶段不是新增一个第三套文件页面，而是收敛现有能力，统一全局 `/browse` 和会话 `/sessions/:id/files` 的文件管理体验。

## 现状判定

### 已具备的资产

| 能力 | 当前状态 | 主要代码 |
|---|---|---|
| 全局目录浏览 | 可用，但只读偏目录选择器 | `web/src/components/FileManager/*`, `web/src/router.tsx` |
| 从目录启动会话 | 可用 | `FileManager.tsx` → `/sessions/new` |
| Session 文件 CRUD 后端 | 基本可用 | `hub/src/web/routes/git.ts`, `hub/src/sync/rpcGateway.ts`, `cli/src/modules/common/handlers/fileOperations.ts` |
| Session 文件树 | 可用，但独立于全局 FileManager | `web/src/components/SessionFiles/DirectoryTree.tsx` |
| 文件预览编辑路由 | 基本可用，但轻编辑，不是 Monaco | `web/src/routes/sessions/file.tsx` |
| 路径安全 | Session 文件操作已有工作目录限制 | `cli/src/modules/common/pathSecurity.ts` |

### 关键断点

1. `/browse` 使用 machine list API，但 CRUD 走 session API，且 `/browse` 没有传入 `sessionId`。
2. machine API 当前只有 `list-directory`，没有 read/write/delete/rename/copy/move/upload/download。
3. machine list handler 无条件过滤 dotfile，导致显示隐藏文件开关永远拿不到隐藏项。
4. FileManager 点击文件只有 `sessionId` 时才跳转，全局模式点击文件无动作。
5. Move/Copy/Download/Upload 在全局 FileManager 中仍是 unavailable toast。
6. `/sessions/:id/files` 是独立树形页，和全局 FileManager 的列表、工具栏、面包屑、移动端底部栏割裂。
7. 文件编辑是 textarea，规划文档中标记的 Monaco 与生产编辑能力没有真正落地。
8. 规划文档存在完成状态高估，v0.17 必须以代码事实重新定义完成标准。

## 产品定位

v0.17.0 文件管理器必须从“目录浏览和会话入口”升级为“machine scoped 全局文件系统工作台”。

用户无需先启动会话，也能在 workspace roots 内完成文件管理；有会话时，同一个文件管理核心提供 Git 状态、Diff、AI 会话上下文等增强能力。

## 核心设计决策

| 决策 | 结论 | 原因 |
|---|---|---|
| 模块边界 | 文件管理器以 machine/workspace 为主，session 为增强上下文 | `/browse` 是全局入口，不能依赖 active session |
| UI 架构 | 建立统一 FileManager core，不再维护两套 CRUD UI | 解决入口重复和行为不一致 |
| API 架构 | 新增 machine file RPC/API，复用 session file API 的语义 | 全局模式需要真实 CRUD |
| 安全边界 | machine 文件操作限制在 `workspaceRoots` 内 | 避免全盘任意文件操作 |
| 编辑入口 | 文件点击必须打开预览/编辑，不允许静默无动作 | 修复用户核心反馈 |
| 编辑实现 | v0.17 先建立冲突安全闭环，Monaco 路由级懒加载作为 P1 | 先保证不丢数据，再升级体验 |
| 自审方式 | 每个阶段完成后必须写 `35-SELF-REVIEW.md` 更新项并提交 | 用户要求分阶段自审 |

## 成功标准

v0.17.0 发布前，以下场景必须可手动验证：

1. 打开 `/browse`，无需活动会话即可浏览、返回上一级、显示隐藏文件。
2. 在 `/browse` 新建文件、新建文件夹、重命名、删除、移动、复制均真实执行。
3. 在 `/browse` 点击文件能打开预览和编辑，不再无反应。
4. 上传文件可落到当前目录，下载文件可保存到本地。
5. `/sessions/:id/files` 使用同一套文件管理能力，不再独立分叉一套 CRUD 行为。
6. 文本编辑保存有冲突保护，保存失败不丢本地内容。
7. 移动端 390px 宽度下所有核心操作可见，触控目标不小于 44px。
8. 所有新文案中英双语，所有质量门禁通过。

