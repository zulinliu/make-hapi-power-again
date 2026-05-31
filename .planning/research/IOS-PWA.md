# iOS Safari PWA 最佳实践研究（2025-2026）

> 目标：让 Hapi Power 作为 iOS PWA 运行时获得原生应用级体验。
> 技术栈：React 19 + Vite + vite-plugin-pwa (injectManifest) + Tailwind CSS 4
> 研究日期：2026-05-30

---

## 目录

1. [Manifest 配置](#1-manifest-配置)
2. [安全区域 CSS](#2-安全区域-css)
3. [状态栏融合](#3-状态栏融合)
4. [启动画面](#4-启动画面)
5. [Service Worker 限制](#5-service-worker-限制)
6. [推送通知](#6-推送通知)
7. [离线体验](#7-离线体验)
8. [导航和手势](#8-导航和手势)
9. [性能优化](#9-性能优化)

---

## 1. Manifest 配置

### 当前最佳实践

`manifest.webmanifest` 是 PWA 的核心配置文件。iOS Safari 从 15.0 起开始支持部分 manifest 字段，但仍需配合 HTML meta 标签实现完整体验。

```json
// public/manifest.webmanifest
{
  "id": "/hapi-power/",
  "name": "Hapi Power",
  "short_name": "HapiPower",
  "description": "让 Hapi 再次强大",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#1a1a2e",
  "background_color": "#ffffff",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

对应的 HTML `<head>` 配置（iOS 必需）：

```html
<!-- index.html <head> 内 -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="HapiPower">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#1a1a2e">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

vite-plugin-pwa 配置（injectManifest 模式）：

```ts
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        id: '/hapi-power/',
        name: 'Hapi Power',
        short_name: 'HapiPower',
        description: '让 Hapi 再次强大',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1a1a2e',
        background_color: '#ffffff',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // iOS 兼容性：自动注入 apple-touch-icon 等meta
      addTypeToIcons: true,
    }),
  ],
})
```

### iOS 特有限制和坑

| 限制 | 说明 |
|------|------|
| `display: fullscreen` 不支持 | iOS 不支持 fullscreen，会 fallback 到 standalone |
| `display: minimal-ui` 不支持 | 同样 fallback 到浏览器模式或 standalone |
| `background_color` 不生效 | iOS 不读取 manifest 中的 background_color |
| SVG 图标不支持 | 必须提供 PNG 格式图标 |
| Maskable 图标 iOS 不支持 | iOS 会忽略 `purpose: "maskable"`，使用默认图标裁剪 |
| Monochrome 图标不支持 | iOS 不支持 monochrome purpose |
| `shortcuts` 不支持 | iOS 不支持 manifest shortcuts（长按菜单） |
| `beforeinstallprompt` 不支持 | iOS 无法通过 JS 触发安装横幅 |
| `id` 字段 iOS 16.4+ 支持 | 允许同一 PWA 安装多个实例 |

### 推荐方案

1. **必须同时提供 manifest 和 HTML meta 标签**。iOS Safari 在某些版本上对 manifest 的支持不完整，HTML meta 是兜底保障。
2. **apple-mobile-web-app-capable 必须设置**，否则 `apple-touch-startup-image` 启动画面不会显示。
3. **apple-touch-icon 必须在 HTML 中声明**，优先级高于 manifest icons。
4. **提供所有尺寸的 PNG 图标**：120x120、152x152、167x167、180x180、192x192、512x512。
5. **不要依赖 `beforeinstallprompt`**，iOS 没有 native 安装提示。引导用户通过 Safari 分享菜单手动添加。

---

## 2. 安全区域 CSS

### 当前最佳实践

iOS 刘海屏、灵动岛、底部 Home Indicator 会遮挡内容。使用 CSS `env(safe-area-inset-*)` 安全区域变量确保内容不被遮挡。

全局基础设置：

```css
/* 全局：确保 viewport 填满屏幕 */
html {
  height: 100%;
  box-sizing: border-box;
}

body {
  min-height: 100%;
  /* 关键：允许内容扩展到安全区域外，再用 padding 留出空间 */
}

/* Tailwind CSS 4 方式 */
@import "tailwindcss";

/* 在你的全局 CSS 中定义安全区域 tokens */
@theme {
  --safe-top: env(safe-area-inset-top);
  --safe-right: env(safe-area-inset-right);
  --safe-bottom: env(safe-area-inset-bottom);
  --safe-left: env(safe-area-inset-left);
}
```

viewport meta 标签（必须包含 `viewport-fit=cover`）：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

组件级安全区域处理：

```tsx
// src/components/AppShell.tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen">
      {/* 顶部导航栏：留出灵动岛/刘海空间 */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* 导航内容 */}
      </header>

      {/* 主内容区：顶部和底部都留出安全区域 */}
      <main
        className="flex-1 overflow-auto"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + var(--header-height, 56px))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {children}
      </main>

      {/* 底部导航栏：留出 Home Indicator 空间 */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* 底部导航 */}
      </nav>
    </div>
  )
}
```

自定义 Tailwind 工具类：

```css
/* 安全区域工具类 */
@layer utilities {
  .pt-safe {
    padding-top: env(safe-area-inset-top);
  }
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
  .pl-safe {
    padding-left: env(safe-area-inset-left);
  }
  .pr-safe {
    padding-right: env(safe-area-inset-right);
  }
  .p-safe {
    padding: env(safe-area-inset-top) env(safe-area-inset-right)
      env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
}
```

### iOS 特有限制和坑

| 限制 | 说明 |
|------|------|
| 横屏旋转时安全区域会变化 | 旋转后 inset 值可能改变，需要响应式处理 |
| `env()` 在非 standalone 模式下值为 0 | 普通浏览器中 safe-area-inset 值为 0px |
| Home Indicator 区域在底部约 34px | 底部导航必须预留此空间 |
| iPad 没有底部安全区域 | 但横屏时有侧边安全区域 |
| `viewport-fit=cover` 是前提 | 不设置此属性，`env(safe-area-inset-*)` 始终为 0 |

### 推荐方案

1. **始终设置 `viewport-fit=cover`**，否则安全区域变量无效。
2. **固定定位的头部和底部导航栏必须处理安全区域**。
3. **使用 `calc()` 组合安全区域和其他间距**：`calc(env(safe-area-inset-top) + 56px)`。
4. **检测 standalone 模式后条件性应用**：普通浏览器模式下安全区域值为 0，不会造成额外间距。
5. **提供 fallback 值**：`env(safe-area-inset-bottom, 0px)` 确保向后兼容。

---

## 3. 状态栏融合

### 当前最佳实践

iOS 状态栏可通过 `apple-mobile-web-app-status-bar-style` meta 标签控制外观，实现沉浸式体验。

```html
<!-- 方案 A：全沉浸式（推荐）-->
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<!-- 状态栏变透明，内容延伸到状态栏背后，需要自己处理安全区域 -->

<!-- 方案 B：黑色背景 -->
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<!-- 状态栏为黑色背景白色文字 -->

<!-- 方案 C：默认白色 -->
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<!-- 状态栏为白色背景黑色文字 -->
```

检测当前状态栏样式并适配：

```tsx
// src/hooks/useStatusBarStyle.ts
export function useIsStandalone() {
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    setIsStandalone(mq.matches)

    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isStandalone
}
```

沉浸式状态栏下的导航栏设计：

```tsx
// src/components/ImmersiveHeader.tsx
export function ImmersiveHeader() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        // 背景使用毛玻璃效果
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center justify-between h-14 px-4">
        <h1 className="text-lg font-semibold">Hapi Power</h1>
      </div>
    </header>
  )
}
```

### iOS 特有限制和坑

| 限制 | 说明 |
|------|------|
| `black-translucent` 是唯一沉浸式方案 | 其他值都有固定颜色的状态栏背景 |
| 状态栏文字颜色不可控 | iOS 根据状态栏背景自动决定黑/白文字，开发者无法指定 |
| 灵动岛设备状态栏高度约 59px | 比刘海屏（约 47px）更高 |
| Light/Dight Mode 下状态栏外观不同 | 暗色模式下状态栏文字为白色 |
| `theme-color` meta iOS 15.0+ 可用 | 但它控制的是状态栏颜色，不能实现透明 |
| iOS 16.4+ 支持 `theme-color` 自动适配 | 可根据 prefers-color-scheme 动态切换 |

### 推荐方案

1. **使用 `black-translucent` + 毛玻璃效果**获得最佳沉浸式体验。
2. **固定头部必须包含 `env(safe-area-inset-top)` padding**。
3. **使用 `@media (prefers-color-scheme: dark)` 动态设置 theme-color**：

```html
<meta name="theme-color" content="#1a1a2e" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
```

4. **避免在状态栏区域放置交互元素**，以防误触。

---

## 4. 启动画面

### 当前最佳实践

iOS 至今不支持 manifest 中的 splash screen 配置。唯一的方案是使用 `apple-touch-startup-image` link 标签。

```html
<!-- iPhone 14 Pro / 15 Pro (393x852 逻辑像素, 3x) -->
<link
  rel="apple-touch-startup-image"
  href="/splash/iphone14pro.png"
  media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
/>

<!-- iPhone 14 / 15 (390x844 逻辑像素, 3x) -->
<link
  rel="apple-touch-startup-image"
  href="/splash/iphone14.png"
  media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
/>

<!-- iPhone SE 3rd (375x667 逻辑像素, 2x) -->
<link
  rel="apple-touch-startup-image"
  href="/splash/iphonese.png"
  media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
/>

<!-- iPhone 14 Pro Max / 15 Pro Max (430x932 逻辑像素, 3x) -->
<link
  rel="apple-touch-startup-image"
  href="/splash/iphone14promax.png"
  media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
/>

<!-- iPhone 16 Pro (402x874 逻辑像素, 3x) -->
<link
  rel="apple-touch-startup-image"
  href="/splash/iphone16pro.png"
  media="screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
/>

<!-- iPhone 16 Pro Max (440x956 逻辑像素, 3x) -->
<link
  rel="apple-touch-startup-image"
  href="/splash/iphone16promax.png"
  media="screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
/>
```

使用 Vite 自动生成启动画面：

```ts
// vite.config.ts 中可使用 vite-plugin-pwa 的配置
VitePWA({
  // ...其他配置
  workbox: {
    // injectManifest 模式下的 workbox 配置
  },
  // iOS 启动画面需要手动在 index.html 中添加
  // 或使用社区插件如 vite-pwa-assets-generator
})
```

启动画面图片设计规范：

- **实际像素尺寸** = 逻辑尺寸 x devicePixelRatio
- 例如 iPhone 15 Pro：393 x 852 逻辑像素 x 3 = 1179 x 2556 实际像素
- **图片必须精确匹配设备尺寸**，否则不会显示
- **背景色应在图片中填充**，iOS 不读取 manifest 的 background_color

### iOS 特有限制和坑

| 限制 | 说明 |
|------|------|
| 不支持 manifest splash screens | iOS 完全忽略 manifest 中的相关字段 |
| 必须为每个设备尺寸单独提供图片 | 没有通用方案，少了任何一个尺寸都不会显示 |
| 横屏也需要单独的图片 | 如果支持横屏，需要额外的 landscape 启动画面 |
| 图片尺寸必须精确匹配 | 即使差 1px 也不会显示 |
| 需要 apple-mobile-web-app-capable | 缺少此 meta 标签，启动画面不会显示 |
| 没有 API 可以用代码生成 | 必须静态声明 link 标签 |
| iPad 需要额外的图片集 | 又是一批不同尺寸的图片 |

### 推荐方案

1. **使用自动化工具生成所有尺寸的启动画面**，推荐 `@vite-pwa/assets-generator` 或 `pwa-asset-generator`。
2. **只覆盖主流 iPhone 型号**，忽略冷门设备以控制包体积。
3. **设计简洁的启动画面**：品牌色背景 + Logo 居中，避免复杂布局。
4. **考虑使用深色/浅色两套启动画面**：

```html
<!-- 浅色模式 -->
<link
  rel="apple-touch-startup-image"
  href="/splash/iphone-dark.png"
  media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)"
/>
<link
  rel="apple-touch-startup-image"
  href="/splash/iphone-light.png"
  media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)"
/>
```

5. **如果不值得为每个设备做启动画面，可以省略**——用户会看到短暂的白屏（受 theme_color 影响），然后进入应用。

---

## 5. Service Worker 限制

### 当前最佳实践

Hapi Power 使用 `injectManifest` 策略，开发者编写自定义 Service Worker 并由 Workbox 注入 precache manifest。

```ts
// src/sw.ts
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// 清理旧版本缓存
cleanupOutdatedCaches()

// 预缓存 Vite 构建产物
precacheAndRoute(self.__WB_MANIFEST)

// API 请求：网络优先
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60, // 1 小时
      }),
    ],
  })
)

// 静态资源：缓存优先
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 天
      }),
    ],
  })
)

// 第三方资源：Stale While Revalidate
registerRoute(
  ({ url }) => url.origin !== self.location.origin,
  new StaleWhileRevalidate({
    cacheName: 'third-party-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 天
      }),
    ],
  })
)
```

Service Worker 注册（React 组件）：

```tsx
// src/app/registerSW.tsx
export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('SW registered:', registration.scope)

          // 监听更新
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  // 新版本激活，提示用户刷新
                  showUpdateToast()
                }
              })
            }
          })
        })
        .catch((err) => {
          console.error('SW registration failed:', err)
        })
    }
  }, [])

  return null
}
```

### iOS 特有限制和坑

| 限制 | 说明 |
|------|------|
| **Background Sync 不支持** | 无法在后台同步数据，页面关闭即停止 |
| **Periodic Background Sync 不支持** | 无法定期更新缓存 |
| **Background Fetch 不支持** | 无法后台下载大文件 |
| **SW 生命周期受限** | iOS 可随时终止 SW，没有延长生命的机制 |
| **存储独立于浏览器** | 安装的 PWA 有独立存储，不与 Safari 共享 |
| **存储限制约 50MB 起步** | 超出限制会被清理，无明确上限说明 |
| **Lockdown Mode 完全禁用 SW** | 开启锁定模式后 ServiceWorker 和 Cache API 全部不可用 |
| **SW 更新检查不可靠** | iOS 不保证每次启动都检查 SW 更新 |
| **7 天不使用后缓存可能被清除** | iOS WebKit 会清理长期未使用的 PWA 数据 |
| **Push 事件只在 foreground 触发** | 确切说，push 事件可以唤醒 SW，但处理时间有限 |

### 推荐方案

1. **使用 injectManifest 而非 generateSW**：获得完全控制权，可针对 iOS 限制做优化。
2. **实现应用内数据同步**：不依赖 Background Sync，在应用打开时主动同步。

```ts
// src/hooks/useDataSync.ts
export function useDataSync() {
  useEffect(() => {
    // 应用打开时同步
    syncData()

    // 页面可见性变化时同步
    const handler = () => {
      if (document.visibilityState === 'visible') {
        syncData()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
}

async function syncData() {
  // 从 IndexedDB 读取待同步队列
  // 发送到服务器
  // 更新本地缓存
}
```

3. **处理 Lockdown Mode**：检测 SW 是否可用，提供降级体验。

```tsx
// src/hooks/usePWASupport.ts
export function usePWASupport() {
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSupported(false)
      return
    }
    // 尝试注册，如果 Lockdown Mode 启用会失败
    navigator.serviceWorker.getRegistration('/').then((reg) => {
      setSupported(!!reg)
    })
  }, [])

  return supported
}
```

4. **使用 IndexedDB（通过 idb-keyval 或 Dexie）持久化关键数据**，不要只依赖 Cache API。
5. **在 SW 更新后通过 postMessage 通知客户端刷新**。

---

## 6. 推送通知

### 当前最佳实践

iOS 16.4+ 支持标准 Web Push API，但仅限已安装的 Home Screen PWA。不支持浏览器内推送。

推送订阅流程：

```tsx
// src/lib/pushNotifications.ts

const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY'

export async function requestNotificationPermission(): Promise<PushSubscription | null> {
  // 检查是否支持
  if (!('PushManager' in window)) {
    console.warn('Push notifications not supported')
    return null
  }

  // 检查是否是 standalone 模式（iOS 要求）
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  // iOS Safari navigator.standalone 已废弃，使用 matchMedia
  if (!isStandalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    console.warn('iOS: Push notifications only work in installed PWA mode')
    return null
  }

  // 请求权限
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return null
  }

  // 订阅推送
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  // 发送订阅到服务器
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })

  return subscription
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}
```

Service Worker 中处理推送：

```ts
// src/sw.ts 中添加
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options: NotificationOptions = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// 点击通知
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // 如果已有窗口，聚焦到它
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // 否则打开新窗口
      return self.clients.openWindow(url)
    })
  )
})
```

Badge API（iOS 16.4+）：

```ts
// 设置应用角标
if ('setAppBadge' in navigator) {
  await navigator.setAppBadge(5)
}

// 清除角标
if ('clearAppBadge' in navigator) {
  await navigator.clearAppBadge()
}
```

### iOS 特有限制和坑

| 限制 | 说明 |
|------|------|
| **仅限已安装的 PWA** | 浏览器内 Safari 不支持 Web Push |
| **需要用户主动授权** | 不像 Android 可以静默推送 |
| **推送到达后 SW 处理时间有限** | iOS 限制 SW 被 push 唤醒后的执行时间 |
| **推送必须显示通知** | `userVisibleOnly: true` 是强制要求 |
| **Badge API 需要通知权限** | 获得通知权限后 Badge 自动可用 |
| **通知显示应用名而非网站名** | 使用 manifest 中的 name |
| **iOS 16.4 是最低版本** | 更早版本完全不支持 Web Push |
| **Focus 模式影响推送** | 用户开启专注模式时通知可能被静默 |
| **Apple Watch 可接收通知** | 推送会自动同步到配对的 Apple Watch |
| **Lockdown Mode 禁用所有推送** | 锁定模式下完全不可用 |

### 推荐方案

1. **检测 PWA 模式后再请求推送权限**，避免在浏览器模式下弹出无意义的权限请求。
2. **使用 VAPID 密钥**，避免依赖第三方推送服务。
3. **实现优雅降级**：不支持推送时使用应用内通知或轮询。
4. **服务器端维护订阅有效性**：iOS 推送订阅可能过期，需要定期刷新。
5. **使用 Badge API 补充通知**：即使推送被关闭，角标也能提醒用户。

```tsx
// src/components/PushPermissionPrompt.tsx
export function PushPermissionPrompt() {
  const [isStandalone] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
  )

  if (!isStandalone) return null // 浏览器模式下不显示

  return (
    <div className="p-4 bg-blue-50 rounded-lg">
      <p>开启通知以获取重要提醒</p>
      <button onClick={requestNotificationPermission}>
        开启推送通知
      </button>
    </div>
  )
}
```

---

## 7. 离线体验

### 当前最佳实践

离线体验是 PWA 的核心价值。结合 precache（预缓存）和 runtime cache（运行时缓存）实现完整离线能力。

离线回退页面：

```ts
// src/sw.ts 中添加离线回退
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

// 离线回退页面
const offlineFallbackUrl = '/offline.html'

// 预缓存离线页面（在构建时由 vite 注入）
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('offline-cache').then((cache) => cache.add('/offline.html')))
})

// 导航请求的离线回退
registerRoute(
  new NavigationRoute(
    async ({ event }) => {
      try {
        // 尝试网络请求
        return await new NetworkFirst({
          cacheName: 'navigation-cache',
          networkTimeoutSeconds: 3,
        }).handle(event)
      } catch {
        // 网络失败，返回离线页面
        return caches.match(offlineFallbackUrl)
      }
    },
    {
      // 排除 admin 等不需要缓存的路径
      denylist: [/^\/admin/, /^\/api/],
    }
  )
)
```

离线页面组件：

```tsx
// src/pages/Offline.tsx
export default function Offline() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <div className="w-24 h-24 mb-6 rounded-full bg-gray-100 flex items-center justify-center">
        {/* 离线图标 */}
        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">暂无网络连接</h1>
      <p className="text-gray-500 mb-6">
        请检查网络设置后重试
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg"
      >
        重试
      </button>
    </div>
  )
}
```

网络状态检测：

```tsx
// src/hooks/useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return isOnline
}
```

离线数据管理（IndexedDB）：

```ts
// src/lib/offlineStorage.ts
import { get, set, del } from 'idb-keyval'

const QUEUE_KEY = 'offline-action-queue'

export async function queueOfflineAction(action: {
  type: string
  payload: unknown
  timestamp: number
}) {
  const queue = (await get<{ type: string; payload: unknown; timestamp: number }[]>(QUEUE_KEY)) || []
  queue.push(action)
  await set(QUEUE_KEY, queue)
}

export async function flushOfflineQueue() {
  const queue = (await get<{ type: string; payload: unknown; timestamp: number }[]>(QUEUE_KEY)) || []
  if (queue.length === 0) return

  const results = await Promise.allSettled(
    queue.map((action) =>
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      })
    )
  )

  // 只保留失败的请求
  const failed = queue.filter((_, i) => results[i].status === 'rejected')
  await set(QUEUE_KEY, failed)
}
```

### iOS 特有限制和坑

| 限制 | 说明 |
|------|------|
| **无 Background Sync** | 离线操作不能在后台自动同步 |
| **7 天不使用数据可能被清理** | WebKit 会清理长期未使用的 PWA 缓存和存储 |
| **存储上限不透明** | 超出限制时会被清理，没有明确警告 |
| **Cache API 不保证持久化** | iOS 可能因存储压力清理缓存 |
| **IndexedDB 相对稳定** | 比 Cache API 更不容易被清理 |
| **离线时 SW 可能未激活** | iOS 可能已终止 SW，需要用户打开 PWA 才能处理离线逻辑 |
| **无法预缓存大量数据** | 存储限制使得大量离线数据不可行 |

### 推荐方案

1. **关键数据存储在 IndexedDB 而非 Cache API**：IndexedDB 在 iOS 上比 Cache API 更不容易被清理。
2. **实现应用层同步队列**：不依赖 Background Sync，在应用打开时手动同步。

```tsx
// src/app/App.tsx
function App() {
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (isOnline) {
      // 上线时自动刷新离线队列
      flushOfflineQueue()
    }
  }, [isOnline])

  return (
    <>
      {!isOnline && <OfflineBanner />}
      {/* 应用内容 */}
    </>
  )
}
```

3. **使用 `persisted` 检查存储是否持久化**：

```ts
if (navigator.storage && navigator.storage.persist) {
  const isPersisted = await navigator.storage.persist()
  console.log('Storage persisted:', isPersisted)
}
```

4. **App Shell 模式**：预缓存应用外壳（HTML、CSS、JS），运行时缓存数据。

---

## 8. 导航和手势

### 当前最佳实践

iOS PWA 需要模拟原生应用的导航体验，同时处理 iOS 特有的手势交互。

底部导航栏（替代原生 Tab Bar）：

```tsx
// src/components/BottomNav.tsx
const tabs = [
  { path: '/', label: '首页', icon: HomeIcon },
  { path: '/discover', label: '发现', icon: SearchIcon },
  { path: '/profile', label: '我的', icon: UserIcon },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200/50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`
            }
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-xs">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

iOS 边缘滑动手势兼容：

```css
/* 避免左边缘滑动手势与页面返回冲突 */
/* 在主内容区域禁用水平滚动 */
.main-content {
  overscroll-behavior-x: none;
  touch-action: pan-y;
}

/* 固定定位的侧边栏需要特殊处理 */
.side-panel {
  touch-action: pan-y;
}
```

页面过渡动画（模拟原生 push/pop）：

```tsx
// src/components/PageTransition.tsx
import { motion, AnimatePresence } from 'framer-motion'

export function PageTransition({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

禁止不必要的橡皮筋效果：

```css
/* 全局禁用垂直橡皮筋效果（谨慎使用） */
html {
  overscroll-behavior: none;
}

/* 但在可滚动区域内允许 */
.scrollable {
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
```

### iOS 特有限制和坑

| 限制 | 说明 |
|------|------|
| **没有原生返回手势 API** | iOS 的左边缘滑动返回是系统级行为，PWA 中无法直接监听 |
| **standalone 模式无浏览器导航栏** | 需要自己实现所有导航 UI |
| **底部 Home Indicator 始终存在** | 底部导航栏需要避让 |
| **下拉刷新是系统行为** | 避免与自定义下拉刷新冲突 |
| **3D Touch / Haptic Touch** | PWA 中不可用 |
| **状态栏下拉通知中心** | 从顶部下拉会触发通知中心，避免在顶部放置可拖拽元素 |
| **长按选中文字** | iOS 默认长按会选中文字或弹出菜单，需通过 CSS 控制 |

### 推荐方案

1. **实现 App Shell 导航模式**：固定头部 + 底部 Tab Bar + 中间可滚动内容区。
2. **底部导航栏预留 Home Indicator 空间**：使用 `env(safe-area-inset-bottom)`。
3. **页面切换使用 slide 动画**，模拟 iOS 原生的 push/pop 效果。
4. **禁止全局 overscroll，但在滚动容器内允许**：

```css
html {
  overscroll-behavior: none; /* 防止全局橡皮筋 */
}
.scroll-container {
  overscroll-behavior-y: contain; /* 局部允许 */
}
```

5. **禁用长按弹出菜单（如需要）**：

```css
.no-context-menu {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
```

6. **检测 standalone 模式显示不同 UI**：

```tsx
const isStandalone = useIsStandalone()
// standalone 模式下显示自定义导航
// 浏览器模式下可以隐藏某些导航元素
```

---

## 9. 性能优化

### 当前最佳实践

iOS Safari PWA 的性能优化需要关注首屏加载、运行时性能、以及 iOS 特有的内存管理。

Vite 构建优化配置：

```ts
// vite.config.ts
export default defineConfig({
  build: {
    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'animation': ['framer-motion'],
        },
      },
    },
    // 优化依赖预构建
    target: 'es2020',
    // 生成 sourcemap 用于调试
    sourcemap: false,
    // 压缩选项
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
})
```

资源预加载策略：

```html
<!-- index.html -->
<!-- 预连接到 API 服务器 -->
<link rel="preconnect" href="https://api.example.com" />
<link rel="dns-prefetch" href="https://api.example.com" />

<!-- 预加载关键字体 -->
<link rel="preload" as="font" href="/fonts/main.woff2" type="font/woff2" crossorigin />

<!-- 预加载关键 CSS -->
<link rel="preload" as="style" href="/assets/critical.css" />
```

图片优化：

```tsx
// 使用原生 lazy loading + srcset
<img
  src="/images/hero-800.webp"
  srcSet="/images/hero-400.webp 400w, /images/hero-800.webp 800w, /images/hero-1200.webp 1200w"
  sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px"
  alt="Hero"
  loading="eager"
  fetchPriority="high"
  width={800}
  height={400}
/>

// 非关键图片
<img
  src="/images/content.webp"
  alt="Content"
  loading="lazy"
  decoding="async"
  width={600}
  height={300}
/>
```

NGINX 缓存配置：

```nginx
# NGINX PWA 缓存配置

# HTML 入口文件：不缓存（或短缓存）
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_headerPragma "no-cache";
    try_files $uri $uri/ /index.html;
}

# Service Worker：不缓存
location = /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Service-Worker-Allowed "/";
}

# Manifest：短缓存
location = /manifest.webmanifest {
    add_header Cache-Control "max-age=300";
    types { application/manifest+json webmanifest; }
}

# 静态资源（带 hash）：长期缓存
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    # Vite 构建产物带 hash，可以安全地永久缓存
}

# 图标和启动画面
location /icons/ {
    add_header Cache-Control "public, max-age=604800"; # 7 天
}

# 启动画面
location /splash/ {
    add_header Cache-Control "public, max-age=604800"; # 7 天
}
```

运行时性能优化：

```tsx
// 使用 React.lazy 进行路由级代码分割
const Home = React.lazy(() => import('./pages/Home'))
const Discover = React.lazy(() => import('./pages/Discover'))
const Profile = React.lazy(() => import('./pages/Profile'))

// 懒加载组件
function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Suspense>
  )
}
```

### iOS 特有限制和坑

| 限制 | 说明 |
|------|------|
| **Safari JavaScript 引擎比 Chrome 慢** | JSCore 比 V8 性能低，复杂计算需注意 |
| **内存限制更严格** | iOS 可能因内存压力终止 PWA 标签页 |
| **CSS 动画性能受限** | 避免 animate layout 属性（width/height/top/left） |
| **WebGL 性能低于原生** | 复杂 3D 场景性能不佳 |
| **Service Worker 更新延迟** | SW 更新检查不保证每次启动都执行 |
| **大量 DOM 节点影响滚动** | iOS Safari 对大量 DOM 节点的滚动性能差 |
| **WKWebView 内存警告** | 收到内存警告时需要释放资源 |
| **First Load 无 SW 缓存** | 首次加载必须从网络获取所有资源 |

### 推荐方案

1. **严格控制 JS Bundle 大小**：
   - 首屏 JS < 100KB gzipped
   - 路由级 code splitting
   - 按需加载重型库（图表、动画等）

2. **使用虚拟滚动处理长列表**：

```tsx
import { VirtualList } from '@tanstack/react-virtual'

function LongList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualItem.start}px)`,
              height: virtualItem.size,
            }}
          >
            {/* 渲染列表项 */}
          </div>
        ))}
      </div>
    </div>
  )
}
```

3. **使用 CSS `will-change` 优化动画性能**（谨慎使用，不要滥用）：

```css
.animate-element {
  will-change: transform, opacity;
}
/* 动画结束后移除 will-change */
.animate-element.animated {
  will-change: auto;
}
```

4. **减少 DOM 复杂度**：避免深层嵌套，使用 CSS containment。

```css
.component {
  contain: layout style paint;
}
```

5. **使用 `requestIdleCallback` 做低优先级工作**：

```ts
function prefetchNextRouteData() {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // 预加载下一页数据
      fetch('/api/next-page-data').then(/* ... */)
    })
  }
}
```

---

## 附录

### A. iOS PWA 兼容性快速参考

| 功能 | iOS 最低版本 | 备注 |
|------|------------|------|
| `display: standalone` | 11.3 | 基础 PWA 模式 |
| `theme_color` | 15.0 | manifest 和 meta 标签 |
| Manifest icons | 15.4 | 但 `apple-touch-icon` 优先 |
| Web Push | 16.4 | 仅限已安装 PWA |
| Badge API | 16.4 | 随通知权限自动授予 |
| Screen Wake Lock | 16.4 | 保持屏幕常亮 |
| `id` manifest | 16.4 | 多实例安装 |
| Third-party browser A2HS | 16.4 | Chrome/Firefox 可添加到主屏幕 |
| Background Sync | 不支持 | 截至目前不支持 |
| Periodic Background Sync | 不支持 | 截至目前不支持 |
| Background Fetch | 不支持 | 截至目前不支持 |
| `beforeinstallprompt` | 不支持 | 无法 JS 触发安装 |
| Manifest `shortcuts` | 不支持 | 长按快捷方式 |
| SVG icons | 不支持 | 必须用 PNG |
| Maskable icons | 不支持 | 忽略 purpose |

### B. 关键检测代码

```ts
// src/lib/pwaDetect.ts

/** 检测是否运行在 standalone 模式 */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    // @ts-expect-error deprecated but still works on older iOS
    || window.navigator.standalone === true
}

/** 检测是否是 iOS 设备 */
export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    // iPadOS 13+ 在桌面模式下报告为 Mac
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** 检测是否支持 Web Push */
export function supportsPush(): boolean {
  return 'PushManager' in window && 'serviceWorker' in navigator
}

/** 检测是否支持 Service Worker */
export function supportsSW(): boolean {
  return 'serviceWorker' in navigator
}

/** 检测是否处于 Lockdown Mode（间接检测） */
export async function isLockdownMode(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return true
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    return !reg && isStandalone()
  } catch {
    return true
  }
}
```

### C. 推荐工具和库

| 工具 | 用途 |
|------|------|
| `vite-plugin-pwa` | PWA 集成（injectManifest 模式） |
| `workbox-*` | Service Worker 工具库（预缓存、路由、策略） |
| `idb-keyval` | 轻量 IndexedDB 封装 |
| `@tanstack/react-virtual` | 虚拟滚动 |
| `framer-motion` | 页面过渡动画 |
| `@vite-pwa/assets-generator` | 自动生成图标和启动画面 |

### D. 参考资源

- [firt.dev iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/) — Maximiliano Firtman 维护的最全面的 iOS PWA 兼容性表格
- [WebKit Safari 16.4 Features](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/) — Web Push 和其他 API 的官方说明
- [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — 安装和 standalone 模式最佳实践
- [vite-plugin-pwa 文档](https://vite-pwa-org.netlify.app/) — Vite PWA 插件官方文档
