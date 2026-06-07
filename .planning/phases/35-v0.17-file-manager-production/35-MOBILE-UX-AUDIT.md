---
phase: 35-v0.17-file-manager-production
document: MOBILE-UX-AUDIT
version: v0.17.0
created: 2026-06-07
status: completed
skill: impeccable audit
scope:
  - web/src/components/FileManager
  - web/src/routes/browse/file.tsx
  - web/src/routes/sessions/files.tsx
---

# Mobile UX & Interaction Audit: v0.17.0 文件管理器

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3/4 | 语义按钮、focus trap、aria 基础良好；部分弹窗标题和小按钮触控仍需补强 |
| 2 | Performance | 2/4 | 大目录仍是全量渲染，无虚拟列表或分页；搜索和目录选择无结果缓存 |
| 3 | Responsive Design | 2/4 | 移动端结构可用，但多处按钮仍低于 44px 触控目标 |
| 4 | Theming | 3/4 | 大量使用 `--hp-*` tokens；少量 overlay 和尺寸仍硬编码 |
| 5 | Anti-Patterns | 4/4 | 未发现明显 AI slop；整体是克制的产品工具界面 |
| **Total** | | **14/20** | **Good，发布前建议处理 P1/P2 移动易用性问题** |

## Anti-Patterns Verdict

**Pass**。当前文件管理器不像 AI 生成的模板界面：

- 没有渐变文字、玻璃拟态、英雄指标、无意义卡片网格等常见 slop。
- 产品 UI 选择克制，主要依靠密度、列表、工具栏和状态反馈服务任务。
- 新增“复制路径”可见标签和移动端入口去重是正确方向。

需要注意的是，组件里仍有大量 inline style，短期不影响用户，但会降低长期设计系统一致性和可维护性。

## Executive Summary

- Audit Health Score: **14/20 Good**
- Total issues found: **P0: 0 / P1: 3 / P2: 8 / P3: 3**
- 发布阻断：无 P0。
- 发布前建议优先处理：移动端触控目标、移动/复制选择器行为简化、保存冲突操作条拥挤、大目录性能。

## Detailed Findings by Severity

### [P1] 移动端仍有多个低于 44px 的触控目标

- **Location**:
  - `web/src/components/FileManager/FileManager.tsx:271,284,293,360`
  - `web/src/components/FileManager/FileManager.tsx:1125,1150`
  - `web/src/routes/browse/file.tsx:443-455`
  - `web/src/components/FileManager/Dialog.tsx:117,138`
- **Category**: Responsive / Accessibility
- **Impact**: iOS 手机上容易误触或点不到，尤其是移动/复制目录选择器的“上一级 / 根目录 / 使用此文件夹”和保存冲突恢复按钮。
- **Standard**: iOS HIG / 项目 PRODUCT.md 要求触控目标最小 44x44px。
- **Recommendation**:
  1. 移动端把所有操作按钮最小高度统一到 44px。
  2. transfer picker 顶部三个按钮在窄屏改成两行或 full-width 分组。
  3. 保存错误恢复动作在移动端改成纵向按钮组或 action sheet。
- **Suggested command**: `$impeccable adapt FileManager mobile touch targets`

### [P1] 大目录全量渲染，生产文件管理器会在上千文件时卡顿

- **Location**:
  - `web/src/components/FileManager/DirectoryView.tsx`
  - `web/src/components/FileManager/FileManager.tsx` 的 `visibleEntries.map`
- **Category**: Performance
- **Impact**: workspace 中常见 `node_modules`、大型仓库目录、构建产物目录可能包含上千文件。全量 DOM 渲染、hover inline style、动画延迟会导致移动端明显掉帧。
- **Recommendation**:
  1. 目录行接入虚拟列表或分页。
  2. 超过阈值时关闭逐行动画。
  3. 大目录显示“已加载 N 项，可搜索过滤”的性能提示。
- **Suggested command**: `$impeccable optimize FileManager large directories`

### [P1] 移动/复制目录选择器行为仍有认知负担

- **Location**: `web/src/components/FileManager/FileManager.tsx:184-383,1294-1321`
- **Category**: Accessibility / Functional UX
- **Impact**: 点击目录行同时“选中目标”和“进入目录”，普通用户可能不确定最终目标是父目录还是子目录。移动 / 复制属于高风险操作，目标选择必须非常明确。
- **Recommendation**:
  1. 目录行点击只进入目录。
  2. 另设“选择此文件夹”主按钮，明确选择当前浏览目录。
  3. 或每行右侧增加“选择”按钮，避免导航和选择复用一个点击。
- **Suggested command**: `$impeccable harden transfer directory picker`

### [P2] 搜索区同时承担“本地过滤”和“深度搜索”，文案仍可能混淆

- **Location**:
  - `web/src/components/FileManager/FileManager.tsx:1030-1112`
  - `web/src/lib/locales/zh-CN.ts:764`
- **Category**: Functional UX / Copy
- **Impact**: 输入框 placeholder 是“过滤名称或搜索文件”，但输入后会立即本地过滤；点击“搜索”才是深度搜索。用户不容易理解“过滤”和“搜索”的边界。
- **Recommendation**:
  1. 输入框改为“过滤当前目录”。
  2. 深度搜索按钮改为“搜索子目录”或“全局搜索”。
  3. 内容模式下提示“将搜索当前目录及子目录内容”。
- **Suggested command**: `$impeccable clarify FileManager search copy`

### [P2] 新建弹窗中文标题“新建项目”语义偏大

- **Location**: `web/src/lib/locales/zh-CN.ts:837`
- **Category**: Functional UX / Copy
- **Impact**: 文件管理器内“项目”容易被理解为 workspace/project，而不是 file/folder item。
- **Recommendation**: 改为“新建文件或文件夹”。英文 `New item` 可以保留或改为 `New file or folder`。
- **Suggested command**: `$impeccable clarify FileManager create dialog`

### [P2] 底部“会话”按钮对新用户不够具体

- **Location**:
  - `web/src/components/FileManager/FileManager.tsx:1223-1236`
  - `web/src/lib/locales/zh-CN.ts:869`
- **Category**: Functional UX / Copy
- **Impact**: “会话”不像动作，用户不确定是打开已有会话、创建会话，还是从目录启动 AI 会话。
- **Recommendation**: 移动端可用“启动”或“启动会话”，图标从 `▶` 改为更明确的 bot/session icon；若宽度不足，长按/tooltip 不是替代，应优先可见文案。
- **Suggested command**: `$impeccable clarify FileManager bottom toolbar`

### [P2] 路径栏“复制路径”在极窄屏会占用 breadcrumb 空间

- **Location**: `web/src/components/FileManager/BreadcrumbNav.tsx:128-151`
- **Category**: Responsive
- **Impact**: 文案解决了语义问题，但 320-390px 宽度下会压缩面包屑，深层目录时当前位置可见信息减少。
- **Recommendation**:
  1. 390px 以下显示短文案“复制”。
  2. 或使用响应式 CSS：`复制路径` 在 `max-width: 360px` 时隐藏“路径”，保留“复制”。
- **Suggested command**: `$impeccable adapt Breadcrumb copy action`

### [P2] Browse file 预览页顶部复制/下载按钮桌面尺寸偏小

- **Location**: `web/src/routes/browse/file.tsx:300-315`
- **Category**: Accessibility / Responsive
- **Impact**: 移动端已有部分 `max-md:min-h-[44px]`，但文件标题栏的复制/下载按钮在桌面和部分触控设备上仍是 14px icon + `p-1.5`。
- **Recommendation**: 触控设备通用提升到 36-40px，移动端 44px。
- **Suggested command**: `$impeccable adapt BrowseFilePage toolbar`

### [P2] 保存冲突恢复操作在移动端过密

- **Location**: `web/src/routes/browse/file.tsx:439-456`
- **Category**: Functional UX / Responsive
- **Impact**: “重试 / 重新加载 / 强制覆盖 / 复制内容”横向堆在一个错误条里，移动端容易横向拥挤，且强制覆盖属于危险操作，应该更醒目并二次确认。
- **Recommendation**:
  1. 移动端改为纵向恢复面板。
  2. “强制覆盖”前增加确认。
  3. 默认主动作只保留“重试”和“复制内容”，危险动作折叠。
- **Suggested command**: `$impeccable harden save conflict recovery`

### [P2] 会话文件页内 FileManager 高度使用固定估算

- **Location**: `web/src/routes/sessions/files.tsx:378`
- **Category**: Responsive
- **Impact**: `h-[calc(100dvh-190px)] min-h-[520px]` 在小屏或横屏可能让内部滚动和外层滚动叠加，影响返回、底部工具栏和安全区域。
- **Recommendation**: 使用 flex 布局继承父容器剩余高度，避免 magic number；必要时把 session files page 改成全高子页布局。
- **Suggested command**: `$impeccable layout SessionFiles FileManager height`

### [P2] Dialog 标题只用 `aria-label`，没有 `aria-labelledby`

- **Location**: `web/src/components/FileManager/Dialog.tsx:75-99`
- **Category**: Accessibility
- **Impact**: 屏幕阅读器可读标题，但实际标题节点没有被显式关联，语义不如标准 dialog。
- **Recommendation**: 给标题元素加 id，dialog 使用 `aria-labelledby`；必要时补 description 区域。
- **Suggested command**: `$impeccable harden FileManager dialog semantics`

### [P2] 行项目主点击“打开”和选择状态耦合

- **Location**: `web/src/components/FileManager/DirectoryView.tsx:81-100,150-183`
- **Category**: Functional UX
- **Impact**: 点击行会立即打开文件或进入目录，同时也设置 selectedPath。移动端如果用户想先选中再操作，只能点右侧 ⋮，选择状态本身对移动端可操作性帮助有限。
- **Recommendation**:
  1. 移动端明确区分“打开区域”和“更多操作”。
  2. 若保留点击即打开，选中态可弱化，减少误以为已进入批量选择。
- **Suggested command**: `$impeccable clarify File row interactions`

### [P3] Overlay 背景使用硬编码 OKLCH

- **Location**: `web/src/components/FileManager/Dialog.tsx:67`
- **Category**: Theming
- **Impact**: 当前视觉可用，但与 `--app-overlay-bg` / token 系统不完全一致。
- **Recommendation**: 改为 `var(--app-overlay-bg)` 或新增 `--hp-overlay-bg`。
- **Suggested command**: `$impeccable polish FileManager tokens`

### [P3] Toolbar 图标风格仍有字符图标

- **Location**: `web/src/components/FileManager/FileManager.tsx:1224-1236,1326-1345`
- **Category**: Anti-Pattern / Polish
- **Impact**: `+`、`⇧`、`▶` 在系统字体里粗细不稳定，和 SVG 图标体系不完全一致。
- **Recommendation**: 换成一致 SVG icon，保持 20px 视觉框。
- **Suggested command**: `$impeccable polish FileManager icons`

### [P3] inline style 过多，长期维护成本高

- **Location**: `web/src/components/FileManager/*`
- **Category**: Theming / Maintainability
- **Impact**: 当前功能稳定，但响应式规则和状态样式散落在 JSX 中，后续微调容易漏改。
- **Recommendation**: 抽出常用按钮、工具栏、列表行、transfer picker 样式到 CSS 或小组件。
- **Suggested command**: `$impeccable polish FileManager style system`

## Patterns & Systemic Issues

1. **触控目标不统一**：核心列表行和底部 toolbar 已达到 44px，但弹窗内部、错误恢复条、上传/搜索辅助按钮仍有 32-40px 按钮。
2. **高风险操作缺少分层**：移动/复制、强制覆盖、删除等操作已能执行，但危险程度和默认主动作的视觉层级还可以更清楚。
3. **桌面逻辑直接压缩到移动端**：搜索区、保存冲突条、session files 高度都还有桌面布局遗留。
4. **性能策略还不是生产级大目录策略**：全量渲染适合中小目录，不适合 node_modules 或大型 monorepo 根目录。

## Positive Findings

- 移动端顶部主入口重复已经减少，底部 toolbar 方向正确。
- 文件行主区域和 ⋮ 操作按钮是语义 button，键盘 focus 基础完整。
- ContextMenu 有 menu/menuitem、键盘方向键、Escape、外部点击关闭，基础可访问性好。
- Dialog 有 focus trap、Escape、恢复焦点和 reduced motion。
- 颜色基本使用 `--hp-*` tokens，暗色模式风险低。
- `/browse/file` 返回、`returnTo`、剪贴板 fallback 修复显著提升了任务连续性。

## Recommended Actions

1. **[P1] `$impeccable adapt FileManager mobile touch targets`**: 统一移动端所有按钮到 44px，优先 transfer picker、上传/搜索辅助按钮、保存冲突恢复按钮。
2. **[P1] `$impeccable harden transfer directory picker`**: 分离“进入目录”和“选择目标”，降低移动/复制误操作。
3. **[P1] `$impeccable optimize FileManager large directories`**: 为大目录引入虚拟列表或分页，并关闭大目录逐行动画。
4. **[P2] `$impeccable clarify FileManager search/create/session copy`**: 简化搜索、新建、底部会话入口的文案，让功能边界更清楚。
5. **[P2] `$impeccable harden save conflict recovery`**: 移动端保存冲突恢复改为分层面板，危险动作二次确认。
6. **[P2] `$impeccable layout SessionFiles FileManager height`**: 移除 session files 中的高度 magic number，减少嵌套滚动。
7. **[P3] `$impeccable polish FileManager style system`**: 统一图标和抽离重复 inline styles。
8. **Final: `$impeccable polish FileManager mobile UX`**: 完成修复后做最终移动端视觉和交互收口。

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `$impeccable audit` after fixes to see your score improve.

## Follow-up Optimization Review: 2026-06-07

### 优化范围

按本审计建议继续落地了 P1 和关键 P2：

1. 移动端触控目标统一：FileManager 工具栏、搜索区、批量操作条、上传重试、搜索结果关闭、transfer picker、Dialog footer、文件预览复制/下载和保存冲突恢复按钮均提升到 44px 级别。
2. 移动/复制目录选择器硬化：目录行点击只负责进入目录，目标确认改由“选择当前文件夹”完成，避免“进入”和“选择”混在一次点击里。
3. 大目录性能缓解：超过 200 行关闭逐行动画；超过 500 项显示性能提示；目录行启用 `content-visibility: auto` 和 `contain-intrinsic-size` 降低滚动渲染压力。
4. 搜索、新建、底部会话入口文案澄清：搜索框改为“过滤当前目录”，深度搜索改为“搜索子目录”，新建弹窗改为“新建文件或文件夹”，底部“会话”改为“启动”。
5. 保存冲突恢复硬化：全局和会话文件页的保存错误恢复区移动端改为分组按钮，所有按钮 44px；“强制覆盖”新增二次确认。
6. 会话文件页移动布局：搜索和刷新按钮提升到 44px，目录 Tab 最小高度降低移动端溢出风险。
7. 设计系统收口：FileManager Dialog 使用 `aria-labelledby`，overlay 改用 token fallback；底部工具栏字符图标替换为一致 SVG。

### 复审评分

| # | Dimension | Before | After | Notes |
|---|---:|---:|---:|---|
| Accessibility | 3/4 | 4/4 | Dialog 标题关联、触控目标和危险操作确认已补齐 |
| Performance | 2/4 | 3/4 | 已做大目录动画关闭和 content-visibility；虚拟列表仍是后续增强 |
| Responsive Design | 2/4 | 3/4 | 主要移动触控问题关闭，session files 高度仍可继续结构化重构 |
| Theming | 3/4 | 4/4 | overlay token 化，新增 UI 继续使用 hp/app tokens |
| Anti-Patterns | 4/4 | 4/4 | 保持产品工具 UI 克制，无新增 slop |
| **Total** | **14/20** | **18/20** | **Excellent，剩余主要是性能增强和结构化布局优化** |

### 已关闭的原审计问题

- [x] P1 移动端低于 44px 触控目标。
- [x] P1 移动/复制目录选择器“进入”和“选择”行为混淆。
- [x] P2 搜索区文案混淆。
- [x] P2 新建弹窗“新建项目”语义偏大。
- [x] P2 底部“会话”按钮不够具体。
- [x] P2 路径栏复制按钮极窄屏挤压风险已缓解。
- [x] P2 Browse file 顶部复制/下载按钮触控偏小。
- [x] P2 保存冲突恢复操作移动端过密。
- [x] P2 Dialog 标题语义未显式关联。
- [x] P3 overlay 硬编码色。
- [x] P3 底部 toolbar 字符图标不统一。

### 剩余建议

1. **虚拟列表 / 分页**：当前只是缓解大目录滚动压力，真正超大目录仍建议引入 virtualization。
2. **Session files 高度结构化**：本轮降低了移动端 min-height，但彻底消除 magic number 需要 SubPageLayout 支持 full-height content slot。
3. **内联样式系统化**：FileManager 已稳定，但长期建议抽取 toolbar/button/picker 样式组件。
