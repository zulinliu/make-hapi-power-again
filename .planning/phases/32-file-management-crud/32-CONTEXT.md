---
name: phase-32-file-management-crud
description: Phase 32 文件管理全栈 CRUD + MD 预览 + iOS 适配实现决策
---

# Phase 32: 文件管理全栈 CRUD

## 目标

补齐文件管理的完整 CRUD 能力，适配 iOS 触摸交互，增加 MD 预览模式。

## 决策记录

### 1. 后端 RPC 新增方法

新增 5 个 RPC 方法（shared/src/rpcMethods.ts）：

| 方法 | 用途 |
|------|------|
| `DeleteFile` | 删除文件/空目录 |
| `RenameFile` | 重命名/移动文件或目录 |
| `CopyFile` | 复制文件 |
| `CreateDirectory` | 创建目录（含递归） |
| `MoveFile` | 移动文件/目录 |

- 所有方法复用 `validatePath()` 做路径安全校验
- DeleteFile 支持递归删除（可选参数 `recursive`）
- RenameFile 实现为 fs.rename，跨目录即为移动
- CopyFile 实现为 fs.cp（Bun/Node 18+）
- CreateDirectory 实现为 fs.mkdir({ recursive: true })

### 2. WriteFile 缺陷修复

在 `cli/src/modules/common/handlers/files.ts` 修复：
- 新增 `forceOverwrite` 参数（默认 false）
- 当 forceOverwrite=true 时跳过 hash 检查直接写入
- 保持向后兼容：无 expectedHash + 无 forceOverwrite = 新文件创建

### 3. 前端交互设计

#### 右键/长按上下文菜单

复用已有 `useLongPress` hook + 新建 `ContextMenu` 组件：
- 500ms 长按触发（iOS 友好）
- 菜单项：打开、重命名、复制路径、复制、移动到…、删除
- 文件夹额外：新建文件、新建文件夹
- PC 右键同样触发

#### 工具栏（选中文件后）

文件树顶部工具栏：
- 新建文件、新建文件夹、刷新
- 选中文件后显示：重命名、删除、复制路径

### 4. MD 预览/编辑模式

在 `sessions/file.tsx` 页面增加：
- Markdown 文件默认渲染预览（使用 remark + rehype）
- 顶部切换按钮：预览 ↔ 编辑 ↔ 差异
- 编辑模式使用 CodeEditor
- 预览模式使用已有的 `remark-file-path-links` 插件

### 5. iOS 适配

- 长按 500ms 触发上下文菜单（复用 useLongPress）
- 禁用文件树拖放（iOS Safari 拖放体验差，用「移动到…」替代）
- 触摸友好的菜单项尺寸（最小 44px 触摸目标）
- 确认删除使用 modal 而非 confirm()

### 6. i18n

所有新增 UI 文本接入 t()：
- 文件操作相关键前缀：`file.*`
- 上下文菜单：`file.context.*`
- 预览模式：`file.preview.*`

### 7. 暂不做

- 拖放文件移动（iOS 体验差，用菜单替代）
- 文件搜索过滤（已有 ripgrep 搜索）
- 批量操作（多选删除等）
- 回收站/软删除
