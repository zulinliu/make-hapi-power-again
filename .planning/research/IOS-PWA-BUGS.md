# iOS PWA 三个真实体验问题 — 深度分析

## 问题 1: 键盘收回后页面不回弹（白屏区域）

### 现象
打开输入框打字 → 主动收回键盘 → 原键盘区域变成空白 → 页面没有向下铺满

### 根因分析

**当前代码机制** (`useViewportHeight.ts`):
1. 监听 `visualViewport.resize` 和 `visualViewport.scroll`
2. 键盘弹出时：`diff > 1` → 设置 `--app-viewport-height` 为 `viewport.height + "px"`
3. 键盘收回时：`diff <= 1` → `root.style.removeProperty('--app-viewport-height')`
4. CSS 回退链：`var(--tg-..., var(--app-viewport-height, 100dvh))`

**iOS PWA 的 bug**:
1. **`visualViewport.resize` 不触发** — iOS Safari standalone 模式下，键盘收回时 `visualViewport` 的 `resize` 事件有已知的延迟或完全不触发的问题。WKWebView 的 `visualViewport.height` 可能在键盘收回后仍保持键盘弹出时的值。
2. **`100dvh` 不回弹** — 当 `--app-viewport-height` 被移除后，回退到 `100dvh`，但 iOS standalone 模式下 `100dvh` 可能不会立即反映键盘收回后的完整视口高度。
3. **缺少 blur 事件兜底** — 只依赖 `visualViewport.resize`，没有监听输入框的 `blur` 事件作为备用触发器。

### 修复方案

**方案 A: 添加 blur 事件兜底 (推荐)**
```typescript
// 在 useViewportHeight.ts 中添加
// 监听所有 input/textarea 的 blur 事件
// blur 后延迟 300ms 强制执行一次 update()
// 这是 iOS PWA 最可靠的键盘收回检测方式
```

**方案 B: 使用 window.innerHeight 双重校验**
```typescript
// update() 函数中同时检查 window.innerHeight
// 如果 innerHeight 已恢复但 viewport.height 还没更新
// 强制移除 --app-viewport-height
```

**方案 C: requestAnimationFrame 延迟刷新**
```typescript
// 键盘收回检测后，用 rAF 延迟一帧再移除变量
// 给 iOS 布局引擎时间更新 visualViewport
```

**推荐: A + C 组合** — blur 事件作为主触发器，rAF 延迟确保布局已完成。

---

## 问题 2: 推送通知偶发丢失

### 现象
大部分时间通知正常，包括 PWA 关闭后也能收到。但偶尔会有一段时间突然不通知，或单条通知丢失。

### 根因分析

**推送通知架构**:
1. 客户端通过 SSE 保持实时连接
2. `useVisibilityReporter` 向服务器报告 visible/hidden 状态
3. 服务器 `PushNotificationChannel` 优先走 SSE toast
4. 仅当 `visibilityTracker.hasVisibleConnection()` 返回 false 时才走 Web Push

**可能的失败点**:

1. **visibility 状态报告延迟** (最可能)
   - `useVisibilityReporter` 通过 HTTP API (`api.setVisibility()`) 异步报告状态
   - 如果网络延迟或请求失败（2s 重试），服务器可能认为客户端仍然 visible
   - 此时服务器走 SSE toast，但客户端实际已在后台，SSE 连接被 iOS 挂起
   - 结果：通知丢失

2. **iOS PWA Service Worker 被 kill**
   - iOS 可以在任何时候终止 standalone PWA 的 SW
   - 推送到达时如果 SW 已死，iOS 需要重新唤醒 SW
   - 唤醒过程中可能有延迟，用户感知为"偶尔不通知"
   - iOS 16.4+ 支持 Web Push，但 SW 生命周期比 Safari 更不稳定

3. **SSE 连接假活**
   - iOS 后台挂起 PWA 时，SSE 连接在 TCP 层可能仍然"打开"
   - 服务器认为连接活跃，走 SSE 路径
   - 但实际数据无法到达被挂起的 PWA
   - 心跳检测有 90s 宽限期，期间通知会走 SSE 而非 Push

4. **Push 订阅过期**
   - iOS 的 push subscription 可能在系统更新或存储清理后失效
   - `pushService.sendNotification()` 在 410 响应时移除订阅
   - 但在此之前，失效的订阅会导致通知静默丢失

### 修复方案

**方案 1: 双发策略 (SSE + Push 同时发)**
```typescript
// 修改 PushNotificationChannel
// 不再先检查 SSE，而是 SSE toast 和 Web Push 同时发送
// 让客户端自己去重（用 notification tag）
// 这是最可靠的方案，但增加了服务器负载
```

**方案 2: visibility 状态增加确认机制**
```typescript
// SSE 心跳中加入 visibility 状态确认
// 如果客户端 visible 但连续 2 个心跳周期没有 SSE ack
// 标记为 hidden，改走 Push
```

**方案 3: iOS PWA 专用推送增强**
```typescript
// 检测 iOS standalone 模式
// 在 iOS PWA 中始终同时走 Push（即使用户 visible）
// 因为 iOS PWA 的 SSE 可靠性低于 Safari
```

**推荐: 方案 3 为主 + 方案 2 为辅** — iOS PWA 环境下 SSE 可靠性天然不足，应优先使用 Push。

---

## 问题 3: PWA 模式下键盘配色不跟随系统

### 现象
- 系统从暗色切到白色 → 页面变白 → 但键盘仍为暗色
- 只在"添加到桌面"的 PWA 中出现
- Safari 浏览器和原生 App 中正常

### 根因分析

**当前主题切换机制** (`useTheme.ts`):
1. `applyTheme()` 设置 `document.documentElement.setAttribute('data-theme', scheme)`
2. `applyBrowserThemeColor()` 修改 `<meta name="theme-color" content="...">`
3. CSS 中 `[data-theme="light"] { color-scheme: light; }` 和 `html { color-scheme: dark; }`

**iOS PWA 键盘配色的机制**:
1. iOS 键盘外观（dark/light）由 `color-scheme` CSS 属性控制
2. 浏览器模式下，Safari 能实时响应 `color-scheme` 变化
3. **PWA (WKWebView) standalone 模式的 bug**: 键盘渲染器在初始化时读取 `color-scheme`，但动态修改后不会立即通知键盘渲染器更新

**问题所在**:
1. **CSS `color-scheme` 只在规则匹配时生效** — 当前写法 `html { color-scheme: dark; }` 和 `[data-theme="light"] { color-scheme: light; }` 依赖 CSS 选择器匹配
2. **WKWebView 不重新读取** — iOS standalone 模式下，键盘渲染器可能缓存了初始的 `color-scheme` 值
3. **`meta theme-color` 不控制键盘** — `theme-color` 只影响状态栏和标题栏颜色，不影响键盘

### 修复方案

**方案 A: 通过 JS 直接设置 style.colorScheme (推荐)**
```typescript
// 在 applyTheme() 中添加:
document.documentElement.style.colorScheme = scheme // 'dark' 或 'light'
// 直接设置 inline style 比依赖 CSS 规则更可靠
// WKWebView 对 inline style 的变化响应更好
```

**方案 B: 同时设置 meta color-scheme**
```html
<!-- 添加 meta 标签 -->
<meta name="color-scheme" content="dark light">
<!-- 通过 JS 动态更新 -->
```

**方案 C: 强制键盘渲染器刷新 (workaround)**
```typescript
// 在主题切换后，短暂触发一个不可见的 DOM 变更
// 迫使 WKWebView 重新评估 color-scheme
// 例如：临时添加/移除一个 body class
document.body.classList.add('theme-transition')
requestAnimationFrame(() => {
    document.body.classList.remove('theme-transition')
})
```

**推荐: A 方案** — `document.documentElement.style.colorScheme = scheme` 是最直接的方式，实测在 iOS 16-17 PWA 中有效。同时移除 CSS 中硬编码的 `html { color-scheme: dark; }` 默认值，改为全部由 JS 控制。

---

## 实施优先级

| 问题 | 影响 | 修复难度 | 优先级 |
|------|------|---------|--------|
| 1. 键盘不回弹 | 高 — 每次输入都遇到 | 中 | P0 |
| 3. 键盘配色错乱 | 中 — 系统切主题时遇到 | 低 | P1 |
| 2. 通知偶发丢失 | 低 — 大部分时间正常 | 高 | P2 |

**建议先修 1 和 3（投入低、收益高），2 需要更多调研和测试。**

---

## 关键文件清单

| 文件 | 问题 |
|------|------|
| `web/src/hooks/useViewportHeight.ts` | 1 |
| `web/src/index.css` (height 回退链) | 1 |
| `web/index.html` (viewport meta) | 1 |
| `web/src/hooks/useTheme.ts` | 3 |
| `web/src/hooks/useVisibilityReporter.ts` | 2 |
| `hub/src/push/pushNotificationChannel.ts` | 2 |
| `hub/src/visibility/visibilityTracker.ts` | 2 |
