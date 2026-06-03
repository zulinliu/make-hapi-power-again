# Requirements: Hapi Power v9 — UI 统一优化

**Defined:** 2026-06-03
**Core Value:** 所有子页面（Git/扩展/变更/时间线/撤销/上下文）与文件管理主页保持统一的视觉和交互体验

## v9 Requirements

### TOOLBAR — SessionHeader 响应式工具栏

- [ ] **TOOLBAR-01**: 桌面端 SessionHeader 直接显示 Files/Git/Extensions/Outline 图标按钮，与现有图标并排
- [ ] **TOOLBAR-02**: 移动端 SessionHeader 隐藏上述图标，保留在 "..." 菜单中（现有行为不变）
- [ ] **TOOLBAR-03**: 桌面端 "..." 菜单移除 Git/Extensions/Outline 入口，仅保留会话管理功能（重命名、归档等）
- [ ] **TOOLBAR-04**: 响应式断点切换平滑，无闪烁或布局跳变

### LAYOUT — 全局子页面布局统一

- [ ] **LAYOUT-01**: 所有子页面统一使用 `var(--app-*)` CSS 变量（消除 `var(--hp-*)` 残留）
- [ ] **LAYOUT-02**: 所有子页面 header/content/tab 统一使用 `max-w-content` 包裹
- [ ] **LAYOUT-03**: 所有子页面统一 `pt-[env(safe-area-inset-top)]` 安全区域处理（外层 div 方式）
- [ ] **LAYOUT-04**: 所有子页面返回按钮统一为 `h-8 w-8 rounded-full` 图标样式
- [ ] **LAYOUT-05**: 所有子页面 Tab 指示器统一使用绝对定位下划线（参考文件页）
- [ ] **LAYOUT-06**: 所有子页面 header padding 统一为 `p-3`（参考文件页）
- [ ] **LAYOUT-07**: 提取共享布局组件（SubPageLayout）供所有子页面复用
- [ ] **LAYOUT-08**: 统一涉及页面：Git、Extensions、Changes、Timeline、Undo、上下文管理

### CTXMENU — 右键菜单全局适配

- [ ] **CTXMENU-01**: 封装 `useContextMenu` hook，同时支持右键（桌面端）和 "..." 按钮（移动端）
- [ ] **CTXMENU-02**: 桌面端文件树支持右键弹出 ContextMenu
- [ ] **CTXMENU-03**: 移动端保持 "..." 按钮触发 ContextMenu（现有行为不变）
- [ ] **CTXMENU-04**: ContextMenu 组件统一使用 `var(--app-*)` CSS 变量
- [ ] **CTXMENU-05**: Git 文件列表支持右键弹出 ContextMenu（复用同一 hook）
- [ ] **CTXMENU-06**: 右键菜单在桌面端和移动端功能一致（Rename/Copy/Move/Delete 等）

### GITPREV — Git 状态文件预览

- [ ] **GITPREV-01**: Git Status tab 中点击变更文件可在侧面板/弹窗中预览文件内容
- [ ] **GITPREV-02**: 预览面板支持代码高亮（复用现有文件预览组件）
- [ ] **GITPREV-03**: 预览面板显示文件完整路径和变更状态（modified/added/deleted）
- [ ] **GITPREV-04**: 预览面板可直接跳转到文件管理页面对应文件

## Out of Scope

| Feature | Reason |
|---------|--------|
| Git 提交历史中的文件预览 | 用户确认仅关注状态页变更文件，提交历史 diff 已足够 |
| 新的设计系统重构 | 仅统一现有设计，不引入新的设计令牌体系 |
| 全新的导航架构重设计 | 保持现有侧边栏导航结构，仅优化 SessionHeader |
| 触摸手势优化 | 仅处理右键/"..."菜单双模式，不涉及手势系统 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOOLBAR-01 | Phase v9.1 | Pending |
| TOOLBAR-02 | Phase v9.1 | Pending |
| TOOLBAR-03 | Phase v9.1 | Pending |
| TOOLBAR-04 | Phase v9.1 | Pending |
| LAYOUT-01 | Phase v9.2 | Pending |
| LAYOUT-02 | Phase v9.2 | Pending |
| LAYOUT-03 | Phase v9.2 | Pending |
| LAYOUT-04 | Phase v9.2 | Pending |
| LAYOUT-05 | Phase v9.2 | Pending |
| LAYOUT-06 | Phase v9.2 | Pending |
| LAYOUT-07 | Phase v9.2 | Pending |
| LAYOUT-08 | Phase v9.2 | Pending |
| CTXMENU-01 | Phase v9.3 | Pending |
| CTXMENU-02 | Phase v9.3 | Pending |
| CTXMENU-03 | Phase v9.3 | Pending |
| CTXMENU-04 | Phase v9.3 | Pending |
| CTXMENU-05 | Phase v9.3 | Pending |
| CTXMENU-06 | Phase v9.3 | Pending |
| GITPREV-01 | Phase v9.4 | Pending |
| GITPREV-02 | Phase v9.4 | Pending |
| GITPREV-03 | Phase v9.4 | Pending |
| GITPREV-04 | Phase v9.4 | Pending |

**Coverage:**
- v9 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 after initial definition*
