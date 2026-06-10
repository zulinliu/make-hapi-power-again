---
name: Hapi Power
description: AI coding agent workbench with a unified adaptive product UI.
colors:
  electric-orange: "oklch(68% 0.18 55)"
  electric-orange-hover: "oklch(62% 0.20 50)"
  amber-gold: "oklch(78% 0.14 85)"
  canvas: "oklch(99% 0.003 75)"
  surface-0: "oklch(100% 0 0)"
  surface-1: "oklch(98.5% 0.003 55)"
  surface-2: "oklch(96% 0.005 55)"
  ink: "oklch(13% 0.02 55)"
  text-secondary: "oklch(40% 0.01 55)"
  text-tertiary: "oklch(52% 0.01 55)"
  success: "oklch(65% 0.16 155)"
  warning: "oklch(75% 0.15 80)"
  danger: "oklch(60% 0.20 22)"
  info: "oklch(65% 0.12 230)"
typography:
  display:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0"
  headline:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 550
    lineHeight: 1.35
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
components:
  button-primary:
    backgroundColor: "{colors.electric-orange}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  panel:
    backgroundColor: "{colors.surface-0}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Hapi Power

## 1. Overview

**Creative North Star: "Command Deck With Warm Power"**

Hapi Power is a developer workbench, not a decorative dashboard. The interface should feel precise, dense, and calm enough for repeated engineering work, while electric orange gives the product a recognizable pulse at moments of action, risk, and routing.

The system uses familiar product patterns: side navigation, split panes, tabbed modules, command bars, contextual inspectors, and explicit confirmation flows. Mobile is not a shrunken desktop; compact layouts move task actions into bottom command bars and bottom sheets, while expanded layouts keep keyboard, hover, and multi-pane efficiency.

**Key Characteristics:**
- Task-first structure with predictable navigation and stable tool placement.
- Restrained visual language with orange as the active/action signal, not decoration.
- Dense but readable surfaces, with consistent spacing, hit targets, focus rings, and states.
- Adaptive layouts driven by window class and input mode rather than device names.
- Every secondary window uses the same overlay semantics, focus behavior, and motion vocabulary.

## 2. Colors

The palette is warm-neutral and operational, with electric orange reserved for primary action, current selection, and high-confidence energy.

### Primary
- **Electric Orange** (`oklch(68% 0.18 55)`): Primary CTA, selected navigation, active route, important focus state, and signature brand mark.
- **Orange Hover** (`oklch(62% 0.20 50)`): Hover and active state for primary actions only.

### Secondary
- **Amber Gold** (`oklch(78% 0.14 85)`): Occasional support accent for capability, latency, and provider-health highlights. Do not use it as a second CTA color.

### Tertiary
- **Signal Blue** (`oklch(65% 0.12 230)`): Informational state and diagnostics only.
- **Signal Green / Warning / Danger** (`oklch(65% 0.16 155)`, `oklch(75% 0.15 80)`, `oklch(60% 0.20 22)`): Semantic states. Never recolor these for brand variety.

### Neutral
- **Canvas Warm White** (`oklch(99% 0.003 75)`): App background.
- **Surface Stack** (`oklch(100% 0 0)`, `oklch(98.5% 0.003 55)`, `oklch(96% 0.005 55)`): Content, sidebars, toolbars, and selected rows.
- **Ink** (`oklch(13% 0.02 55)`): Primary text and icon color.
- **Secondary Ink** (`oklch(40% 0.01 55)`): Metadata, supporting labels, inactive actions.
- **Tertiary Ink** (`oklch(52% 0.01 55)`): Hints, timestamps, and low-emphasis labels.

### Named Rules
**The Orange Budget Rule.** Electric orange should occupy less than 10% of any product screen, excluding charts or one deliberate signature moment.

**The State Integrity Rule.** Success, warning, danger, and info colors are semantic. Do not use them for flavor, avatars, or decorative cards.

## 3. Typography

**Display Font:** Geist Sans with system fallback.
**Body Font:** Geist Sans with system fallback.
**Label/Mono Font:** Geist Mono for code, terminal, file paths, and token-like values.

**Character:** One tuned sans family keeps the product coherent. Hierarchy comes from size, weight, spacing, and grouping, not display-font contrast.

### Hierarchy
- **Display** (700, 2rem, 1.15): Login, public README screenshots, and rare empty-state heroes only.
- **Headline** (650, 1.5rem, 1.2): Top-level settings and module dashboards.
- **Title** (600, 1rem, 1.35): Panels, rows, dialogs, and form groups.
- **Body** (400, 0.9375rem, 1.55): Main UI copy. Long prose caps at 65-75ch.
- **Label** (550, 0.8125rem, 1.35): Form labels, metadata, table headers, chips, and compact controls. Letter spacing stays 0 unless a table header explicitly needs `0.02em`.

### Named Rules
**The Fixed Scale Rule.** Product UI uses fixed rem sizes. Do not use fluid `clamp()` typography for app chrome, panels, forms, tables, or controls.

**The Path Mono Rule.** Paths, commands, model IDs, tokens, and terminal output use Geist Mono.

## 4. Elevation

Hapi Power uses tonal layering first and shadows second. Panels rest flat with borders or surface contrast. Shadows appear when a surface floats above the page: dialogs, popovers, toasts, drag layers, and active overlay panels.

### Shadow Vocabulary
- **Focus Ring** (`0 0 0 2px oklch(68% 0.12 55 / 0.3)`): Keyboard focus and active field focus.
- **Raised Overlay** (`0 8px 32px oklch(13% 0.02 55 / 0.15)`): Dialog, popover, dropdown, and side-panel elevation.
- **Toast / Critical Overlay** (`0 16px 48px oklch(13% 0.02 55 / 0.25)`): Toasts and destructive confirmations.

### Named Rules
**The Flat By Default Rule.** Page sections, sidebars, toolbars, and repeated rows do not get decorative shadows. Use surface and border tokens.

## 5. Components

Every component ships with default, hover, focus, active, selected, disabled, loading, empty, error, and reduced-motion behavior where relevant.

### Buttons
- **Shape:** Rounded medium (`10px`) for text buttons, full radius only for icon-only circular buttons.
- **Primary:** Electric Orange background, Ink text, 36px desktop height, 44px compact touch height.
- **Hover / Focus:** Primary hover uses Orange Hover. Focus uses the focus ring, never only color.
- **Secondary / Ghost:** Secondary uses Surface 1 and border. Ghost appears only in dense toolbars and list rows.

### Chips
- **Style:** Subtle surface fill, compact label text, semantic border only when the chip communicates state.
- **State:** Selected chips use primary subtle background and primary text; disabled chips reduce opacity and remain readable.

### Cards / Containers
- **Corner Style:** `10px` for compact panels, `14px` for overlays, `20px` only for signature brand panels.
- **Background:** Surface 0 for content, Surface 1 for toolbars and grouped controls, Surface 2 for selected or nested state.
- **Shadow Strategy:** No shadow at rest. Raised overlays only.
- **Border:** One-pixel token border for separation. No thick side stripes.
- **Internal Padding:** 12px for dense controls, 16px for panels, 24px for large module sections.

### Inputs / Fields
- **Style:** Surface 0 background, token border, 10px radius, 44px compact height.
- **Focus:** Border turns primary and ring appears.
- **Error / Disabled:** Error uses danger text plus subtle danger background; disabled keeps contrast and removes pointer actions.

### Navigation
- **Desktop:** Session list + detail workspace + optional inspector. Tool navigation stays in a consistent header or side rail.
- **Mobile:** Stack navigation with a bottom command bar. Secondary tools open as task sheets or full-screen modules.
- **Active State:** Use primary color and surface fill together; never rely on color alone.

### Overlay Surface
- **Dialog:** Short blocking decisions and forms.
- **Alert:** Destructive irreversible decisions.
- **Side Panel:** Desktop inspectors and secondary work.
- **Bottom Sheet:** Compact selectors, action pickers, and contextual details.
- **Popover:** Lightweight, non-destructive disclosure.
- **Context Menu:** Desktop right click; compact long press must provide visible alternate buttons.

## 6. Do's and Don'ts

### Do:
- **Do** drive layout from `windowClass`, `inputMode`, and `shellMode`.
- **Do** use 44px minimum touch targets on compact/coarse-pointer surfaces.
- **Do** keep primary actions in a stable toolbar or bottom command bar.
- **Do** show state, reason, and next action for provider health, context risk, Git sync, export privacy, and connection issues.
- **Do** use skeletons for content loading and specific empty states with next actions.
- **Do** keep desktop interactions efficient with hover, keyboard, right click, and resizable panes.

### Don't:
- **Don't** make Hapi Power a simple Chat UI; the app is a controllable engineering workbench.
- **Don't** make it a web VS Code clone; code editing is a supporting surface, not the product identity.
- **Don't** make it a command palette collection; each module must show state and recommended action before details.
- **Don't** rely on long press, right click, or hover as the only way to access a required action.
- **Don't** mix modal, side drawer, and page navigation arbitrarily for the same task class.
- **Don't** add page-local dialogs, dropdowns, toasts, context menus, or keyframes without extending the shared component system.
- **Don't** use low-contrast gray text, decorative full-saturation inactive states, thick side stripes, gradient text, glassmorphism, or nested cards.
