# Phase 37 — UX / iOS PWA / A11y 验收矩阵

> 本文将 UX 设计原则转为实施验收门禁。任何 Phase 38+ 实现若涉及五大特色功能，必须逐项验证。

## 1. 视口矩阵

| 设备档 | 尺寸 | 必验内容 |
|---|---|---|
| iPhone compact | 390×844 | 主 CTA 可见；无横向滚动；bottom sheet 不遮挡输入；safe-area 正确。 |
| iPhone large | 430×932 | 长模型名/分支名/路径不撑破；底部 dock 与 Composer 不冲突。 |
| iPad / tablet | 768×1024 | Panel 与主内容并存；焦点和滚动区域明确。 |
| Desktop | ≥1280×800 | 多栏布局层级清楚；toolbar 不拥挤；键盘导航完整。 |

## 2. 全局交互门禁

- 所有主操作触控目标 ≥ 44×44px。
- 输入框字号 ≥ 16px，避免 iOS 自动缩放。
- 所有 sheet/drawer/popover 有 focus trap。
- 关闭后焦点返回触发元素。
- Escape / browser back / 下拉关闭行为一致且不丢输入。
- 加载、空、错误、成功、禁用、离线状态均有定义。
- 状态色必须同时配文字、图标或 `aria-label`。
- `prefers-reduced-motion: reduce` 下禁用 shake、飞入、循环 pulse、扫光；仅保留静态状态或轻淡入。

## 3. 模型星桥 / Model Nexus

| 场景 | 验收 |
|---|---|
| 空状态 | 不显示空表格；主 CTA 为“新增模型星桥”；说明用途。 |
| Provider 卡 | 名称、host label、协议、健康、模型数、usage/context 能力不拥挤。 |
| 操作入口 | 移动端有可见 overflow 按钮，不依赖长按/右键。 |
| Wizard | 键盘弹出后底部“下一步/检测”仍可见。 |
| 检测失败 | 不用 shake 作为唯一反馈；错误原因展开，提供修复建议。 |
| 减少动画 | 节点点亮改为状态即时切换，无扫光。 |

## 4. 引导光标 / Guide Beam

| 场景 | 验收 |
|---|---|
| 非 thinking | 不显示 Guide 控件。 |
| thinking 默认 | 默认选中“排队”。 |
| 切到立即引导 | 发送按钮文案变化，但不诱导频繁打断；有简短风险说明。 |
| 首次确认 | 一次性确认可关闭；说明不会删除普通队列。 |
| Stop 区分 | Stop 是停止；立即引导是纠偏并继续；视觉和文案不能混淆。 |
| 状态反馈 | `引导中/已收到/已降级排队` 均可见。 |
| A11y | Segmented control 用 radio group 或 tablist，aria-label 包含当前模式。 |

## 5. 上下文脉冲 / Context Pulse

| 场景 | 验收 |
|---|---|
| 正常 | 中文显示 `上下文：40%`；英文显示 `Context: 40%`。 |
| 阈值 | 59 green、60 yellow、80 yellow、81 red。 |
| 不可用 | 显示 `上下文：--`，可点击查看原因。 |
| Popover | 显示 used/max、source、model、cache、last update、reason。 |
| 高风险 | 不自动弹窗；红色状态有文字说明，不只靠颜色。 |
| 减少动画 | 禁用 pulse，仅颜色/文本变化。 |

## 6. Git 脉络 / Git Atlas

| 场景 | 验收 |
|---|---|
| 首屏 | Hero 回答 branch、dirty/ahead/behind、recommended action。 |
| 长路径 | 文件路径中间省略，点击/长按可看完整路径。 |
| Diff | 大 diff 虚拟滚动或分块；二进制/大文件有专属状态。 |
| Commit Basket | basket count、选中文件、最终提交列表一致。 |
| Force push | 必须输入完整分支名或服务端 confirmation phrase。 |
| 移动端 | 查看变更、预览 diff、加入篮子、提交、同步均可单手完成。 |
| 减少动画 | 分支箭头流动改为静态进度文本。 |

## 7. 会话织锦 / Session Loom

| 场景 | 验收 |
|---|---|
| Panel 主标题 | 使用“会话织锦 / Session Loom”；`大纲` 是 Tab。 |
| 导出预览 | 展示过滤规则、敏感信息提示、预计条数。 |
| 长会话 | 预览分块渲染，不阻塞主线程。 |
| iOS PWA 下载 | 下载失败时提供复制全文 / 系统分享 fallback。 |
| 外部提炼 | 调用外部模型前显式确认；可选择仅本地导出。 |
| 生成任务 | 离开 Panel 后仍可 toast 返回资产。 |
| A11y | Tab 有 aria-selected；生成状态用 aria-live。 |

## 8. 视觉一致性门禁

- Electric Orange 只用于品牌主动作、选中态、signature moment；不替代 warning/danger。
- 卡片半径、间距、边框、阴影使用 Hapi Power tokens。
- 五个功能允许不同 metaphor，但组件词汇统一：Hero、Card、Matrix、Sheet、Timeline、Popover。
- 不使用 emoji 作为正式图标。
