# 2026-06-10 — Unified Frontend Audit And Execution Notes

## GoalFlow Environment

- Branch: `feat/v0.19.0`
- Git author: `zulinliu <277557317@qq.com>`
- GoalFlow core dependencies: installed after syncing Impeccable into Codex skills.
- Remaining warning before this phase: `DESIGN.md` missing. This phase creates it.

## Subagent Downgrade Record

Two rounds of Paseo audit subagents were attempted before implementation:

- `claude-opus-4-8`: IA/page, overlay/interaction, responsive/mobile, visual/brand audits all failed with model gateway `503 No available channel`.
- `claude-sonnet-4-6`: same four audit tracks also failed with model gateway `503 No available channel`.

Implementation proceeds with local repo inspection and existing planning artifacts. A future release gate should rerun multi-agent review when the inference gateway is available.

## Current Structural Findings

- `web/src/router.tsx` owns substantial layout logic for session list/detail, mobile headers, browse, and new-session surfaces.
- `web/src/styles/tokens.css` already contains a strong `--hp-*` base, but `--app-*` aliases and page-level styles are still widely used.
- Overlay behavior is fragmented across Radix dialog, `FileManager/Dialog.tsx`, `FileManager/ContextMenu.tsx`, `ui/ContextMenu.tsx`, `ScheduleTimePicker`, `StatusBar`, `SessionLoomPanel`, and feature-specific CSS keyframes.
- Settings contains repeated hand-rolled dropdown/listbox logic.
- FileManager contains local buttons, dialog, toast, context menu, animations, and responsive rules outside the shared UI layer.
- Mobile constraints are partially handled through `useViewportHeight`, `usePlatform`, safe-area CSS, and several 44px tests, but there is no central adaptive contract.

## Page Matrix

| Surface | Current Route / Component | Primary issue | Target pattern |
|---|---|---|---|
| Login/Auth | `LoginPrompt`, `App` auth states | Standalone CSS and dialog overrides | Product-auth shell with shared form controls |
| Sessions | `/sessions`, `SessionList` | Router-owned split behavior | `WorkbenchShell` + adaptive list/detail |
| New Session | `/sessions/new`, `NewSession` | Many local selectors and Git Portal modal | `ModulePage` + shared selector/action rows |
| Chat | `/sessions/:id`, `SessionChat` | Composer/status overlays are local | `SessionWorkspace` + shared popover/sheet rules |
| Files | `/sessions/:id/files`, `/browse` | FileManager owns its UI system | Shared toolbar, menu, dialog, empty/loading states |
| File viewer | `/sessions/:id/file`, `/browse/file` | Toolbar and confirm dialogs vary | `ModulePage` + unified editor command bar |
| Terminal | `/sessions/:id/terminal` | Mobile/read-only and paste fallback are bespoke | Adaptive terminal module with keyboard accessory |
| Git Atlas | `/sessions/:id/git` | Dense route-local controls | Desktop split module, compact review stack |
| Loom | `/sessions/:id/loom`, `SessionLoomPanel` | Side-panel vs page duplication | Shared inspector/page mode |
| Extensions | `/sessions/:id/extensions` | Custom tabs/actions | Shared tabs, list, confirm surfaces |
| Settings | `/settings` | Repeated dropdown implementation | Shared setting rows/selects |

## Overlay Matrix

| Type | Desktop | Compact | Notes |
|---|---|---|---|
| Dialog | Center modal | Full-width modal or task sheet | Short blocking forms only |
| Alert | Center modal | Bottom confirmation sheet | Destructive, focus trapped |
| Side panel | Right inspector | Full-screen task sheet | Long secondary work |
| Popover | Anchored floating | Bottom sheet or inline disclosure | Non-destructive info |
| Context menu | Pointer anchored | Bottom action sheet | Mobile must also expose visible action |
| Toast | Top-right or top-center | Safe-area top stack | No local toast systems |

## Responsive Matrix

| Class | Width | Shell | Interaction |
|---|---:|---|---|
| compact | < 640px | stack + bottom command bar | touch first, 44px targets |
| medium | 640-1023px | stack or two-column depending task | touch/hybrid |
| expanded | 1024-1439px | side list + detail + optional inspector | keyboard/mouse |
| large | 1440-1919px | richer inspector and wider diff/editor | keyboard/mouse |
| xlarge | >= 1920px | multi-pane workbench | keyboard/mouse |

## Token Allowlist

- Canonical: `--hp-*`
- Temporary compatibility: `--app-*` only where Telegram theme fallback or assistant-ui integration still needs it.
- New arbitrary Tailwind values are disallowed unless registered in `docs/design-system.md`.
- New `@keyframes` must be added to the shared motion vocabulary, not feature CSS.

## Verification Gate

- `bun run typecheck`
- `bun run test`
- `bun run build`
- Prototype screenshot/manual checks at 390, 430, 768, 1280, 1440, 1600 widths.
