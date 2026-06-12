# Hapi Power v0.20.0 高保真 HTML 原型

日期：2026-06-12  
分支：`feat/v0.20.0`  
范围：`web/` 应用、`website/` 官网与品牌资产重构前的体验基准原型。

## 原型文件

| 文件 | 目标 | 验证重点 |
|---|---|---|
| `desktop.html` | 桌面端统一工作台 | 顶栏、侧栏、主工作区、Inspector、Chat / Files / Git / Terminal / Assets / Extensions / Settings / Models & Providers、统一 Overlay、Toast、Banner、键鼠入口 |
| `mobile.html` | 移动端触控任务流 | 底部五栏：聊天 / 文件 / Git / 终端 / 资产；More Sheet；Git 分步流；键盘避让；safe-area；bottom sheet / confirm sheet |
| `pattern-lab.html` | 设计系统交互基准 | tokens、按钮、tabs、toolbar、ActionMenu、OverlaySurface、DataBoundary、状态矩阵、动效与 a11y 验收 |
| `assets/prototype.css` | 共用视觉与布局样式 | Command Deck With Warm Power / 电光橙 / 力量几何 |
| `assets/prototype.js` | 共用可点击交互脚本 | 模块切换、移动底栏、overlay、toast、Git stepper、键盘避让预览 |
| `COMPONENT-API-HANDOFF.md` | 首批公共组件 API 草案 | OverlaySurface、PageScaffold、BottomCommandBar、ActionMenu、DataBoundary 的 TypeScript 契约 |

## 打开方式

直接用浏览器打开：

```bash
open .planning/sketches/v0.20-unified-workbench/desktop.html
open .planning/sketches/v0.20-unified-workbench/mobile.html
open .planning/sketches/v0.20-unified-workbench/pattern-lab.html
```

Linux 环境可使用：

```bash
xdg-open .planning/sketches/v0.20-unified-workbench/desktop.html
```

## 已覆盖的关键决策

- Browse / 浏览彻底改名为 **Files / 文件管理**。
- 功能主命名采用工具属性：Git 管理、模型与供应商、实时引导、上下文监控、会话资产。
- 桌面端是多窗格 Command Deck，不是单聊天页面。
- 移动端是触控任务栈，不是桌面三栏缩小版。
- 移动底栏固定为：聊天 / 文件 / Git / 终端 / 资产。
- Settings、Extensions、Models & Providers 在移动端进入 More Sheet。
- 所有二级窗口统一走 OverlaySurface 语义：Dialog、Side Panel、Popover、Bottom Sheet、Alert。
- 首批底层 API 聚焦：OverlaySurface、PageScaffold、BottomCommandBar、ActionMenu、DataBoundary。

## 评审方式

建议按以下顺序评审：

1. 先打开 `desktop.html`，确认一级模块、右侧 Inspector、侧栏信息密度和 Overlay 形态。
2. 再打开 `mobile.html`，确认五栏、Git 分步流、实时引导 bottom sheet、键盘避让和触控目标。
3. 最后打开 `pattern-lab.html`，把交互规则转成公共组件 API 和实现验收项。

## 下一步

原型确认后，进入生产实现 Phase 2：

1. 建立 tokens、z-index、motion、adaptive runtime。
2. 实现五个首批公共组件。
3. 先迁移 Settings / Models & Providers / Extensions / Session Assets。
4. 再迁移 Files / Git / Terminal / Chat。
5. 最后重构 `website/`、README、Logo、截图、PWA/OG 资产。

## 原型内置验收修复

首轮原型评审后已补齐：

- 关闭态 Overlay 使用 `visibility: hidden` + `inert`，避免隐藏弹层仍被键盘聚焦。
- Overlay 打开时锁定背景交互并进行基础焦点陷阱和焦点返回。
- 移动端 Sheet 增加可见关闭按钮，不只依赖点击遮罩。
- 修复 Pattern Lab 中嵌套按钮的无效 DOM。
- 移动端 overlay 操作行和 icon button 补齐 44px 触控目标。
- 补齐 Dialog / AlertDialog 可访问名称。
- 补齐首批五个公共组件的 TypeScript API handoff。
