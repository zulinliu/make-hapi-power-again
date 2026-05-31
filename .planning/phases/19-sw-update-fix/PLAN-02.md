# Plan 19-02: 自定义更新 UI + 质量门禁

**Phase**: 19 — SW 更新机制修复
**Requirements**: SWU-03, SWU-04, SWU-06
**Depends on**: Plan 19-01

## 目标

用自定义更新横幅替代原生 confirm()，显示版本号信息，完成 Phase 19 质量门禁。

## 实施步骤

### Step 1: 创建 UpdateBanner 组件

**新建文件**: `web/src/components/UpdateBanner.tsx`

设计要求:
- 固定在页面顶部，覆盖在导航栏之下
- 显示 "新版本可用 (v{version})" + "立即更新" 按钮
- 与应用设计风格一致（使用 --app-* CSS 变量）
- 更新按钮点击后调用 `updateSW(true)` 触发页面刷新
- 支持 reduced-motion 动画

```tsx
// 核心逻辑
function UpdateBanner() {
    const { updateAvailable, applyUpdate, newVersion } = useSWUpdate()

    if (!updateAvailable) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-accent text-white ...">
            <span>新版本可用 ({newVersion})</span>
            <button onClick={applyUpdate}>立即更新</button>
        </div>
    )
}
```

### Step 2: 在 App.tsx 中挂载 UpdateBanner

将 UpdateBanner 添加到应用顶层（RouterProvider 之后），确保所有页面都能看到更新提示。

### Step 3: 集成 APP_VERSION 显示

通过 `__APP_VERSION__` 全局常量（已在 vite.config.ts 中定义）在更新横幅中展示当前版本和可用版本。

### Step 4: i18n 翻译键

在 `web/src/locales/zh.ts` 和 `en.ts` 中添加:
- `update.available`: "新版本可用"
- `update.button`: "立即更新"
- `update.version`: "版本 {version}"

## 质量门禁

- [ ] `cd web && npx tsc --noEmit` 通过
- [ ] `cd web && npx vitest run` 通过
- [ ] UpdateBanner 在桌面端和移动端正确显示
- [ ] 确认 confirm() 已完全移除
- [ ] Phase 19 全部提交 + 推送

## 涉及文件

| 文件 | 操作 |
|------|------|
| `web/src/components/UpdateBanner.tsx` | 新建 |
| `web/src/App.tsx` | 挂载 UpdateBanner |
| `web/src/locales/zh.ts` | 添加翻译键 |
| `web/src/locales/en.ts` | 添加翻译键 |

---
*Plan created: 2026-05-31*
