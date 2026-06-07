---
phase: 35-v0.17-file-manager-production
document: FOLLOWUP-AUDIT
version: v0.17.0
created: 2026-06-07
status: completed
skills:
  - impeccable harden
  - gsd-debug
  - gsd-audit-fix
---

# Follow-up Audit: v0.17.0 文件管理器交互回归

## 触发反馈

用户在 v0.17.0 分支继续检查文件管理器后反馈 6 个问题：

1. 从文件管理器点“会话”进入 `/sessions/new` 后，取消或返回固定回到主会话列表，而不是回到来源页面。
2. 移动端同屏仍有顶部和底部两套“新建 / 上传”入口。
3. 进入 `/browse/file` 预览后，文件管理器“返回上一级”失效，并且 `/browse` 顶部返回与预览页返回形成 `/browse` 和 `/browse/file` 无限循环。
4. 移动 / 复制弹窗只有路径输入，缺少文件夹浏览选择能力。
5. 复制路径提示剪贴板不可用。
6. 路径栏右侧“剪贴板”按钮语义不清，用户不知道它用于复制当前路径。

## 深度定位

### 1. 新建会话返回丢失来源

代码位置：

- `web/src/components/FileManager/FileManager.tsx`
- `web/src/router.tsx`
- `web/src/hooks/useAppGoBack.ts`

根因：FileManager 跳转 `/sessions/new` 时只传了 `directory` 和 `machineId`，没有携带来源。`NewSessionPage.handleCancel` 和 `useAppGoBack` 对 `/sessions/new` 固定导航到 `/sessions`，因此从 `/browse` 进入也回主页面。

修复策略：新增安全本地 `returnTo`，从 FileManager 启动会话时传入当前来源；`/sessions/new` 取消和顶部返回优先解析 `returnTo`，只允许回 `/browse`、`/sessions`、`/sessions/:id/files`，避免开放重定向。

### 2. 移动端重复入口

代码位置：

- `web/src/components/FileManager/FileManager.tsx`
- `web/src/styles/file-manager.css`

根因：底部工具栏是 `md:hidden`，但顶部“新建 / 上传”按钮使用内联 `display: inline-flex`，没有在移动端隐藏，导致移动端出现两套同功能入口。

修复策略：桌面保留顶部入口，移动端隐藏顶部“新建 / 上传”，只保留底部工具栏。保留顶部“上一级 / 显示隐藏文件 / 项目数”作为路径与状态工具，不再重复主要操作。

### 3. `/browse` 与 `/browse/file` 返回循环 + 上一级失效

代码位置：

- `web/src/routes/browse/file.tsx`
- `web/src/router.tsx`
- `web/src/hooks/useAppGoBack.ts`
- `web/src/components/FileManager/FileManager.tsx`

根因分两层：

1. `/browse/file` 的返回按钮使用 `navigate({ to: '/browse' })`，默认 push 新历史项。随后 `/browse` 顶部返回走 fallback `router.history.back()`，回到刚才的 `/browse/file`，形成历史栈循环。
2. `/browse?path=父目录` 回到浏览页后，FileManager 把 `initialPath` 同时当作当前目录和根目录，导致 `getParentPath(currentPath, rootPath)` 返回 `null`，所以“返回上一级”被禁用。

修复策略：

- `/browse/file` 返回 `/browse` 时使用 `replace: true`，不新增历史项。
- `useAppGoBack` 对 `/browse` 增加显式返回 `/sessions`，不再盲目 history.back。
- FileManager 增加独立 `rootPath` prop，`/browse` 传 workspace root，`initialPath` 只表示当前打开目录。

### 4. 移动 / 复制缺少目录选择

代码位置：

- `web/src/components/FileManager/FileManager.tsx`
- 旧参考：`web/src/components/ui/FileDialogs.tsx` 只支持 session tree，不适配 machine mode。

根因：Phase 35.3 为了快速接通真实 move/copy API，把目标选择简化成路径输入，牺牲了普通用户需要的文件夹浏览选择。

修复策略：在 FileManager transfer dialog 内新增通用 `TransferDirectoryPicker`，复用当前 FileManager 的 machine list/mock list 能力；保留路径输入作为高级路径能力，同时提供根目录、上一级、使用此文件夹、子目录浏览。

### 5. 复制路径失败

代码位置：

- `web/src/components/FileManager/FileManager.tsx`
- 已有可复用能力：`web/src/lib/clipboard.ts`

根因：FileManager 本地 `copyToClipboard` 只检查 `navigator.clipboard.writeText`，没有使用项目已有的 `safeCopyToClipboard` fallback。非 HTTPS、iOS PWA、权限受限或测试环境会直接提示不可用。

修复策略：FileManager 改用 `safeCopyToClipboard`，先走现代 Clipboard API，失败后走隐藏 textarea + `execCommand('copy')`，最后才提示失败。

### 6. 路径栏复制按钮语义不清

代码位置：

- `web/src/components/FileManager/BreadcrumbNav.tsx`
- `web/src/lib/locales/en.ts`
- `web/src/lib/locales/zh-CN.ts`

根因：路径栏右侧是纯复制图标，移动端没有 tooltip，用户只能理解为“剪贴板”但不知道动作结果。

修复策略：按钮改为图标 + “复制路径”文本，成功 toast 改成“当前路径已复制”，失败 toast 说明可手动复制路径。

## 修复验收清单

- [x] 从 `/browse` 底部“会话”进入 `/sessions/new` 后，取消回到原 `/browse?path=当前目录`。
- [x] `/sessions/new` 顶部返回与取消行为一致。
- [x] 移动端顶部不再显示“新建 / 上传”，底部保留这两个主操作。
- [x] `/browse/file` 返回后，文件管理器“返回上一级”仍可从父目录继续上行到 workspace root。
- [x] `/browse` 顶部返回不会进入 `/browse/file` 循环。
- [x] 移动 / 复制弹窗可以浏览文件夹并选择目标目录。
- [x] 复制路径在 Clipboard API 不可用时走 fallback，不再优先提示“剪贴板不可用”。
- [x] 路径栏按钮明确显示“复制路径”。
- [x] `bun run typecheck`、`bun run test:web`、`git diff --check` 通过。

## 设计把关结论

按 `impeccable harden` 产品 UI 原则，本次修复重点不是新增视觉装饰，而是去除用户任务中的“意外”：

- 返回必须显式，不依赖不可控历史栈。
- 移动端一个主动作只保留一个可见入口。
- 移动 / 复制这类高风险操作必须有可浏览、可确认的目标选择。
- 剪贴板能力必须渐进增强，有 fallback 和明确错误文案。
