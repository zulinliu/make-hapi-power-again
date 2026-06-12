# v0.20.0 首批公共组件 API 草案

> 本文件用于把 HTML 原型沉淀为生产实现前的组件契约。最终实现应放入 `web/src/components/ui/` 或等价公共层，并配套 story / test / docs。

## 1. 公共类型

```ts
export type AdaptiveMode = 'desktop' | 'mobile' | 'tablet' | 'hybrid';
export type ActionTone = 'default' | 'primary' | 'danger' | 'success' | 'warning';

export interface CommandAction {
    id: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
    tone?: ActionTone;
    shortcut?: string;
    disabled?: boolean;
    disabledReason?: string;
    loading?: boolean;
    onSelect: () => void | Promise<void>;
}

export interface DataState {
    status: 'idle' | 'loading' | 'empty' | 'error' | 'offline' | 'permission-denied' | 'stale';
    title?: string;
    description?: string;
    primaryAction?: CommandAction;
    secondaryAction?: CommandAction;
}
```

## 2. OverlaySurface

```ts
export type OverlayKind =
    | 'dialog'
    | 'alert'
    | 'side-panel'
    | 'bottom-sheet'
    | 'full-screen-sheet'
    | 'popover'
    | 'context-menu'
    | 'command-palette'
    | 'preview';

export interface OverlaySurfaceProps {
    open: boolean;
    kind: OverlayKind;
    title: string;
    description?: string;
    adaptiveMode?: AdaptiveMode;
    labelledBy?: string;
    closeLabel?: string;
    dismissible?: boolean;
    initialFocusRef?: React.RefObject<HTMLElement>;
    returnFocusRef?: React.RefObject<HTMLElement>;
    actions?: CommandAction[];
    footer?: React.ReactNode;
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
}
```

必须内建：Portal、焦点陷阱、焦点返回、`inert` 背景、滚动锁、Escape 关闭、统一 z-index、reduced-motion、移动端 `kind` 映射。

## 3. PageScaffold

```ts
export interface PageScaffoldProps {
    title: string;
    eyebrow?: string;
    description?: string;
    adaptiveMode?: AdaptiveMode;
    navigation?: React.ReactNode;
    toolbar?: React.ReactNode;
    tabs?: CommandAction[];
    activeTabId?: string;
    inspector?: React.ReactNode;
    inspectorOpen?: boolean;
    footer?: React.ReactNode;
    state?: DataState;
    children: React.ReactNode;
    onTabChange?: (tabId: string) => void;
}
```

必须内建：header / toolbar / content / footer / inspector 区域、空/错/加载态承接、移动端栈式降级、安全区和底部命令栏占位。

## 4. BottomCommandBar

```ts
export interface BottomCommandBarProps {
    visible?: boolean;
    title?: string;
    description?: string;
    primaryAction?: CommandAction;
    secondaryActions?: CommandAction[];
    batchActions?: CommandAction[];
    safeArea?: boolean;
    avoidKeyboard?: boolean;
    sticky?: boolean;
}
```

必须内建：44px 最小触控目标、`env(safe-area-inset-bottom)`、`visualViewport` 键盘避让、与 Toast / Sheet / Composer 的避让关系。

## 5. ActionMenu

```ts
export interface ActionMenuGroup {
    id: string;
    label?: string;
    actions: CommandAction[];
}

export interface ActionMenuProps {
    triggerLabel: string;
    groups: ActionMenuGroup[];
    adaptiveMode?: AdaptiveMode;
    align?: 'start' | 'center' | 'end';
    placement?: 'bottom-start' | 'bottom-end' | 'right-start';
    contextMenu?: boolean;
    onOpenChange?: (open: boolean) => void;
}
```

桌面端映射为 Popover / Context Menu；移动端映射为 Action Sheet。危险操作必须带 `tone: 'danger'` 和明确 `disabledReason` / confirm 流。

## 6. DataBoundary

```ts
export interface DataBoundaryProps<T = unknown> {
    state: DataState;
    data?: T;
    loadingFallback?: React.ReactNode;
    emptyFallback?: React.ReactNode;
    errorFallback?: React.ReactNode;
    offlineFallback?: React.ReactNode;
    permissionFallback?: React.ReactNode;
    children: (data: T) => React.ReactNode;
}
```

必须内建：Skeleton 优先、Empty 下一步、Error 原因/影响/恢复路径、Offline 重连、Permission denied 申请路径、stale data 标识。
