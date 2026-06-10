# Frontend Architecture

The frontend is organized as a product workbench, not independent screens. Shared architecture lives under `web/src/components/ui` and `web/src/components/layout`, while pages and routes provide data and intent.

## Layers

1. **Runtime context**
   - `AdaptiveProvider` computes window class, input mode, shell mode, safe area, keyboard state, and density.
2. **Shell**
   - `WorkbenchShell`, `SessionWorkspace`, `PageScaffold`, `ModulePage`, and `InspectorPane` define structure.
3. **Primitives**
   - Buttons, inputs, selects, tabs, segmented controls, toolbars, command bars, cards, banners, empty states.
4. **Overlays**
   - `OverlaySurface` maps semantic overlay intent to desktop and compact behavior.
5. **Feature pages**
   - Chat, Files, Git, Terminal, Loom, Extensions, Settings, New Session, Login.

## Ownership Rules

- Routes select data and compose surfaces; they should not define application shell behavior.
- Feature components can own domain state, but not design-system primitives.
- New page-level CSS requires a documented exception.
- All public UI text must use the i18n system.

## Migration Order

1. Settings, New Session, Login.
2. Session Header, Chat, Composer, Context Pulse, Guide Beam.
3. Files, File viewer/editor, Terminal.
4. Git Atlas, Session Loom, Extensions.
5. README, logo, PWA icons, screenshots, release assets.
