# Plan 19-01: SW 更新机制修复

**Phase**: 19 — SW 更新机制修复
**Requirements**: SWU-01, SWU-02, SWU-05, SWU-06
**Depends on**: v0.3 (main)
**Branch**: feat/v4

## 目标

修复 PWA 模式下更新不生效的核心问题。用户反馈必须重装才能获取新版本，根本原因是 registerType 配置矛盾和 sw.ts 缺少 skipWaiting/clients.claim。

## 问题根因分析

### 问题 1: registerType 配置矛盾
- `vite.config.ts` 设置 `registerType: 'autoUpdate'`
- `main.tsx` 同时使用 `onNeedRefresh` 回调
- `autoUpdate` 模式下 vite-plugin-pwa 自动 skipWaiting + reload，`onNeedRefresh` 永远不会被触发
- **结果**: 更新行为不确定，iOS 上经常不更新

### 问题 2: sw.ts 缺少 skipWaiting + clients.claim
- 使用 `injectManifest` 策略时，这两个调用必须手动添加
- 没有它们，新 SW 要等所有旧标签页关闭才能激活
- **结果**: iOS 用户长时间停留在旧版本

### 问题 3: iOS SW 更新检查不频繁
- iOS Safari 不保证每次启动都检查 SW 更新
- 当前每小时轮询一次，对 iOS 来说间隔太长
- **结果**: 用户打开 PWA 可能几天都是旧版本

## 实施步骤

### Step 1: 修复 vite.config.ts — registerType 改为 'prompt'

**文件**: `web/vite.config.ts`

```diff
- registerType: 'autoUpdate',
+ registerType: 'prompt',
```

### Step 2: sw.ts 添加 skipWaiting + clients.claim

**文件**: `web/src/sw.ts`

在文件顶部（precacheAndRoute 之前）添加:

```ts
// 确保新 SW 立即激活，不等待旧标签页关闭
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
```

### Step 3: sw.ts 添加 message 事件处理（支持客户端触发 skipWaiting）

```ts
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting()
    }
})
```

### Step 4: 优化 main.tsx SW 注册逻辑

**文件**: `web/src/main.tsx`

将更新轮询间隔从 60 分钟改为 30 分钟（iOS 补偿），移除 confirm() 调用:

```ts
const updateSW = registerSW({
    onNeedRefresh() {
        // 通过自定义事件通知 UI 层显示更新提示
        window.dispatchEvent(new CustomEvent('sw-update-available', {
            detail: { updateSW }
        }))
    },
    onOfflineReady() {
        console.log('App ready for offline use')
    },
    onRegistered(registration) {
        if (registration) {
            // iOS 补偿：每 30 分钟检查更新（iOS 不保证每次启动都检查）
            setInterval(() => {
                registration.update()
            }, 30 * 60 * 1000)
        }
    },
    onRegisterError(error) {
        console.error('SW registration error:', error)
    }
})
```

### Step 5: 创建 SW 更新 hook

**新建文件**: `web/src/hooks/useSWUpdate.ts`

功能:
- 监听 `sw-update-available` 自定义事件
- 提供 `updateAvailable` 状态和 `applyUpdate()` 方法
- 在 App 组件中使用，控制更新横幅显示
- 更新后自动调用 `navigator.storage.persist()` 确保持久化

### Step 6: storage.persist() 调用

在 SW 注册成功后调用持久化存储:

```ts
if (navigator.storage?.persist) {
    const granted = await navigator.storage.persist()
    if (granted) {
        console.log('Persistent storage granted')
    }
}
```

## 质量门禁

- [ ] `cd web && npx tsc --noEmit` 通过
- [ ] `cd web && npx vitest run` 通过
- [ ] grep 确认无 `registerType: 'autoUpdate'` 残留
- [ ] sw.ts 包含 skipWaiting + clients.claim + message handler

## 涉及文件

| 文件 | 操作 |
|------|------|
| `web/vite.config.ts` | 修改 registerType |
| `web/src/sw.ts` | 添加 skipWaiting/claim/message handler |
| `web/src/main.tsx` | 重构 SW 注册逻辑 |
| `web/src/hooks/useSWUpdate.ts` | 新建 |

---
*Plan created: 2026-05-31*
