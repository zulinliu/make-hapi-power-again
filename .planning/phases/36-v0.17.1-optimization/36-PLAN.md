---
phase: 36
version: v0.17.1
status: reviewed
created: 2026-06-07
reviewed: 2026-06-07
based_on: v0.17.0-comprehensive-review
review_agents:
  - completeness: passed-with-conditions
  - security: passed-with-critical-finding
  - mobile-ux: acceptable-needs-refinement
---

# Phase 36: v0.17.1 优化方案设计（v2 — 评审迭代版）

## 背景

v0.17.0 引入了全局文件管理器（5 个 Phase 实现）+ 文件预览编辑闭环 + 品牌重设计。经 4 个专业代理深度评审 + 3 个方案评审代理交叉验证，发现 4 个 P0 级问题、7 个 P1 级问题、12 个 P2 级问题。本方案为评审迭代版（v2），已整合完整性、安全性、移动端 UX 三路评审反馈。

## 评审迭代记录

| 来源 | 关键发现 | 本版处理 |
|------|---------|---------|
| 完整性评审 | Task 36.3 调用方未修改 | 已补充调用点修复代码 |
| 完整性评审 | Task 36.1 逐字节拼接性能差 | 改用数组+join 方案 |
| 安全评审 | **WriteFile 后端无大小限制** | 新增 Task 36.7b，提升为第一轮阻断项 |
| 安全评审 | Task 36.4 exists 语义变更影响 | 已补充下游分析 |
| 安全评审 | isValidDestinationDir rootPath="/" 边界 | 已补充约束说明 |
| 移动端评审 | 编辑模式下目录行为矛盾 | 改为：编辑模式所有行=选中 |
| 移动端评审 | 退出按钮位置矛盾 | 改为：底部操作栏含"完成" |
| 移动端评审 | 底部操作栏空间不足 | 改为：action sheet 分层设计 |
| 移动端评审 | safe-area 遗漏 | 已补充 |
| 移动端评审 | 编辑模式动画缺失 | 已补充 CSS transition 方案 |
| 全部 | 验收标准不够具体 | 已量化 |

---

## 第一轮：发布阻断项（必须修复，共 7 个）

### Task 36.1: 修复 arrayBufferToBase64 栈溢出风险

- **优先级**: P0
- **类型**: 安全/稳定性
- **文件**: `web/src/components/FileManager/FileManager.tsx:143-152`
- **问题**: `String.fromCharCode(...chunk)` 展开运算符在 chunk 元素超过引擎参数上限时 `RangeError` 崩溃
- **修复方案**: 使用分块数组 + join（避免展开运算符，同时保持性能）
  ```typescript
  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    const chunkSize = 8192
    const chunks: string[] = []
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, bytes.length)
      const chunk = bytes.subarray(i, end)
      chunks.push(String.fromCharCode(...chunk))
    }
    return btoa(chunks.join(''))
  }
  ```
  chunkSize=8192 远低于 V8 参数上限(~65535)，安全且分块避免频繁大字符串拼接。
- **验收**: 上传 10MB 文件不崩溃且无明显 UI 卡顿；添加单元测试覆盖空文件、1KB、1MB、10MB 场景

### Task 36.2: 修复 isValidFileName 冒号路径穿越

- **优先级**: P0
- **类型**: 安全
- **文件**: `web/src/components/FileManager/FileManager.tsx:83-90`
- **修复方案**: 移除冒号例外，第 88 行从：
  ```typescript
  if (name.includes(':') && !/^[a-zA-Z]:/.test(name)) return false
  ```
  改为：
  ```typescript
  if (name.includes(':')) return false
  ```
- **测试用例**: 输入 `C:foo` → false, `C:\etc\passwd` → false (已被 \ 拦截), `file:name` → false, `normal.txt` → true, `con` → true (Windows 保留名不在文件名校验范围内，后端处理)
- **验收**: 以上测试用例全部通过

### Task 36.3: 修复 isValidDestinationDir 路径穿越

- **优先级**: P0
- **类型**: 安全
- **文件**: `web/src/components/FileManager/FileManager.tsx:117-122`
- **修复方案**: 函数签名增加 `rootPath` 参数
  ```typescript
  function isValidDestinationDir(path: string, rootPath: string): boolean {
    const value = path.trim()
    if (!value) return false
    if (value.includes('\0')) return false
    if (!value.startsWith('/')) return false
    const parts = value.split('/').filter(Boolean)
    const resolved: string[] = []
    for (const part of parts) {
      if (part === '..') {
        if (resolved.length === 0) return false
        resolved.pop()
      } else if (part !== '.') {
        resolved.push(part)
      }
    }
    const normalized = '/' + resolved.join('/')
    const root = normalizePath(rootPath)
    if (root !== '/' && !normalized.startsWith(root)) return false
    return true
  }
  ```
- **调用方修改**（必须同步完成）:
  - FileManager.tsx 第 699 行：`isValidDestinationDir(destinationDir)` → `isValidDestinationDir(destinationDir, rootPath)`
  - TransferDirectoryPicker 组件内部调用也需传入 `rootPath`（组件已有 `rootPath` prop）
- **边界约束**: 当 `rootPath` 为 `/` 时不做边界检查（允许全盘访问），此为设计意图
- **测试用例**: `../../etc` → false, `/tmp/../etc/passwd` → false, `/home/user/project/subdir` (rootPath=/home/user/project) → true, `/etc/passwd` (rootPath=/home/user/project) → false
- **验收**: 以上测试用例通过；typecheck 无报错

### Task 36.4: 修复 PathExists 端点工作区沙箱缺失

- **优先级**: P0（安全漏洞升级）
- **类型**: 安全
- **文件**: `cli/src/api/apiMachine.ts:145-162`
- **修复方案**: 对每个路径调用 `resolveWorkspaceFilePath`（与 ReadFile/WriteFile/DeleteFile 等一致的防护）
  ```typescript
  this.rpcHandlerManager.registerHandler<PathExistsRequest, PathExistsResponse>(
    RPC_METHODS.PathExists, async (params) => {
      const rawPaths = Array.isArray(params?.paths) ? params.paths : []
      const uniquePaths = Array.from(new Set(rawPaths.filter((p): p is string => typeof p === 'string')))
      const exists: Record<string, boolean> = {}
      await Promise.all(uniquePaths.map(async (path) => {
        const trimmed = path.trim()
        if (!trimmed) return
        const resolved = await this.resolveWorkspaceFilePath(trimmed)
        if (!resolved.success) return
        try {
          await stat(resolved.path)
          exists[trimmed] = true  // 注意：原来是 stats.isDirectory()，改为 true
        } catch {
          exists[trimmed] = false
        }
      }))
      return { exists }
    }
  )
  ```
- **语义变更说明**: 原来返回 `isDirectory()`（文件存在时返回 false），改为返回 `true`。经检查前端调用方 `file-manager-api.ts` 中 `pathExists` 只用于判断路径是否存在（boolean），不区分文件/目录，因此此变更是安全的。
- **测试用例**: 工作区内路径 → true, `/etc/passwd` → 不出现在结果中, 不存在的路径 → false
- **验收**: 安全测试用例通过；前端 pathExists 功能正常

### Task 36.5: Hub 文件操作路由增加 try-catch

- **优先级**: P1
- **类型**: 稳定性
- **文件**: `hub/src/web/routes/machines.ts:252-362`
- **影响范围**: 7 个路由（GET file:252, PUT file:268, DELETE file:284, rename:300, copy:316, move:332, mkdir:348）。`search files` (229行) 和 `paths/exists` (364行) 已有 try-catch，无需修改。
- **修复模式**: 统一包装 try-catch，错误消息使用通用文本（避免泄露服务器路径信息）
  ```typescript
  try {
    return c.json(await engine.xxx(machineId, ...))
  } catch (error) {
    return c.json({ error: 'File operation failed' }, 500)
  }
  ```
- **注意**: 生产环境使用通用错误消息，详细错误记入 logger（不在响应中暴露路径）
- **验收**: RPC 超时时返回 `{ error: 'File operation failed' }` JSON 500；typecheck 通过

### Task 36.6: 移动端增加编辑模式/批选功能

- **优先级**: P0
- **类型**: 功能缺失
- **文件**: `FileManager.tsx`, `DirectoryView.tsx`, `file-manager.css`, `BatchActionBar.tsx`
- **问题**: checkbox 列在移动端 `display: none`，用户无法批量操作

**交互设计（基于移动端 UX 评审反馈迭代）：**

1. **进入编辑模式**:
   - 移动端底部工具栏增加"编辑"按钮（铅笔图标，最右侧）
   - 空目录时编辑按钮禁用（opacity: 0.4）

2. **编辑模式行为**:
   - **所有行（含目录和文件）点击 = 选中/取消选中**（不进入子目录，不打开文件）
   - 导航通过面包屑完成，不清除选中状态
   - 每行左侧显示圆形 checkbox（iOS 风格，空心/实心勾选）
   - 行选中背景：`var(--hp-primary-subtle)` + 左侧圆形 checkbox 实心

3. **底部操作栏布局**:
   ```
   [✓ 全选] [3 已选] [📁 移动] [📋 复制] [⋯ 更多] [完成]
   ```
   - "更多"按钮展开 action sheet：删除（红色）、复制路径、取消
   - 全选按钮：44x44px checkbox 样式，在操作栏左侧
   - "完成"按钮：操作栏最右侧，退出编辑模式
   - 破坏性操作（删除）不在底栏直接显示，需通过 action sheet

4. **退出编辑模式**:
   - 点击"完成"按钮（底部操作栏右侧）
   - 自动清空 `selectedPaths`

5. **状态管理**:
   - 新增 `isEditMode` state (boolean)
   - `isEditMode` 通过 props 传入 `DirectoryView`
   - `DirectoryView` 的 `FileRow` 新增 `isEditMode` prop

6. **CSS 实现**:
   - 编辑模式由父容器 `.fm-edit-mode` 类控制
   - checkbox 列：`.fm-edit-mode .fm-row-checkbox { display: flex !important; width: 44px; height: 44px; }` 覆盖 media query 的隐藏
   - 底部工具栏切换：编辑模式隐藏原工具栏，显示操作栏
   - 所有动画使用 CSS transition：`transition: width var(--hp-duration-normal) var(--hp-ease-overlay)`

7. **安全区域**:
   - 底部操作栏：`paddingBottom: env(safe-area-inset-bottom, 0px)`
   - 操作栏总高度：`56px + safe-area-inset-bottom`

8. **Android 返回键**:
   - 编辑模式下拦截返回事件，先退出编辑模式（不清除选中直到确认）

9. **触控目标**:
   - 所有按钮 ≥ 44x44px
   - 行 checkbox 触控热区：整个行左侧 44px 区域

- **验收**: 在 375px 宽度视口下进入编辑模式，选中 3+ 文件执行批量删除成功；空目录时编辑按钮禁用；桌面端不受影响

### Task 36.7b: WriteFile 增加后端大小限制（新增）

- **优先级**: P0（安全评审标记为高优先级遗漏）
- **类型**: 安全
- **文件**: `cli/src/api/apiMachine.ts:321-351`（WriteFile handler）
- **问题**: WriteFile handler 无内容大小校验，攻击者可直接调 API 写入超大文件，DoS 或磁盘耗尽。前端 5MB 限制可绕过。
- **修复方案**:
  ```typescript
  const MAX_WRITE_FILE_BYTES = 10 * 1024 * 1024  // 10MB
  // WriteFile handler 中：
  const buffer = Buffer.from(typeof params.content === 'string' ? params.content : '', 'base64')
  if (buffer.length > MAX_WRITE_FILE_BYTES) {
    return { success: false, error: `File content exceeds maximum size of 10MB` }
  }
  ```
- **Hub 层预校验**（可选但推荐）: `machines.ts` PUT 路由中也检查 `content` 字段的 base64 长度估算
- **前端对齐**: 将前端上传限制从 5MB 调整为 10MB，与后端一致
- **验收**: 写入超过 10MB 内容返回错误；前端显示文件过大提示；正常大小文件不受影响

---

## 第二轮：发布后优化（P1 级，共 5 个）

### Task 36.7: 统一 Dialog 实现

- **文件**: `FileManager/Dialog.tsx`、`components/ui/dialog.tsx`
- **修复方案**: 将 FileManager Dialog 功能封装为 Radix Dialog wrapper
- **验收清单**（量化）:
  - [ ] 点击 overlay 关闭行为一致
  - [ ] Escape 关闭行为一致
  - [ ] Tab 焦点循环行为一致
  - [ ] 打开动画曲线和时长一致
  - [ ] footer 按钮布局一致（primary 右侧）
  - [ ] danger 按钮样式统一

### Task 36.8: 拆分 FileManager 组件

- **文件**: `FileManager.tsx`（1372 行 → < 600 行）
- **抽取目标**:
  - `lib/file-utils.ts`: 工具函数（joinPath, normalizePath, basename, isValidFileName, isValidDestinationDir, arrayBufferToBase64, downloadBase64File, readBrowserFileAsBase64, getParentPath, buildReturnTo）
  - `FileManager/TransferDirectoryPicker.tsx`: 独立组件
  - `FileManager/ToolbarButton.tsx`: 独立组件
  - `FileManager/hooks/useFileManagerDialogs.ts`: 对话框逻辑
  - `FileManager/hooks/useFileManagerKeyboard.ts`: 键盘快捷键
  - `FileManager/hooks/useFileManagerSearch.ts`: 搜索逻辑
- **验收**: 主组件 < 600 行；所有抽取的模块有独立导出；typecheck 通过

### Task 36.9: 消除 browse/file.tsx 与 sessions/file.tsx 代码重复

- **文件**: `web/src/routes/browse/file.tsx`（520行）、`sessions/file.tsx`（616行）
- **修复方案**: 抽取 `hooks/useFileEditor.ts` + `components/FileEditorView.tsx`
- **验收**: 两个路由页面各 < 100 行；共享逻辑集中管理

### Task 36.10: InputField 增加 ARIA label

- **文件**: `FileManager/Dialog.tsx:168-193`
- **修复**: `<input>` 添加 `aria-label`
- **验收**: 屏幕阅读器（VoiceOver/NVDA）可正确播报输入框用途

### Task 36.11: 读/写文件增加大小限制

- **文件**: `cli/src/api/apiMachine.ts:297-319`
- **修复**: ReadFile 增加 10MB 上限
- **验收**: 读取超过 10MB 文件返回友好错误

---

## 第三轮：持续改进（P2 级，共 8 个）

### Task 36.12: FileManager inline style 迁移至 CSS
### Task 36.13: Hover 状态迁移至 CSS `:hover`
### Task 36.14: 搜索性能优化（下推到 CLI runner 侧）
### Task 36.15: 暗色模式 tertiary 文本对比度修复（52% → 58%）
### Task 36.16: FileIcon 暗色模式适配
### Task 36.17: 测试覆盖补全（PathExists 安全测试 + Session handler 扩展 + RPC 错误路径）
### Task 36.18: Toast 增强（error 不自动消失 + 关闭按钮）
### Task 36.19: 信息密度优化（窄屏搜索折叠、工具栏精简）

---

## 任务依赖关系

```
第一轮（发布阻断，7 个任务可并行）:
  36.1  arrayBufferToBase64 ─────┐
  36.2  isValidFileName ─────────┤
  36.3  isValidDestinationDir ───┤
  36.4  PathExists 沙箱 ─────────┤──→ bun run typecheck → bun run build → 测试 → commit → push
  36.5  Hub try-catch ───────────┤
  36.6  移动端编辑模式 ──────────┤
  36.7b WriteFile 大小限制 ─────┘

第二轮（发布后优化，有依赖）:
  36.7  统一 Dialog ─────→ 36.8 拆分 FileManager ──→ 36.9 消除重复
  36.10 ARIA label          36.11 读文件大小限制

第三轮（持续改进，可并行）:
  36.12 ~ 36.19
```

## 估时

| 轮次 | 预估工时 | 任务数 |
|------|---------|--------|
| 第一轮 | 4-5 小时 | 7 个 |
| 第二轮 | 4-5 小时 | 5 个 |
| 第三轮 | 3-4 小时 | 8 个 |
| **总计** | **11-14 小时** | **20 个** |

## 验收标准

### 第一轮完成标准
- [ ] 所有 7 个阻断项修复，含测试用例
- [ ] 安全测试：`C:foo`、`../../etc`、`/etc/passwd` 探测、10MB+ 写入均被拦截
- [ ] 移动端：375px 宽度下可进入编辑模式、选中 3+ 文件、批量删除
- [ ] Hub 所有文件操作路由有 try-catch，RPC 超时返回 JSON 500
- [ ] 现有测试套件全部通过（回归验证）
- [ ] `bun run typecheck` 通过
- [ ] `bun run build` 成功
- [ ] 重建后服务正常启动，文件管理功能全部可用

### 第二轮完成标准
- [ ] 仅一套 Dialog 实现（Radix-based）
- [ ] FileManager.tsx < 600 行
- [ ] browse/file.tsx 和 sessions/file.tsx 各 < 100 行
- [ ] 所有输入框有 ARIA label
- [ ] 读写文件均有 10MB 大小限制

### 第三轮完成标准
- [ ] impeccable audit 评分 ≥ 18/20
- [ ] impeccable critique 评分 ≥ 35/40
- [ ] 测试覆盖安全路径完整
