# Hapi Power Design System

Hapi Power uses `DESIGN.md` as the source design contract and `web/src/styles/tokens.css` as the runtime token layer. New UI work must consume shared primitives from `web/src/components/ui` before adding page-local styling.

## Token Rules

- `--hp-*` is canonical for product UI.
- `--app-*` is a compatibility alias layer for Telegram theme fallbacks and older assistant surfaces.
- New colors, shadows, motion timings, breakpoints, z-index values, and component states must be added to the shared system before use.
- Product typography uses fixed rem values. Avoid `clamp()` inside application chrome, panels, forms, tables, and controls.

## Component Rules

- Use shared primitives for buttons, icon buttons, inputs, selects, segmented controls, tabs, toolbars, command bars, banners, toasts, cards, dialogs, popovers, sheets, and empty states.
- Every interactive component must define default, hover, focus, active, disabled, loading, selected, error, and reduced-motion behavior where applicable.
- Compact/coarse-pointer UI uses 44px minimum touch targets. Desktop pointer targets must remain at least 24px and have visible focus.

## Overlay Rules

- Dialog: short blocking form or decision.
- Alert dialog: destructive or irreversible confirmation.
- Side panel: desktop inspector or secondary work.
- Bottom sheet: compact selectors and task details.
- Popover: lightweight non-destructive disclosure.
- Context menu: desktop pointer menu. Compact mode must expose visible equivalent actions.
- Toast: transient feedback only. Do not use toast for required decisions.

## Motion Rules

- `80ms`: instant feedback and active press.
- `150ms`: hover, focus, selected, small control transitions.
- `220ms`: overlay and panel entry/exit.
- Motion must communicate state, placement, or feedback. No decorative page-load choreography.
- `prefers-reduced-motion: reduce` must remove travel and keep state visible.

## Prohibited Patterns

- Page-local modal/dropdown/toast/context-menu systems.
- Arbitrary `z-[9999]` or z-index outside the semantic scale.
- Thick colored side stripes, gradient text, glassmorphism, nested cards.
- Required hover-only, right-click-only, or long-press-only actions.
- New user-visible strings without `en` and `zh-CN` parity.
