# iOS Safari PWA 深度研究报告：更新机制 / 安装引导 / 推送通知 / 关键限制

> 研究日期：2026-05-31
> 置信度：HIGH（基于 WebKit 官方博客 + MDN + Context7 文档交叉验证）
> 上下文：Hapi Power v0.2 iOS PWA 优化阶段（Phase 10）的前置研究

---

## 目录

1. [iOS PWA 更新机制](#1-ios-pwa-更新机制)
2. [iOS PWA 安装引导](#2-ios-pwa-安装引导)
3. [iOS PWA 推送通知与角标](#3-ios-pwa-推送通知与角标)
4. [iOS PWA 其他关键限制](#4-ios-pwa-其他关键限制)
5. [附录：Workbox vs 自定义 SW 对比](#附录workbox-vs-自定义-sw-对比)

---

## 1. iOS PWA 更新机制

### 1.1 Service Worker 更新触发条件

iOS Safari 的 Service Worker 更新遵循标准规范，但有一些 iOS 特有的行为差异。

**标准更新触发条件** [CITED: developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers]:

1. **导航触发**：用户导航到 SW scope 内的页面时，浏览器检查 SW 文件的字节差异
2. **调用 `registration.update()`**：代码主动触发更新检查
3. **push / sync 事件**：触发时也会检查更新
4. **24 小时周期**：浏览器在 24 小时后自动检查更新

**iOS Safari 特有行为** [VERIFIED: WebKit Safari 17.0 Features, webkit.org/blog/14854]:

- Safari 不保证每次启动 PWA 都检查 SW 更新
- 更新检查可能在用户交互后延迟触发
- Safari 17.0 修复了多个 SW 相关 bug（push 事件在 activate 前触发、postMessage 分块传输失败等）

### 1.2 Service Worker 生命周期

```
注册(register) → 安装(install) → 等待(waiting) → 激活(activate)
                                              ↓
                                    旧 SW 控制的页面全部关闭
                                              ↓
                                    新 SW 自动激活（或 skipWaiting 强制）
```

**关键流程** [CITED: MDN Using Service Workers]:

1. **新 SW 安装**：浏览器检测到 SW 文件变化，在后台安装新版本
2. **并存期**：旧 SW 继续控制已打开的页面，新 SW 进入 `waiting` 状态
3. **激活条件**：所有使用旧 SW 的标签页关闭后，新 SW 才能激活
4. **`skipWaiting()`**：强制新 SW 立即激活，跳过等待
5. **`clients.claim()`**：让新激活的 SW 立即接管所有页面

### 1.3 iOS SW 更新的推荐策略

**策略 A：自动更新 + 用户提示（推荐）**

```ts
// src/sw.ts - Service Worker 端
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// src/hooks/useSWUpdate.ts - 客户端端
export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      setRegistration(reg)

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新版本已安装，等待激活
            setUpdateAvailable(true)
          }
        })
      })

      // iOS 补充：定期检查更新（每 30 分钟）
      const interval = setInterval(() => {
        reg.update()
      }, 30 * 60 * 1000)

      return () => clearInterval(interval)
    })
  }, [])

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return
    // 通知 SW 跳过等待
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }, [registration])

  // SW 控制器变更后刷新页面
  useEffect(() => {
    const handler = () => {
      // iOS Safari 中 controllerchange 可能延迟
      // 使用短延时确保新 SW 完全接管
      setTimeout(() => window.location.reload(), 100)
    }
    navigator.serviceWorker.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler)
  }, [])

  return { updateAvailable, applyUpdate }
}
```

**策略 B：强制更新（适用于关键安全修复）**

```ts
// src/sw.ts
// 在 SW 安装时立即跳过等待并接管
self.addEventListener('install', (event) => {
  // 关键更新：立即跳过等待
  self.skipWaiting()
  event.waitUntil(
    caches.open('offline-cache').then((cache) => cache.add('/offline.html'))
  )
})

self.addEventListener('activate', (event) => {
  // 立即接管所有客户端
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // 清理旧版本缓存
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== 'offline-cache' && !key.startsWith('workbox-precache'))
            .map((key) => caches.delete(key))
        )
      ),
    ])
  )
})
```

### 1.4 iOS 7 天缓存清理规则

**权威来源** [VERIFIED: WebKit Blog - Full Third-Party Cookie Blocking, webkit.org/blog/10218]:

> ITP 已将脚本可写存储形式的过期时间限制在 7 天。即：**7 天 Safari 使用期间无用户交互**，以下存储将被清除：
> - IndexedDB
> - LocalStorage
> - Media Keys
> - SessionStorage
> - **Service Worker 注册和缓存**

**Home Screen Web App 的特殊例外**（同一篇文章）：

> "Web applications added to the home screen are not part of Safari and thus have their own counter of days of use. Their days of use will match actual use of the web application which resets the timer. **We do not expect the first-party in such a web application to have its website data deleted.** If your web application does experience website data deletion, please let us know since we would consider it a serious bug."

**Safari 17.0 的重要改进** [VERIFIED: WebKit Safari 17.0 Features]:

- 完整的 Storage API 支持（`navigator.storage.persist()` / `navigator.storage.persisted()`）
- 配额基于总磁盘空间计算（比之前约 1GB 的限制高得多）
- 支持 `persistent` 存储模式：不会被自动清理
- `"best-effort"` 模式在总使用量超过整体配额时会被清除

**实操建议**：

```ts
// 在应用首次启动时请求持久化存储
async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist()
    if (isPersisted) {
      console.log('Storage will not be cleared except by explicit user action')
    } else {
      console.log('Storage may be cleared by the UA under storage pressure')
    }
    return isPersisted
  }
  return false
}

// 检查当前存储是否已持久化
async function checkStoragePersistence() {
  if (navigator.storage && navigator.storage.persisted) {
    return await navigator.storage.persisted()
  }
  return false
}
```

### 1.5 通知 PWA 用户新版本的最佳实践

**方案一：应用内 Toast 提示**

```tsx
function UpdateToast({ onUpdate }: { onUpdate: () => void }) {
  return (
    <div className="fixed bottom-20 left-4 right-4 bg-surface-elevated rounded-xl p-4 shadow-xl
                    flex items-center gap-3 z-50 animate-slide-up">
      <div className="flex-1">
        <p className="text-sm font-medium">发现新版本</p>
        <p className="text-xs text-text-secondary">点击更新以获得最新功能</p>
      </div>
      <button
        onClick={onUpdate}
        className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium"
      >
        立即更新
      </button>
    </div>
  )
}
```

**方案二：版本号比对（适用于 iOS SW 更新不可靠的场景）**

```ts
// 在 index.html 中注入构建版本号
const BUILD_VERSION = '__BUILD_VERSION__' // Vite 构建时替换

async function checkForUpdates() {
  try {
    const response = await fetch('/version.json', {
      cache: 'no-cache', // 确保不命中缓存
    })
    const { version } = await response.json()
    if (version !== BUILD_VERSION) {
      // 服务器有新版本，触发 SW 更新
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.update()
      }
    }
  } catch {
    // 离线或网络错误，忽略
  }
}
```

---

## 2. iOS PWA 安装引导

### 2.1 iOS 不支持 `beforeinstallprompt`

**现状** [VERIFIED: WebKit Safari 16.4-18.2 Features]:

iOS Safari 至今（Safari 18.2）**不支持** `beforeinstallprompt` 事件。这是 Android Chrome 的专有 API。iOS 用户必须通过 Safari 的"分享 → 添加到主屏幕"手动安装。

这意味着：
- 无法通过 JS 代码触发原生安装横幅
- 无法拦截安装流程
- 无法在安装前获取用户确认
- `window.addEventListener('beforeinstallprompt', ...)` 永远不会触发

### 2.2 检测 PWA 是否已安装

**方法一：`display-mode` 媒体查询（推荐）** [CITED: MDN - Create a standalone app]

```ts
// 推荐：标准方式
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
}

// 监听 display mode 变化
function watchDisplayMode(callback: (isStandalone: boolean) => void) {
  const mq = window.matchMedia('(display-mode: standalone)')
  callback(mq.matches)
  mq.addEventListener('change', (e) => callback(e.matches))
}
```

**方法二：`navigator.standalone`（已废弃但 iOS 仍支持）**

```ts
// 兼容旧版 iOS 的方式
function isStandaloneLegacy(): boolean {
  // @ts-expect-error deprecated but still functional on iOS
  return window.navigator.standalone === true
}

// 综合检测
function isRunningAsPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || isStandaloneLegacy()
}
```

**CSS 方式（条件性显示 UI）** [CITED: MDN - Create a standalone app]:

```css
/* 只在 standalone 模式下显示的元素 */
.install-button {
  display: none;
}

@media (display-mode: browser) {
  .pwa-only-ui {
    display: none;
  }
  .install-button {
    display: block;
  }
}
```

### 2.3 iOS 安装引导 UI 模式

由于 iOS 没有原生安装提示，需要自行实现安装引导界面。

**模式一：底部弹出引导（推荐用于首次访问）**

```tsx
function IOSInstallGuide() {
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    // 只在 iOS Safari 浏览器模式显示
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isBrowser = !window.matchMedia('(display-mode: standalone)').matches
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

    if (isIOS && isBrowser && isSafari) {
      // 检查是否已经看过引导（使用 localStorage 而非 sessionStorage）
      const dismissed = localStorage.getItem('pwa-install-guide-dismissed')
      if (!dismissed) {
        // 延迟 3 秒显示，避免干扰首次加载
        const timer = setTimeout(() => setShowGuide(true), 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [])

  if (!showGuide) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-surface-elevated rounded-t-2xl w-full max-w-lg p-6 pb-safe">
        <h3 className="text-lg font-semibold mb-2">安装到主屏幕</h3>
        <p className="text-sm text-text-secondary mb-4">
          获得类似原生应用的体验，支持推送通知
        </p>

        {/* 步骤引导 */}
        <ol className="space-y-3 mb-6">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent
                           flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p className="text-sm font-medium">点击底部分享按钮</p>
              <div className="mt-1 w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                {/* Safari 分享图标 SVG */}
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5
                           c0 .55-.45 1-1 1s-1-.45-1-1V6h-1.5v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4
                           S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6H16.5z"/>
                </svg>
              </div>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent
                           flex items-center justify-center text-xs font-bold">2</span>
            <p className="text-sm font-medium pt-1">选择"添加到主屏幕"</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent
                           flex items-center justify-center text-xs font-bold">3</span>
            <p className="text-sm font-medium pt-1">点击"添加"完成安装</p>
          </li>
        </ol>

        <button
          onClick={() => {
            setShowGuide(false)
            localStorage.setItem('pwa-install-guide-dismissed', 'true')
          }}
          className="w-full py-3 text-center text-sm text-text-secondary"
        >
          稍后再说
        </button>
      </div>
    </div>
  )
}
```

**模式二：顶部横幅（轻量级提醒）**

```tsx
function InstallBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('install-banner-dismissed') === 'true'
  )

  if (dismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-accent/10 border-b border-accent/20
                    pt-safe px-4 py-3 flex items-center gap-3">
      <p className="flex-1 text-sm">
        添加到主屏幕以获得更好体验
      </p>
      <button
        onClick={() => {
          setDismissed(true)
          localStorage.setItem('install-banner-dismissed', 'true')
        }}
        className="text-text-secondary text-xs"
      >
        关闭
      </button>
    </div>
  )
}
```

### 2.4 安装引导时机与频率控制

**推荐策略**：

| 时机 | 策略 | 频率 |
|------|------|------|
| 首次访问（3 秒后） | 底部弹出引导 | 仅一次，dismiss 后不再显示 |
| 第 2 次访问 | 顶部横幅 | 每次访问显示，可关闭 |
| 第 3 次及以后 | 静默（不主动打扰） | 设置入口保留 |
| 用户主动点击"安装" | 始终显示引导 | 无限制 |
| 关键功能需要 PWA | 内联提示 | 每次触发 |

**频率控制实现**：

```ts
// src/lib/installGuideControl.ts
const STORAGE_KEY = 'pwa-install-guide-state'

interface InstallGuideState {
  dismissed: boolean
  dismissedAt: number // timestamp
  visitCount: number
  lastPromptAt: number | null
}

function getGuideState(): InstallGuideState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { dismissed: false, dismissedAt: 0, visitCount: 0, lastPromptAt: null }
}

function saveGuideState(state: InstallGuideState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function shouldShowInstallGuide(): boolean {
  // 已是 PWA 模式，不需要引导
  if (window.matchMedia('(display-mode: standalone)').matches) return false

  // 非 iOS 设备，不显示 iOS 专属引导
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIOS) return false

  const state = getGuideState()
  state.visitCount++
  saveGuideState(state)

  // 已手动关闭且在 7 天冷却期内
  if (state.dismissed && (Date.now() - state.dismissedAt < 7 * 24 * 60 * 60 * 1000)) {
    return false
  }

  // 首次访问直接显示
  if (state.visitCount === 1) return true

  // 第 2-3 次访问显示
  if (state.visitCount <= 3) return true

  // 超过 3 次，不再主动显示
  return false
}

export function dismissInstallGuide() {
  const state = getGuideState()
  state.dismissed = true
  state.dismissedAt = Date.now()
  saveGuideState(state)
}
```

### 2.5 "分享 → 添加到主屏幕"最佳实践

**用户操作路径**：

```
Safari 浏览器 → 底部工具栏"分享"图标（方框+上箭头）
  → 弹出分享菜单 → 向下滑动找到"添加到主屏幕"
  → 编辑名称（取自 manifest short_name）→ 点击"添加"
  → 主屏幕出现应用图标
```

**影响安装体验的 manifest 字段**：

| 字段 | iOS 行为 | 注意事项 |
|------|---------|---------|
| `name` | 安装确认对话框显示的应用名 | 建议 < 45 字符 |
| `short_name` | 主屏幕图标下方标签 | 建议 < 12 字符，中文约 6 个字 |
| `icons` 192/512 | 主屏幕图标 | **必须 PNG，不支持 SVG** |
| `start_url` | 点击图标打开的 URL | 必须在 SW scope 内 |
| `display: standalone` | 隐藏浏览器 UI | iOS 唯一可靠的沉浸式模式 |
| `apple-touch-icon` | 主屏幕图标（优先于 manifest icons） | 必须在 HTML `<head>` 中声明 |

---

## 3. iOS PWA 推送通知与角标

### 3.1 iOS 16.4+ Web Push API 支持

**关键前提条件** [VERIFIED: WebKit Safari 16.4 Features, webkit.org/blog/13966]:

| 条件 | 说明 |
|------|------|
| 最低版本 | iOS 16.4 / iPadOS 16.4 / macOS Safari 16.4 |
| 运行模式 | **仅限已添加到主屏幕的 Web App** |
| 协议 | HTTPS（或 localhost） |
| 浏览器内 | Safari 浏览器内**不支持** Web Push |
| 第三方浏览器 | iOS 16.4+ 允许第三方浏览器提供"添加到主屏幕" |

**Safari 18.2 关键修复** [VERIFIED: WebKit Safari 18.2 Features, webkit.org/blog/15012]:

- 修复了 `pushManager.subscribe` 返回空 endpoint 的严重 bug
- 这是之前 Web Push 在某些场景下无法工作的根本原因

### 3.2 推送通知注册完整流程

```ts
// src/lib/pushNotifications.ts

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** 检测当前环境是否支持 Web Push */
export function canUseWebPush(): boolean {
  const hasPushManager = 'PushManager' in window
  const hasSW = 'serviceWorker' in navigator
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost'
  // iOS 要求 standalone 模式
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  return hasPushManager && hasSW && isSecure && isStandalone
}

/** 请求推送权限并订阅 */
export async function requestPushPermission(): Promise<PushSubscription | null> {
  if (!canUseWebPush()) {
    console.warn('Web Push not available in current context')
    return null
  }

  // iOS Safari 16.4+ 要求必须由用户手势触发
  // 此函数应该在 click handler 中调用
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // iOS 强制要求
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    // 发送订阅到后端
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })

    return subscription
  } catch (error) {
    console.error('Push subscription failed:', error)
    return null
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}
```

### 3.3 Service Worker 处理推送

```ts
// src/sw.ts 推送处理部分

// 推送事件：必须显示通知（userVisibleOnly: true 的结果）
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  // 同时更新 Badge API
  if (data.badge !== undefined && 'setAppBadge' in navigator) {
    if (data.badge > 0) {
      navigator.setAppBadge(data.badge)
    } else {
      navigator.clearAppBadge()
    }
  }

  const options: NotificationOptions = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png', // Android 通知小图标，iOS 忽略
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: data.actions || [],
    // iOS 16.4+ 支持
    tag: data.tag || 'default',
    renotify: data.renotify ?? true,
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Hapi Power', options)
  )
})

// 通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // 优先复用已有窗口
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // 没有已有窗口则打开新窗口
      return self.clients.openWindow(url)
    })
  )
})
```

### 3.4 Badge API（iOS 16.4+）

**来源** [CITED: MDN Badging API, developer.mozilla.org/en-US/docs/Web/API/Badging_API]:

Badge API 提供在应用图标上显示数字或标记的能力。在 iOS 16.4+ 中，获取通知权限后 Badge API **自动获得权限**。

**Badge 的三种状态**：

| 状态 | 含义 | 触发方式 |
|------|------|---------|
| `nothing` | 无角标 | `clearAppBadge()` 或 `setAppBadge(0)` |
| `flag` | 仅有标记（圆点） | `setAppBadge()`（无参数） |
| 整数 | 显示数字 | `setAppBadge(N)`（N > 0） |

**关键 API**：

```ts
// 设置角标数字
await navigator.setAppBadge(12)

// 设置标记（无数字）
await navigator.setAppBadge()

// 清除角标
await navigator.clearAppBadge()

// 等效清除：setAppBadge(0) 也会清除角标
await navigator.setAppBadge(0)
```

**在 Service Worker 中使用** [CITED: MDN - Display badge on app icon]:

```ts
// SW 中通过 push 事件更新角标
self.addEventListener('push', (event) => {
  const message = event.data.json()
  const unreadCount = message.unreadCount

  if (navigator.setAppBadge) {
    if (unreadCount && unreadCount > 0) {
      navigator.setAppBadge(unreadCount)
    } else {
      navigator.clearAppBadge()
    }
  }

  // 必须显示通知（push 的强制要求）
  self.registration.showNotification(`${unreadCount} unread messages`)
})
```

**注意事项**：
- 大数字会被系统截断显示（如 4000 显示为 "99+"）
- iOS 可能忽略具体数字而只显示标记
- Badge API 可在主线程和 Worker 线程中使用（`navigator.setAppBadge` 和 `WorkerNavigator.setAppBadge`）
- 不需要单独的权限请求——随通知权限一起授予

### 3.5 Push API + PushSubscription 的 iOS 限制

| 限制 | 说明 | 应对策略 |
|------|------|---------|
| 仅限 standalone 模式 | 浏览器内完全不可用 | 检测模式后条件性启用 |
| 必须显示通知 | `userVisibleOnly: true` 是强制要求 | 每条 push 都需 `showNotification()` |
| SW 处理时间有限 | iOS 可能限制 push 唤醒后的执行时间 | 保持 push handler 简短 |
| 订阅可能过期 | iOS 可能因存储压力失效订阅 | 服务端监控订阅有效性，客户端定期重新订阅 |
| Safari 18.2 之前有空 endpoint bug | `pushManager.subscribe` 可能返回空 endpoint | 强制用户升级到 iOS 18.2+ 或检测后重试 |
| Lockdown Mode 完全禁用 | 锁定模式下 ServiceWorker 和所有存储不可用 | 检测并提供降级 |
| Safari Profiles 隔离 | 不同 Profile 有独立的推送订阅（Safari 17.0+） | 后端存储时关联 profile 信息 |

### 3.6 Notification API 在 standalone 模式下的行为

**iOS 16.4+ standalone 模式** [VERIFIED: WebKit Safari 16.4/17.0 Features]:

- `Notification.requestPermission()` 可用且正常工作
- 通知显示应用名称（取自 manifest `name`）
- 通知可包含 `actions`（交互按钮）
- 通知会同步到配对的 Apple Watch
- `Focus Mode` 可能影响通知显示
- Safari 17.0 修复：通知默认静音行为遵循平台惯例

---

## 4. iOS PWA 其他关键限制

### 4.1 Cookie / Storage 隔离

**standalone 模式 vs Safari 浏览器的隔离** [VERIFIED: WebKit Safari 17.0 Features]:

> "Web apps on Mac: Add to Dock, cookies copied to web app but no other storage shared"

**iOS 上的隔离规则**：

| 存储类型 | Safari 浏览器 | standalone PWA | 共享？ |
|---------|-------------|---------------|--------|
| Cookies | Safari 的 cookie 存储 | **独立的 cookie 存储** | 不共享（iOS 上各自维护） |
| LocalStorage | Safari 的 LS | 独立的 LS | 不共享 |
| IndexedDB | Safari 的 IDB | 独立的 IDB | 不共享 |
| Cache API | Safari 的 Cache | 独立的 Cache | 不共享 |
| Service Worker | Safari 的 SW 注册 | 独立的 SW 注册 | 不共享 |
| Session/登录状态 | 取决于 cookie | **首次添加时复制 cookie，之后独立** | 初始复制后独立 |
| Web Push 订阅 | 不支持 | 支持（iOS 16.4+） | 仅 PWA 可用 |

**实操影响**：

1. 用户在 Safari 登录后添加到主屏幕，初始 cookie 会被复制，登录状态保留
2. 之后两边的 cookie 独立变化——PWA 中修改密码不影响 Safari 的 session
3. PWA 中的 IndexedDB 数据不会出现在 Safari 中
4. **Mac 上 Safari 17.0+ 的 "Add to Dock"**：明确只复制 cookie，其他存储不共享

**Safari Profiles (17.0+) 的影响** [VERIFIED: WebKit Safari 17.0 Features]:

- 每个 Profile 有独立的：历史记录、cookie、缓存、Service Worker、Web Push 订阅
- PWA 的存储属于创建它时所在的 Profile
- 如果用户切换 Profile 或删除 Profile，PWA 的存储可能受影响

### 4.2 IndexedDB 持久化

**7 天清理规则下的 IndexedDB** [VERIFIED: WebKit Blog, webkit.org/blog/10218]:

- IndexedDB 属于"脚本可写存储"，理论上受 7 天不使用清理规则影响
- **但 Home Screen Web App 有例外**：使用计数器独立于 Safari，实际使用会重置计时器
- **Webkit 明确表示**：如果 Home Screen Web App 的数据被删除，那是 bug，应该报告

**Safari 17.0 的持久化存储模式** [VERIFIED: WebKit Safari 17.0 Features]:

```ts
// 请求持久化存储——Safari 17.0+ 支持
if (navigator.storage && navigator.storage.persist) {
  const granted = await navigator.storage.persist()
  // granted === true: 存储不会被自动清理
  // granted === false: 存储可能在存储压力下被清理
}

// 检查当前是否已持久化
if (navigator.storage && navigator.storage.persisted) {
  const isPersisted = await navigator.storage.persisted()
}

// 查询存储使用量和配额
if (navigator.storage && navigator.storage.estimate) {
  const { quota, usage } = await navigator.storage.estimate()
  // Safari 17.0+ quota 基于总磁盘空间，远大于之前的约 1GB 限制
}
```

**存储模式对比** [CITED: MDN Storage API]:

| 模式 | 清理优先级 | 用户通知 |
|------|-----------|---------|
| `best-effort` | 高优先级清理 | 无通知 |
| `persistent` | 最后清理 | 浏览器会通知用户并请求确认 |

### 4.3 Service Worker 生命周期在 iOS 上的差异

| 特性 | Chrome/Android | iOS Safari |
|------|---------------|------------|
| SW 更新检查频率 | 每次导航 + 24h 周期 | 不保证每次启动都检查 |
| `skipWaiting()` | 可靠 | 可用但偶尔延迟 |
| `clients.claim()` | 可靠 | 可用 |
| SW 被终止后重启 | push 事件可唤醒 | push 事件可唤醒，但处理时间有限 |
| 后台存活时间 | 有一定延续 | 无延续，即用即启 |
| Navigation Preload | 支持 | 支持 |
| 页面可见性影响 | 不影响 SW | 页面关闭后 SW 可能很快终止 |

**Navigation Preload 优化** [CITED: MDN Using Service Workers]:

```ts
// sw.ts - 启用 navigation preload 加速首次加载
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // 启用 navigation preload
      self.registration.navigationPreload.enable(),
    ])
  )
})

// 在 fetch 事件中使用预加载响应
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // 优先使用预加载的响应
          const preloadResponse = await event.preloadResponse
          if (preloadResponse) return preloadResponse

          // 回退到网络
          return await fetch(event.request)
        } catch {
          // 离线回退
          return await caches.match('/offline.html')
        }
      })()
    )
  }
})
```

### 4.4 Background Fetch / Background Sync 支持状态

**结论：iOS Safari 完全不支持** [VERIFIED: caniuse.com/background-sync, caniuse.com/background-fetch]:

| API | Chrome | Firefox | Safari | iOS Safari |
|-----|--------|---------|--------|------------|
| Background Sync | 49+ | 不支持 | **不支持** | **不支持** |
| Periodic Background Sync | 80+（需安装） | 不支持 | **不支持** | **不支持** |
| Background Fetch | 74+ | 不支持 | **不支持** | **不支持** |

截至 Safari Technology Preview 26.4（2026 年 5 月），以上三个 API 均未在 Safari 上实现。

**替代方案**：

```ts
// 替代 Background Sync：应用层同步队列
// 1. 应用打开时同步
// 2. visibilitychange 事件触发同步
// 3. online 事件触发同步

export function setupSyncOnVisible() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncPendingActions()
    }
  })

  window.addEventListener('online', () => {
    syncPendingActions()
  })

  // 首次加载时也同步
  if (navigator.onLine) {
    syncPendingActions()
  }
}

async function syncPendingActions() {
  const queue = await getOfflineQueue()
  if (queue.length === 0) return

  for (const action of queue) {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      })
      await removeFromQueue(action.id)
    } catch {
      // 保留在队列中，下次重试
      break
    }
  }
}
```

### 4.5 Lockdown Mode 对 PWA 的影响

**iOS 16.4 首次引入** [VERIFIED: WebKit Safari 16.4 Features]:

Lockdown Mode 启用后以下功能**完全不可用**：

- Cache API / CacheStorage API
- ServiceWorkers
- WebLocks API

**iOS 17.0 扩展禁用列表** [VERIFIED: WebKit Safari 17.0 Features]:

- IndexedDB（新增）
- File API / FileReader（新增）
- `<embed>` 元素（新增）
- Web Speech API（新增）
- WebLocks API（延续）
- 实验性 API（新增）

**检测方法**：

```ts
export async function isLockdownModeActive(): Promise<boolean> {
  // 方法一：尝试注册 SW
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      if (reg) return false // SW 可用 = 非 Lockdown
    } catch {
      return true
    }
  }

  // 方法二：尝试打开 IndexedDB
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('__lockdown_test__', 1)
      request.onerror = () => reject(new Error('IDB blocked'))
      request.onsuccess = () => resolve(request.result)
    })
    db.close()
    indexedDB.deleteDatabase('__lockdown_test__')
    return false
  } catch {
    return true
  }
}
```

### 4.6 其他 iOS PWA 限制快速参考

| 限制 | 说明 | 版本 |
|------|------|------|
| `beforeinstallprompt` | 不支持，永远不触发 | 全版本 |
| Manifest `shortcuts` | 不支持长按快捷方式 | 全版本 |
| SVG 图标 | 不支持，必须 PNG | 全版本 |
| Maskable 图标 | 忽略 `purpose: maskable` | 全版本 |
| `display: fullscreen` | 不支持，fallback 到 standalone | 全版本 |
| `background_color` | 不读取 manifest 的此字段 | 全版本 |
| 第三方 Cookie | 默认完全阻止 | Safari 13.1+ |
| View Transitions API | 同文档支持 | Safari 18.0+ |
| 跨文档 View Transitions | 支持 | Safari 18.2+ |
| HTTPS 默认 | iOS/iPadOS/visionOS 强制 HTTPS | Safari 18.2+ |
| Web App on Mac (Add to Dock) | 支持，cookies 初始复制后独立 | Safari 17.0+ |
| Safari View Controller A2HS | 支持"添加到主屏幕" | Safari 17.0+ |

---

## 附录：Workbox vs 自定义 SW 对比

### Workbox 简介

[VERIFIED: Context7 - googlechrome/workbox]

Workbox 是 Google 维护的 Service Worker 工具库集合，提供预缓存、路由匹配、缓存策略等模块化能力。Hapi Power 的技术栈已选定 `vite-plugin-pwa` + `injectManifest` 模式，即自定义 SW + Workbox 工具库。

### 对比表

| 维度 | Workbox (injectManifest) | 纯手写 SW |
|------|-------------------------|----------|
| **预缓存管理** | `precacheAndRoute(self.__WB_MANIFEST)` 自动管理版本 | 手动维护缓存列表，容易遗漏 |
| **缓存策略** | 内置 CacheFirst/NetworkFirst/StaleWhileRevalidate | 每种策略需自己实现，约 50-100 行 |
| **缓存过期** | `ExpirationPlugin` 自动管理 maxEntries/maxAgeSeconds | 需自己实现 LRU 清理 |
| **缓存更新通知** | `BroadcastUpdatePlugin` 自动通知客户端 | 需自己实现 postMessage 通信 |
| **离线回退** | `setCatchHandler` + `precache` | 需自己实现 |
| **旧缓存清理** | `cleanupOutdatedCaches()` 一行解决 | 需自己比对缓存名前缀 |
| **路由匹配** | `registerRoute()` 支持正则/回调/NavigationRoute | 需自己写 URL 匹配逻辑 |
| **构建集成** | Vite 插件自动注入 `__WB_MANIFEST` | 需自己处理构建产物列表 |
| **包体积** | ~10KB gzipped（按需引入模块） | 0 额外体积 |
| **学习曲线** | 中等（需理解 Workbox 概念） | 低（纯 SW API） |
| **iOS 兼容性** | 良好（Workbox 基于标准 SW API） | 良好 |
| **维护状态** | Google 维护，但更新放缓 | 社区已出现 Serwist 分支 |

### 推荐

**使用 Workbox (injectManifest)**——这是 Hapi Power 的既定技术选型，原因：

1. **预缓存管理**是最核心的价值——Vite 构建产物自动注入，零人工维护
2. **缓存策略**开箱即用，避免手写常见的缓存逻辑 bug
3. **旧缓存清理**是 iOS 上的痛点——`cleanupOutdatedCaches()` 一行解决
4. iOS Safari 的 SW 更新不可靠，Workbox 的版本化缓存机制正好弥补

### Workbox 核心 API 速查

```ts
// 预缓存
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// 路由 + 策略
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// API 请求：网络优先
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 }),
    ],
  })
)

// 静态图片：缓存优先
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// 第三方资源：StaleWhileRevalidate
registerRoute(
  ({ url }) => url.origin !== self.location.origin,
  new StaleWhileRevalidate({
    cacheName: 'third-party-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
)

// SW 更新通知
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
```

---

## 信息来源

### HIGH 置信度（官方文档）

| 来源 | 验证内容 |
|------|---------|
| WebKit Blog: Safari 16.4 Features (webkit.org/blog/13966) | Web Push、Badge API、Lockdown Mode、第三方浏览器 A2HS |
| WebKit Blog: Safari 17.0 Features (webkit.org/blog/14854) | Storage API、持久化存储、Safari Profiles、Mac Web App、SW bug 修复 |
| WebKit Blog: Safari 18.0 Features (webkit.org/blog/15412) | View Transitions API、AppCache 移除 |
| WebKit Blog: Safari 18.2 Features (webkit.org/blog/15012) | HTTPS 默认、pushManager.subscribe 空 endpoint 修复 |
| WebKit Blog: Full Third-Party Cookie Blocking (webkit.org/blog/10218) | **7 天清理规则的权威来源**、Home Screen Web App 例外 |
| MDN: Badging API (developer.mozilla.org/en-US/docs/Web/API/Badging_API) | Badge API 三种状态、setAppBadge/clearAppBadge 用法 |
| MDN: Storage API (developer.mozilla.org/en-US/docs/Web/API/Storage_API) | best-effort vs persistent 模式、navigator.storage.persist() |
| MDN: Using Service Workers (developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) | SW 生命周期、skipWaiting/clients.claim、缓存版本化 |
| MDN: Create a standalone app (developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Create_a_standalone_app) | display-mode 检测、CSS media query |
| Context7: googlechrome/workbox | Workbox API：precacheAndRoute、strategies、ExpirationPlugin 等 |
| Can I Use: Background Sync (caniuse.com/background-sync) | Safari 全版本不支持 Background Sync |

### MEDIUM 置信度（社区知识 + 官方佐证）

| 内容 | 来源 |
|------|------|
| iOS PWA cookie 初始复制后独立 | WebKit Safari 17.0 博客确认 Mac 上此行为，iOS 行为推断一致 |
| iOS SW 更新检查不可靠 | 社区广泛报告，WebKit 博客暗示（17.0 修复多个 SW bug） |

### Assumptions Log

| # | 声明 | 章节 | 风险 |
|---|------|------|------|
| A1 | iOS 上 cookie 初始复制后独立于 Safari（基于 Mac 行为推断） | 4.1 | 中——iOS 可能行为略有不同，需实机验证 |
| A2 | iOS 18.0+ 未引入新的 PWA 破坏性变更 | 全文 | 低——Safari 18.0/18.2 的 PWA 变更主要是新增功能 |

---

*研究完成时间：2026-05-31*
*有效期：30 天（至 2026-06-30，或在 Safari 新版本发布时需更新）*
