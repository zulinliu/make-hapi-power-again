# Adaptive UI Architecture

Hapi Power adapts by window class, input mode, shell mode, safe area, and keyboard state. It does not treat mobile as a scaled desktop.

## Window Classes

| Class | Width | Shell |
|---|---:|---|
| compact | `< 640px` | Stack navigation, full-screen task surfaces, bottom command bar |
| medium | `640px-1023px` | Stack or two-column depending task |
| expanded | `1024px-1439px` | Session list + detail, optional right inspector |
| large | `1440px-1919px` | Wider editor/diff and persistent inspector |
| xlarge | `>= 1920px` | Multi-pane workbench |

## Input Modes

- `touch`: coarse pointer, mobile/PWA first. Use visible actions, 44px targets, bottom sheets.
- `mouse`: hover, right click, compact density, resizable panes.
- `keyboard`: focus rings, shortcut hints, command bars.
- `hybrid`: keep visible touch actions while allowing desktop affordances.

## Shell Modes

- `stack`: route-level stack navigation for compact surfaces.
- `split`: list/detail desktop workbench.
- `workspace`: detail plus tool panel and optional inspector.

## Surface Rules

- Chat, Files, Git, Terminal, Loom, Settings, and New Session must all render through the same `PageScaffold` or `SessionWorkspace` contract.
- Compact module actions move to `BottomCommandBar`.
- Expanded module actions stay in `ActionToolbar`.
- Long secondary work uses `InspectorPane` on expanded screens and `OverlaySurface` sheet on compact screens.

## Acceptance Criteria

- No incoherent overlap at 390x844, 430x932, 768x1024, 1280x900, 1440x1000, or 1600x1000.
- Safe-area insets are respected for top banners, bottom bars, sheets, and composer.
- Virtual keyboard changes do not hide the focused input or primary command.
- Reduced motion disables travel animations.
