# Hapi Power v0.20.0 统一工作台与多端体验重构设计方案

**日期**：2026-06-12
**目标版本**：`v0.20.0`
**目标分支**：`feat/v0.20.0`
**状态**：讨论定稿中，尚未进入实现
**范围**：`web/` 应用、`website/` 官网、README、Logo、截图、PWA/OG 资产、前端架构文档与公共组件文档

> 本文档沉淀当前已确认的 v0.20.0 前端统一重构方向。后续进入实现前，必须先完成 Git 作者门禁、当前工作区基线整理和原型评审。

---

## 1. 版本主题

### 中文

**v0.20.0 — 统一工作台与多端体验重构**

### 英文

**v0.20.0 — Unified Workbench & Adaptive Experience**

### 一句话目标

把 Hapi Power 从“功能堆叠型前端”重构为“统一、多端、可扩展、品牌一致的 AI 编码工作台”。

### 成功标准

- 用户在桌面端获得稳定、高效、可预测的多窗格工作台体验。
- 用户在移动端获得专门为触控、PWA、键盘、安全区设计的任务流体验。
- 所有页面、弹窗、抽屉、菜单、Toast、Banner、工具栏、底部栏遵循同一套组件和交互规则。
- `web/` 应用、`website/` 官网、README、截图、Logo、PWA 资产、OG 图与文案叙事统一。
- 后续新增功能必须复用公共组件和设计规范，避免继续产生新的割裂体验。

---

## 2. 已确认产品决策

| 决策项 | 确认结果 |
|---|---|
| 重构范围 | 包含 `web/` 应用和 `website/` 官网 |
| 视觉方向 | 继续沿用 **Command Deck With Warm Power / 电光橙 / 力量几何** |
| 原型标准 | 先做 **可点击高保真 HTML 原型** |
| 多端策略 | 桌面端与移动端分别设计原型，不做单纯响应式缩小 |
| 实施策略 | 先底层组件系统，再逐页迁移 |
| Git 策略 | 当前大量未提交修改需先整理为基线 commit，再进入 v0.20.0 |
| 版本目标 | 按规范提升为 `feat/v0.20.0` 大版本 |
| 官网定位 | 产品官网 + 开源可信区 |
| 移动底栏 | 聊天 / 文件 / Git / 终端 / 资产 |
| 会话资产 | 保留一级功能 |
| Browse 命名 | 彻底改名为 Files / 文件 |

---

## 3. 命名体系

### 3.1 命名原则

主 UI 使用工具型命名，品牌隐喻只允许出现在营销叙事、历史说明或辅助文案中。

规则：

1. 主导航不使用“星桥、脉络、织锦、光标、脉冲”等隐喻命名。
2. 功能名优先回答“用户点击后能做什么”。
3. 中文名优先 2 到 6 字。
4. 英文名优先使用通用开发工具词汇。
5. 品牌感主要通过视觉系统、动效、语气和产品叙事表达，而不是靠功能名造词。

### 3.2 核心命名映射

| 旧命名 / 旧概念 | 新中文名 | 新英文名 | 说明 |
|---|---|---|---|
| 五节点 AI 编码工程闭环 | 核心工具链 | Core Workbench Toolkit | 官网与 README 的能力总称 |
| Model Nexus / 模型星桥 | 模型与供应商 | Models & Providers | Provider、API Key、模型发现、模型路由 |
| Guide Beam / 引导光标 | 实时引导 | Live Guidance | Agent 运行中纠偏、立即引导、排队发送 |
| Context Pulse / 上下文脉冲 | 上下文监控 | Context Monitor | 上下文占用、可靠性风险、诊断信息 |
| Git Atlas / Git 脉络 | Git 管理 | Git Manager | 分支、Diff、提交、同步、风险确认 |
| Session Loom / 会话织锦 | 会话资产 | Session Assets | 大纲、导出、综合、项目记忆 |
| Browse / 浏览 | 文件 / 文件管理 | Files / File Manager | 文件浏览、搜索、上传、编辑入口 |

### 3.3 主导航命名

| 中文 | 英文 | 说明 |
|---|---|---|
| 会话 | Sessions | AI Agent 对话与执行主入口 |
| 文件 | Files | 文件管理、浏览、搜索、编辑入口 |
| Git | Git | Git 管理，不做隐喻包装 |
| 终端 | Terminal | PTY 终端 |
| 会话资产 | Session Assets | 会话大纲、导出、综合、资产沉淀 |
| 扩展 | Extensions | Skills / Plugins |
| 设置 | Settings | 全局配置 |

### 3.4 设置内命名

| 中文 | 英文 |
|---|---|
| 模型与供应商 | Models & Providers |
| 外观 | Appearance |
| 语言 | Language |
| 聊天 | Chat |
| 通知 | Notifications |
| 关于 | About |

---

## 4. 信息架构

### 4.1 桌面端结构

桌面端是多窗格工作台，强调键盘、鼠标、右键、hover、快捷键、拖拽和分栏效率。

```text
┌──────────────────────────────────────────────────────────┐
│ 顶部全局栏：品牌 / 当前工作区 / 连接状态 / 搜索 / 设置      │
├────────────────┬───────────────────────────┬─────────────┤
│ 左侧会话/项目栏 │ 中间主工作区                │ 右侧检查器    │
│                │ Chat / Files / Git / 等    │ Inspector   │
└────────────────┴───────────────────────────┴─────────────┘
```

桌面端原则：

- 左侧稳定展示会话、项目、目录分组。
- 中间承载当前主要任务。
- 右侧 Inspector 用于上下文监控、文件详情、Git Diff、提交篮、资产详情、运行状态。
- 工具入口位置稳定，避免每个页面自造一套工具栏。
- 大型任务优先使用 split pane、side panel、inspector，而不是频繁 modal。

### 4.2 移动端结构

移动端是任务栈，不是桌面三栏的缩小版。

固定底栏：

```text
聊天 / 文件 / Git / 终端 / 资产
```

更多入口：

```text
扩展 / 设置 / 模型与供应商 / 关于
```

移动端原则：

- 所有关键操作必须可见，不以 hover、右键、长按作为唯一入口。
- 触控目标默认不小于 44px。
- 复杂任务拆成分步流，例如 Git：变更列表 → Diff → 加入提交篮 → 提交/同步。
- 短任务使用 bottom sheet，长任务使用 full-screen sheet 或独立页面。
- composer、bottom bar、toast、banner、键盘、safe-area 必须统一避让。

---

## 5. 高保真 HTML 原型计划

### 5.1 目录结构

```text
.planning/sketches/v0.20-unified-workbench/
├── desktop.html
├── mobile.html
├── pattern-lab.html
├── README.md
└── assets/
```

### 5.2 Desktop Prototype 覆盖范围

`desktop.html` 必须覆盖：

- 登录与 Hub 绑定。
- 会话列表、目录分组、状态显示。
- Chat 主工作区。
- 文件管理。
- Git 管理。
- 终端。
- 会话资产。
- 扩展。
- 设置。
- 模型与供应商。
- 右侧 Inspector。
- 统一 dialog、side panel、popover、context menu、toast、banner。
- 空状态、加载态、错误态、禁用原因。

### 5.3 Mobile Prototype 覆盖范围

`mobile.html` 必须覆盖：

- 移动登录。
- 会话列表。
- 底部五栏：聊天、文件、Git、终端、资产。
- Chat composer 与键盘弹起场景。
- 文件移动任务流。
- Git Diff 分步流。
- Terminal quick keys。
- 会话资产导出。
- 模型与供应商 bottom sheet。
- PWA 安装、更新、离线、重连。
- safe-area、bottom sheet、toast、banner 同时出现的避让规则。

### 5.4 Pattern Lab 覆盖范围

`pattern-lab.html` 用于组件系统落地前的交互基准验证，必须覆盖：

- Dialog。
- Alert Dialog。
- Side Panel。
- Bottom Sheet。
- Popover。
- Context Menu / Action Sheet。
- Toast。
- Banner。
- Tabs。
- Toolbar。
- Bottom Command Bar。
- Loading / Empty / Error / Success。
- Disabled reason。
- Reduced motion。
- Focus return。
- Keyboard navigation。

---

## 6. 底层组件系统

### 6.1 Layout 层

候选组件：

- `AdaptiveProvider`
- `WorkbenchShell`
- `SessionWorkspace`
- `PageScaffold`
- `ModulePage`
- `InspectorPane`
- `MobileTaskStack`
- `BottomCommandBar`

职责：

- 统一桌面三栏、移动栈式导航、平板混合布局。
- 统一 header、toolbar、content、footer、inspector。
- 统一安全区、键盘避让、底部命令栏占位。

### 6.2 Overlay 层

候选组件：

- `OverlaySurface`
- `AlertSurface`
- `SidePanel`
- `BottomSheet`
- `PopoverSurface`
- `ActionMenu`
- `ConfirmAction`
- `ToastViewport`
- `BannerStack`

规则：

- 所有 overlay 必须走 portal。
- 所有 overlay 使用统一 z-index 语义层。
- 所有 dialog/sheet/action menu 必须支持焦点恢复。
- 移动端按任务类型自动映射为 bottom sheet、full-screen sheet 或独立页面。
- 禁止页面私自写 `fixed z-50` 弹层作为长期方案。

### 6.3 Controls 层

候选组件：

- `Button`
- `IconButton`
- `Input`
- `Textarea`
- `Select`
- `SegmentedControl`
- `Tabs`
- `Switch`
- `RadioCardGroup`
- `SearchField`
- `Toolbar`
- `CommandCluster`

规则：

- 所有控件必须覆盖 default、hover、focus、active、disabled、loading、error 状态。
- 触控输入模式下不得因为 `sm`、`md`、`lg` 断点把可点击目标缩小到 44px 以下。
- 图标按钮必须有 `aria-label`，不能只依赖 `title`。

### 6.4 State 层

候选组件：

- `DataBoundary`
- `LoadingSkeleton`
- `EmptyState`
- `ErrorState`
- `DisabledReason`
- `InlineStatus`
- `ProgressRow`

规则：

- loading 优先 skeleton，不在内容中心孤立展示 spinner。
- empty state 必须给出下一步动作。
- error state 必须说明原因、影响和可恢复路径。
- disabled 必须能表达禁用原因。

### 6.5 Feature Shell 层

候选组件：

- `FileManagerShell`
- `FileViewerShell`
- `GitManagerShell`
- `TerminalShell`
- `SessionAssetsShell`
- `ModelsProvidersShell`

目标：

- Feature 组件只负责业务数据和业务动作。
- 页面布局、工具栏、弹窗、表单、反馈状态全部下沉到公共系统。

---

## 7. 迁移阶段

### Phase 0：基线整理

- 修正 Git author 为 `zulinliu`。
- 分类当前未提交修改。
- 提交当前基线。
- 创建 `feat/v0.20.0`。

### Phase 1：命名、信息架构、原型

- 更新命名规范。
- 输出 desktop/mobile/pattern-lab 高保真可点击原型。
- 更新 IA 文档。
- 更新设计系统文档。

### Phase 2：底层设计系统

- Tokens。
- Layout。
- Overlay。
- Controls。
- State components。
- Adaptive runtime。
- Motion tokens。
- Z-index / fixed layer system。

### Phase 3：低风险页面迁移

优先迁移：

- Settings。
- Models & Providers。
- Extensions。
- Session Assets。

### Phase 4：核心工具迁移

- Browse 彻底改名 Files。
- 统一 FileManager。
- 合并 `/browse/file` 与 `/sessions/:id/file` 的文件查看逻辑。
- Git 管理迁移为桌面 split + 移动分步流。
- Terminal quick keys 与移动粘贴 fallback 统一。

### Phase 5：Chat 迁移

- SessionHeader。
- Chat composer。
- 实时引导。
- 上下文监控。
- ToolCard。
- 消息流布局。

### Phase 6：官网与品牌资产

- 官网重构为产品官网 + 开源可信区。
- README 重写。
- Logo / screenshot / OG / PWA 资产更新。
- docs 发布白名单。
- 品牌规范文档。

### Phase 7：验收与发布准备

- Playwright 多端验收。
- 视觉回归。
- a11y。
- Lighthouse / PWA。
- typecheck / test / build。
- Git standards。
- sensitive info check。

---

## 8. 官网重构方向

### 定位

官网采用“产品官网 + 开源可信区”：

- 首屏强调 Hapi Power 是可控 AI 编码工作台。
- 中段展示核心工具链和真实产品界面。
- 后段展示开源可信信息：架构、安装、License、Security、Contributing、Release。

### 文案方向

不再以“离开办公桌、喝咖啡、睡觉 YOLO”等生活方式表达为主。核心语气改为：

- 有力。
- 精确。
- 温暖。
- 可信。
- 面向开发者。

### 截图规格

建议生成：

- `hero-workbench-light.png`：1600×1000。
- `hero-workbench-dark.png`：1600×1000。
- `mobile-control.png`：430×932。
- `core-toolkit-contact-sheet.png`：核心工具链总览。
- `og-image.png`：1200×630。

截图要求：

- 无 reconnect/error banner。
- 无调试浮窗。
- 使用 `example.com`、`git.internal.example.com`、`test-user`、`/home/tester/project` 等示例数据。
- 控制图片体积。
- 明暗主题各有代表图。

---

## 9. 验收矩阵

### 设备矩阵

| 类别 | 设备 / 尺寸 |
|---|---|
| 小屏 iOS | iPhone SE 375×667 Safari + PWA |
| 主流 iOS | iPhone 15/Pro 390/393×844/852 Safari + PWA |
| Android | 360×800、412×915 Chrome |
| 平板 | iPad 768×1024 竖屏、1024×768 横屏 |
| Hybrid | Surface / 触屏笔电 1366×768 coarse + fine |
| 桌面 | 1280×800、1440×900、1920×1080 |
| 容器环境 | Telegram Mini App、standalone PWA、普通浏览器 |

### 自动化门禁

- Playwright 多浏览器、多尺寸截图。
- `document.body.scrollWidth <= window.innerWidth`。
- coarse pointer 下可见 button/link/input 高宽不低于 44px。
- fixed overlay 不遮挡 composer / toolbar / bottom bar。
- axe-core a11y smoke。
- Lighthouse PWA / accessibility / best practices。
- Bundle budget，重点监控 Terminal、Monaco、Mermaid、Shiki、assistant-ui。
- Git standards。
- sensitive info check。

---

## 10. 实施前门禁

进入实现前必须完成：

1. 修正 Git author 为 `zulinliu`。
2. 梳理当前工作区所有未提交修改，避免把无关历史变更混入 v0.20.0。
3. 完成当前基线 commit。
4. 创建 `feat/v0.20.0` 分支。
5. 完成 desktop/mobile/pattern-lab 原型评审。
6. 明确第一个落地批次的文件范围，避免大爆炸式重构。

---

## 11. 当前开放讨论项

下一步建议继续讨论：

1. `desktop.html` 的具体屏幕结构和交互脚本。
2. `mobile.html` 的五栏任务流与 bottom sheet 规则。
3. `pattern-lab.html` 的组件状态矩阵。
4. `OverlaySurface`、`PageScaffold`、`BottomCommandBar` 的 API 设计。
5. 当前工作区基线整理策略。


---

## 12. 底层组件 API 决策

### 12.1 API 总原则

v0.20.0 的公共组件 API 采用 **混合模式，但优先数据驱动**。

目标不是只做 UI wrapper，而是让组件表达产品语义，并由公共层统一处理：

- 桌面 / 移动形态映射。
- safe-area 与 visual viewport。
- 键盘避让。
- z-index。
- 焦点陷阱与焦点返回。
- loading / empty / error / disabled reason。
- motion 与 reduced-motion。
- 触控目标尺寸。

### 12.2 数据驱动优先的组件

以下组件优先采用数据驱动 API，避免每个页面自由拼 children 造成再次失控：

- `ActionMenu`
- `BottomCommandBar`
- `Tabs`
- `SegmentedControl`
- `CommandPalette`
- `Toolbar` 中的标准操作组

优势：

- 桌面 / 移动映射更稳定。
- 更容易统一键盘行为与 a11y。
- 更容易测试。
- 更容易控制危险操作、禁用原因和快捷键提示。

### 12.3 Slot 驱动的组件

以下组件以 slot / children 为主，因为内容复杂且需要承载业务 UI：

- `OverlaySurface`
- `PageScaffold`
- `SessionWorkspace`
- `InspectorPane`
- `DataBoundary`

规则：

- slot 负责内容，不负责重新定义容器行为。
- overlay 的外壳、层级、焦点、关闭、移动端映射必须由公共组件控制。
- 页面不能通过 children 绕过公共组件的 z-index、safe-area、键盘避让和 reduced-motion 规则。

### 12.4 自定义扩展规则

当标准数据驱动 API 不够用时，允许使用受控扩展：

- `renderItem`
- `leading`
- `trailing`
- `footer`
- `toolbar`
- `inspector`
- `emptyFallback`
- `errorFallback`

禁止：

- 页面自建长期使用的 `fixed z-50` 弹层。
- 页面自建重复的 Toast、Dialog、ContextMenu。
- 只在某个页面本地定义按钮状态和 loading/empty/error 样式。
- 移动端只依赖 hover、右键、长按入口。

### 12.5 首批 API 草案

首批公共 API 聚焦五个核心组件：

1. `OverlaySurface`：统一 dialog、alert、side panel、popover、context menu、command palette、preview。
2. `PageScaffold`：统一页面 header、toolbar、tabs、content、footer、inspector、state。
3. `BottomCommandBar`：统一移动端底部主操作、批量操作、Git 操作、Terminal 操作。
4. `ActionMenu`：统一 Session、File、Git、Skill、Plugin、More menu 的桌面菜单与移动 action sheet。
5. `DataBoundary`：统一 loading、empty、error、offline、permission denied、stale data。

后续实现顺序应先完成这五个组件，再迁移低风险页面验证，不应一开始直接改 Chat 主流程。
