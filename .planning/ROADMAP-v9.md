# Roadmap: Hapi Power v9 — UI 统一优化

## Overview

v9 聚焦于 UI 一致性优化：SessionHeader 工具栏响应式适配、所有子页面布局统一（参考文件管理页）、右键菜单全局适配（桌面端右键 + 移动端"..."按钮）、Git 状态页文件预览。4 个阶段，粗粒度。

## Phases

- [ ] **Phase v9.1: SessionHeader 响应式工具栏** — 桌面端直接显示功能图标，移动端收入菜单
- [ ] **Phase v9.2: 全局子页面布局统一** — 提取共享布局组件，统一所有子页面样式
- [ ] **Phase v9.3: 右键菜单全局适配** — useContextMenu hook + 桌面右键 + 移动端"..."
- [ ] **Phase v9.4: Git 状态文件预览** — 在状态 tab 中预览变更文件内容

## Phase Details

### Phase v9.1: SessionHeader 响应式工具栏
**Goal:** 桌面端 SessionHeader 直接显示 Files/Git/Extensions/Outline 图标，移动端保持"..."菜单入口
**Mode:** mvp
**Depends on:** Nothing（独立于其他 v9 阶段）
**Requirements:** TOOLBAR-01, TOOLBAR-02, TOOLBAR-03, TOOLBAR-04
**Success Criteria**:
  1. 桌面端 SessionHeader 右侧可见 Files/Git/Extensions/Outline 4 个图标按钮，与现有图标风格一致
  2. 移动端 SessionHeader 不显示上述图标，"..."菜单中仍可访问
  3. 桌面端 "..." 菜单不再包含 Git/Extensions/Outline 入口
  4. 响应式切换（断点处）无闪烁或布局跳变
  5. 各图标导航到对应页面正确

**Key Files:**
- `web/src/components/SessionHeader.tsx` — 修改工具栏渲染逻辑
- `web/src/components/SessionActionMenu.tsx` — 移除桌面端工具入口

**Plans:** 1 plan

Plans:
- [ ] v9.1-01: SessionHeader 响应式工具栏实现

### Phase v9.2: 全局子页面布局统一
**Goal:** 提取共享 SubPageLayout 组件，所有子页面使用统一的 CSS 变量、max-w-content、安全区域、返回按钮、Tab 指示器和 padding
**Mode:** mvp
**Depends on:** Nothing（可与 v9.1 并行）
**Requirements:** LAYOUT-01 ~ LAYOUT-08
**Success Criteria**:
  1. SubPageLayout 共享组件可被所有子页面复用（header + content + tab slots）
  2. Git 页面不再使用 `var(--hp-*)` 变量，全部切换到 `var(--app-*)`
  3. 所有子页面 header 使用 `max-w-content` + `p-3` + `pt-[env(safe-area-inset-top)]` 外层 div
  4. 所有子页面返回按钮统一为 `h-8 w-8 rounded-full` 图标
  5. 所有子页面 Tab 指示器使用绝对定位下划线样式
  6. ContextMenu 组件使用 `var(--app-*)` 变量

**Key Files:**
- `web/src/components/ui/SubPageLayout.tsx` — 新建共享布局组件
- `web/src/routes/sessions/git.tsx` — Git 页面布局重构
- `web/src/routes/sessions/extensions.tsx` — Extensions 页面布局调整
- `web/src/routes/sessions/changes.tsx` — 变更审查页面调整
- `web/src/routes/sessions/timeline.tsx` — 时间线页面调整
- `web/src/routes/sessions/undo.tsx` — 撤销页面调整
- `web/src/components/git/*.tsx` — Git 子组件 CSS 变量替换
- `web/src/components/ui/ContextMenu.tsx` — CSS 变量统一

**Plans:** 2 plans

Plans:
- [ ] v9.2-01: 提取 SubPageLayout 共享组件 + CSS 变量统一
- [ ] v9.2-02: 所有子页面迁移到 SubPageLayout

### Phase v9.3: 右键菜单全局适配
**Goal:** 封装 useContextMenu hook，桌面端支持原生右键菜单，移动端保持"..."按钮，统一应用到文件管理和 Git 文件列表
**Mode:** mvp
**Depends on:** Phase v9.2（需要 SubPageLayout 和 CSS 变量统一先完成）
**Requirements:** CTXMENU-01 ~ CTXMENU-06
**Success Criteria**:
  1. useContextMenu hook 同时处理右键事件和"..."按钮点击
  2. 桌面端文件树右键可弹出 ContextMenu，功能与"..."按钮一致
  3. 移动端"..."按钮行为不变
  4. ContextMenu 使用统一的 `var(--app-*)` 样式
  5. Git 文件列表（Status tab 中的文件行）支持右键菜单
  6. 桌面和移动端菜单功能完全一致

**Key Files:**
- `web/src/hooks/useContextMenu.ts` — 新建统一 hook
- `web/src/components/SessionFiles/DirectoryTree.tsx` — 添加右键支持
- `web/src/components/ui/ContextMenu.tsx` — 更新以支持双触发模式
- `web/src/components/git/GitStatusPanel.tsx` — 添加文件列表右键支持

**Plans:** 2 plans

Plans:
- [ ] v9.3-01: useContextMenu hook 封装 + ContextMenu 组件更新
- [ ] v9.3-02: 文件树和 Git 文件列表接入右键菜单

### Phase v9.4: Git 状态文件预览
**Goal:** 在 Git Status tab 中点击变更文件可在侧面板预览文件内容，支持代码高亮和跳转
**Mode:** mvp
**Depends on:** Phase v9.3（右键菜单提供操作入口）
**Requirements:** GITPREV-01 ~ GITPREV-04
**Success Criteria**:
  1. Git Status tab 中每个变更文件可点击预览
  2. 预览面板显示文件完整内容，带代码高亮
  3. 预览面板显示文件路径和变更状态标签（modified/added/deleted）
  4. 预览面板有"在文件管理中打开"按钮，可跳转到对应文件
  5. 已删除文件显示提示而非预览

**Key Files:**
- `web/src/components/git/GitStatusPanel.tsx` — 添加文件点击预览
- `web/src/components/git/GitFilePreview.tsx` — 新建文件预览面板
- `web/src/routes/sessions/git.tsx` — 集成预览面板

**Plans:** 1 plan

Plans:
- [ ] v9.4-01: Git 状态页文件预览面板实现

---
*Roadmap created: 2026-06-03*
*Last updated: 2026-06-03 after initial creation*
