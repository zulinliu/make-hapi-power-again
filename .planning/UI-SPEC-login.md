# UI-SPEC: Login Page Redesign

> Phase: Login Page Redesign | Status: DRAFT | Date: 2026-06-03

## 1. Design Direction

### Concept: "Warm Terminal"

Inspired by Claude/Anthropic's design language — warm ivory backgrounds, terracotta clay accents, serif+sans typographic pairing — fused with the "Hapi Power" identity of a developer tool. The result: a login page that feels like opening a beautifully crafted notebook, not filling out a generic web form.

**Key shift from current:**
- Cold grays → Warm ivory/clay palette
- Generic Inter-only → Serif headline + Sans body
- Flat centered card → Atmospheric split layout with visual depth
- No brand personality → Strong, distinctive visual identity

### Aesthetic Anchor Words
Warm. Textured. Refined. Editorial. Crafted.

---

## 2. Color System

### Light Theme (Default)

| Token | Value | Usage |
|---|---|---|
| `--lp-bg` | `#faf9f5` | Page background (warm ivory) |
| `--lp-surface` | `#ffffff` | Card/form surface |
| `--lp-surface-elevated` | `#f5f4ed` | Hover/active backgrounds |
| `--lp-border` | `#e8e6dc` | Input borders, dividers |
| `--lp-border-focus` | `#d1cfc5` | Input focus border |
| `--lp-text-primary` | `#141413` | Main text |
| `--lp-text-secondary` | `#5e5d59` | Subtitle, labels |
| `--lp-text-tertiary` | `#87867f` | Placeholder, hints |
| `--lp-accent` | `#d97757` | Brand clay (buttons, links, icons) |
| `--lp-accent-hover` | `#c96442` | Button hover state |
| `--lp-accent-subtle` | `#f0e6df` | Accent tint background |
| `--lp-error` | `#b53333` | Error text |
| `--lp-error-bg` | `#fdf2f2` | Error background |

### Dark Theme

| Token | Value | Usage |
|---|---|---|
| `--lp-bg` | `#1a1918` | Page background (warm dark) |
| `--lp-surface` | `#262624` | Card/form surface |
| `--lp-surface-elevated` | `#2e2d2b` | Hover/active backgrounds |
| `--lp-border` | `#3d3d3a` | Input borders, dividers |
| `--lp-border-focus` | `#5e5d59` | Input focus border |
| `--lp-text-primary` | `#f5f4ed` | Main text |
| `--lp-text-secondary` | `#b0aea5` | Subtitle, labels |
| `--lp-text-tertiary` | `#87867f` | Placeholder, hints |
| `--lp-accent` | `#d97757` | Brand clay |
| `--lp-accent-hover` | `#e08868` | Button hover (lighter in dark mode) |
| `--lp-accent-subtle` | `rgba(217, 119, 87, 0.12)` | Accent tint background |
| `--lp-error` | `#f85149` | Error text |
| `--lp-error-bg` | `rgba(248, 81, 73, 0.08)` | Error background |

---

## 3. Typography

### Font Stack

| Role | Font | Source |
|---|---|---|
| **Display** (brand name) | `"Source Serif 4", Georgia, serif` | Google Fonts, variable weight |
| **UI** (body, labels, buttons) | `"DM Sans", "Helvetica Neue", sans-serif` | Google Fonts, variable weight |
| **Mono** (token hints) | `"JetBrains Mono", monospace` | Existing project font |

> **Rationale**: Source Serif 4 brings editorial gravitas to the brand headline (like Anthropic Serif does for Claude). DM Sans is geometric, clean, and distinctive — a deliberate departure from the overused Inter.

### Type Scale

| Element | Font | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Brand name | Source Serif 4 | `clamp(2rem, 1.6rem + 2vw, 2.75rem)` | 600 | `-0.02em` |
| Tagline | DM Sans | `clamp(0.875rem, 0.8rem + 0.3vw, 1rem)` | 400 | `0.01em` |
| Section label | DM Sans | `0.6875rem` (11px) | 600 | `0.08em` uppercase |
| Input text | DM Sans | `0.9375rem` (15px) | 400 | normal |
| Placeholder | DM Sans | `0.9375rem` | 400 | normal |
| Button label | DM Sans | `0.9375rem` | 600 | `0.01em` |
| Error text | DM Sans | `0.8125rem` (13px) | 500 | normal |
| Footer text | DM Sans | `0.75rem` (12px) | 400 | normal |
| Link text | DM Sans | `0.75rem` | 500 | `0.005em` |

---

## 4. Layout

### Desktop (>= 768px)

Split-screen layout:

```
┌─────────────────────────────────────────────────────────┐
│                    Full Viewport                         │
│  ┌──────────────────────┬────────────────────────────┐  │
│  │                      │                            │  │
│  │    LEFT PANEL        │     RIGHT PANEL            │  │
│  │    (brand/visual)    │     (form)                 │  │
│  │                      │                            │  │
│  │   45% width          │     55% width              │  │
│  │   bg: accent gradient│     bg: --lp-bg            │  │
│  │                      │                            │  │
│  │   [Brand Name]       │     [Section Label]        │  │
│  │   [Tagline]          │     [Input: Access Token]  │  │
│  │                      │     [Submit Button]        │  │
│  │   [Decorative        │     [Help] [Hub Config]    │  │
│  │    geometric          │                            │  │
│  │    pattern/          │                            │  │
│  │    ASCII art]        │     [Language Switcher]     │  │
│  │                      │                            │  │
│  └──────────────────────┴────────────────────────────┘  │
│                  [Footer centered]                       │
└─────────────────────────────────────────────────────────┘
```

### Mobile (< 768px)

Single column, left panel collapses to top decorative banner:

```
┌──────────────────────┐
│    Top Banner         │  height: 30vh
│    (accent gradient)  │  with brand name + tagline
│    [Brand Name]       │  overlaid
│    [Tagline]          │
├──────────────────────┤
│                       │  height: 70vh
│  [Section Label]      │
│  [Input]              │
│  [Button]             │
│  [Links]              │
│                       │
│  [Footer]             │
└──────────────────────┘
```

### Zoning Rules

- Left panel: decorative only, no interactive elements
- Right panel: all interactive elements (form, links, language)
- Footer: absolute bottom, spans full width, z-index above panels
- Language switcher: top-right corner of right panel (desktop) / top-right of viewport (mobile)

---

## 5. Visual Design Details

### 5.1 Left Panel — Brand Visual

**Background**: A warm gradient with subtle geometric texture.

```
Background layers (bottom to top):
1. Base: linear-gradient(135deg, #d97757 0%, #c96442 40%, #b85540 100%)
2. Noise texture: SVG noise filter, 3% opacity, warm tone
3. Geometric pattern: Subtle grid of thin lines at 45deg, 4% opacity
4. Radial glow: radial-gradient at 30% 70%, rgba(255,255,255,0.08), transparent 60%
```

**Brand name** (Source Serif 4):
- Color: `#ffffff`
- Position: vertically centered, left-aligned with generous padding (48px from left edge)
- Text shadow: `0 1px 3px rgba(0,0,0,0.1)`

**Tagline**:
- Color: `rgba(255,255,255,0.85)`
- Position: directly below brand name, 8px gap

**Decorative element**: A subtle ASCII-art style terminal prompt at the bottom-left:
```
> hapi-power --login
  connecting...
  █
```
- Font: JetBrains Mono, 13px
- Color: `rgba(255,255,255,0.25)`
- Blinking cursor animation (CSS `@keyframes blink`)

### 5.2 Right Panel — Form Area

**Background**: `--lp-bg` (warm ivory / warm dark)

**Content container**:
- Max width: `400px`
- Centered vertically and horizontally within the right panel
- Padding: `48px` horizontal

**Section label** above input:
- Text: "ACCESS TOKEN" (uppercase, tracked)
- Color: `--lp-text-tertiary`
- Margin-bottom: `8px`

### 5.3 Input Field

```
height: 48px
background: --lp-surface
border: 1px solid --lp-border
border-radius: 8px
padding: 0 16px
font: DM Sans, 15px, weight 400
color: --lp-text-primary
placeholder-color: --lp-text-tertiary
```

**States:**

| State | Border | Background | Shadow |
|---|---|---|---|
| Default | `--lp-border` | `--lp-surface` | none |
| Hover | `--lp-border-focus` | `--lp-surface` | none |
| Focus | `--lp-accent` | `--lp-surface` | `0 0 0 3px --lp-accent-subtle` |
| Error | `--lp-error` | `--lp-error-bg` | none |
| Disabled | `--lp-border` | `--lp-surface` at 50% opacity | none |

**Transition**: `border-color 150ms ease-out, box-shadow 150ms ease-out`

### 5.4 Submit Button

```
height: 48px
background: --lp-accent
color: #ffffff
border: none
border-radius: 8px
font: DM Sans, 15px, weight 600
cursor: pointer
transition: all 150ms ease-out
```

**States:**

| State | Background | Transform | Shadow |
|---|---|---|---|
| Default | `--lp-accent` | none | none |
| Hover | `--lp-accent-hover` | none | `0 2px 8px rgba(217,119,87,0.25)` |
| Active | `--lp-accent-hover` | `translateY(1px)` | none |
| Disabled | `--lp-accent` at 40% opacity | none | none |
| Loading | `--lp-accent-hover` | none | none |

**Loading state**: Show spinner (existing `Spinner` component, white color) + text.

### 5.5 Error Message

```
color: --lp-error
font-size: 13px
font-weight: 500
margin-top: 12px
padding: 10px 14px
background: --lp-error-bg
border-radius: 6px
border-left: 3px solid --lp-error
```

### 5.6 Help Links Row

Horizontal row below the button, separated by `24px` spacing:

```
display: flex
align-items: center
justify-content: space-between
margin-top: 24px
font-size: 12px
color: --lp-text-tertiary
```

- "Needs help?" → underlined link, hover color: `--lp-accent`
- "Hub (Default/Custom)" → underlined button, opens Dialog, hover color: `--lp-accent`

### 5.7 Language Switcher

Top-right corner of the form area (desktop) / viewport (mobile).

```
position: absolute
top: 24px
right: 24px

button {
  background: --lp-surface-elevated
  border: 1px solid --lp-border
  border-radius: 6px
  padding: 6px 12px
  font-size: 12px
  color: --lp-text-secondary
  transition: all 150ms ease-out
}

button:hover {
  border-color: --lp-border-focus
  color: --lp-text-primary
}
```

### 5.8 Footer

```
position: absolute
bottom: 20px
left: 0
right: 0
text-align: center
font-size: 12px
color: --lp-text-tertiary
```

Text: "Designed with ♥ for Vibe Coding | © 2026 Hapi Power"

The heart icon (♥) in `--lp-accent` color.

---

## 6. Hub URL Dialog (Modal)

Follows Claude/Anthropic dialog conventions:

```
Dialog overlay: background rgba(0,0,0,0.4), backdrop-filter: blur(4px)

Dialog container:
  background: --lp-surface
  border-radius: 12px
  border: 1px solid --lp-border
  box-shadow: 0 16px 48px rgba(0,0,0,0.12)
  max-width: 420px
  padding: 24px

Dialog title:
  font: Source Serif 4, 20px, weight 600
  color: --lp-text-primary

Dialog description:
  font: DM Sans, 14px
  color: --lp-text-secondary
  margin-top: 4px

Input: same spec as login input

Buttons:
  Primary: accent button (same as submit)
  Secondary: --lp-surface-elevated background, --lp-text-secondary text, 1px --lp-border
```

---

## 7. Animations & Motion

### Page Load Sequence (staggered reveal)

```
Timeline:
0ms    → Page renders, left panel visible with gradient
200ms  → Brand name fades in + slides up (opacity 0→1, translateY 12px→0, 400ms ease-out)
400ms  → Tagline fades in (opacity 0→1, 300ms ease-out)
500ms  → Section label fades in (opacity 0→1, 200ms ease-out)
600ms  → Input field fades in + slides up (opacity 0→1, translateY 8px→0, 300ms ease-out)
750ms  → Button fades in (opacity 0→1, 200ms ease-out)
900ms  → Help links + footer fade in (opacity 0→1, 300ms ease-out)
```

### Micro-interactions

| Element | Trigger | Animation | Duration |
|---|---|---|---|
| Input border | Focus | Border color transition + ring appear | 150ms ease-out |
| Button | Hover | Background shift + shadow appear | 150ms ease-out |
| Button | Active | translateY(1px) press effect | 80ms |
| Error | Appear | Fade in + slide down | 200ms ease-out |
| Cursor (left panel) | Always | Blink animation (1s infinite) | 1000ms step-end |
| Links | Hover | Color transition | 150ms ease-out |

### Theme Transition

When toggling light/dark theme:
```css
.login-page {
  transition: background-color 300ms ease-out, color 300ms ease-out;
}
```

---

## 8. Responsive Breakpoints

| Breakpoint | Layout | Left Panel | Right Panel | Font Scale |
|---|---|---|---|---|
| >= 1024px | Side-by-side (45/55) | Full visual | Centered form | 100% |
| 768-1023px | Side-by-side (40/60) | Condensed | Centered form | 95% |
| < 768px | Stacked | Top banner 30vh | Bottom form 70vh | 100% |
| < 400px | Stacked | Top banner 25vh | Bottom form 75vh | 95% |

### Mobile-specific adaptations

- Brand name size scales down via `clamp()`
- Left panel decorative terminal prompt hidden on mobile
- Input font-size forced to 16px minimum (prevent iOS zoom)
- Button full width always
- Footer text hidden on < 400px viewport

---

## 9. Bind Mode Variations

When `mode="bind"`:

- Left panel gradient shifts slightly cooler: add a hint of `#629987` (mineral green) to the gradient
- Section label changes to: "BIND TELEGRAM"
- Title text on left panel stays "Hapi Power"
- All interactive specs remain identical
- Help links row is hidden (bind mode has no docs/hub links)

---

## 10. Accessibility

| Requirement | Implementation |
|---|---|
| Color contrast | All text meets WCAG AA (4.5:1 for normal, 3:1 for large) |
| Focus visible | 3px ring with `--lp-accent-subtle` color on all interactive elements |
| Keyboard nav | Tab order: Language → Input → Button → Help link → Hub link |
| Screen reader | `aria-label` on form, `aria-busy` on button during loading |
| Error announcement | `role="alert"` on error container |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` — disable all animations |
| Touch targets | Minimum 44x44px on all interactive elements (button is 48px height) |

---

## 11. Technical Constraints

### Must Preserve (No Changes)

- All props interface (`LoginPromptProps`)
- `handleSubmit` logic (token validation, API calls, error handling)
- `handleSaveServer` / `handleClearServer` logic
- Hub URL Dialog functionality
- Language switcher functionality
- All i18n keys (same translation keys, same content)
- Authentication API integration (`ApiClient.authenticate`, `ApiClient.bind`)
- Loading/error state management
- Telegram Mini App compatibility

### Must Introduce

- Two new Google Fonts: Source Serif 4, DM Sans (loaded via `<link>` or `@font-face`)
- New CSS custom properties under `--lp-*` namespace (login-page specific)
- Entry animation CSS (staggered reveal)
- Split layout CSS (flexbox-based responsive)

### Must NOT Introduce

- New JavaScript dependencies (animation done with CSS only)
- Changes to API client, auth hooks, or server-side code
- Changes to any other page/route

---

## 12. Visual Reference

### ASCII Mockup — Desktop Light Theme

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ┌─────────────────────┐  ┌──────────────────────────────┐  ║
║  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │                    [EN/中文] │  ║
║  │ ▓▓  warm gradient ▓ │  │                              │  ║
║  │ ▓▓   with subtle  ▓ │  │    ACCESS TOKEN              │  ║
║  │ ▓▓   clay texture ▓ │  │  ┌────────────────────────┐  │  ║
║  │ ▓▓                 ▓ │  │  │ ••••••••••••••••••••  │  │  ║
║  │ ▓▓                 ▓ │  │  └────────────────────────┘  │  ║
║  │ ▓▓  Hapi Power     ▓ │  │                              │  ║
║  │ ▓▓  ─────────────  ▓ │  │  ┌────────────────────────┐  │  ║
║  │ ▓▓  Vibe Coding    ▓ │  │  │       Sign In          │  │  ║
║  │ ▓▓  Anytime,       ▓ │  │  └────────────────────────┘  │  ║
║  │ ▓▓  Anywhere       ▓ │  │                              │  ║
║  │ ▓▓                 ▓ │  │  Needs help?  Hub (Default)  │  ║
║  │ ▓▓                 ▓ │  │                              │  ║
║  │ ▓▓  > hapi --login▓ │  │                              │  ║
║  │ ▓▓    connecting..▓ │  │                              │  ║
║  │ ▓▓    █            ▓ │  │                              │  ║
║  └─────────────────────┘  └──────────────────────────────┘  ║
║                                                              ║
║       Designed with ♥ for Vibe Coding · © 2026 Hapi Power   ║
╚══════════════════════════════════════════════════════════════╝
```

### ASCII Mockup — Mobile Light Theme

```
╔══════════════════════╗
║                      ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
║  ▓▓ warm gradient ▓  ║   [EN/中文]
║  ▓▓               ▓  ║
║  ▓▓ Hapi Power    ▓  ║
║  ▓▓ Vibe Coding   ▓  ║
║  ▓▓ Anytime,      ▓  ║
║  ▓▓ Anywhere      ▓  ║
║                      ║
║  ──────────────────  ║
║                      ║
║  ACCESS TOKEN        ║
║  ┌────────────────┐  ║
║  │ •••••••••••••  │  ║
║  └────────────────┘  ║
║                      ║
║  ┌────────────────┐  ║
║  │    Sign In     │  ║
║  └────────────────┘  ║
║                      ║
║  Needs help? Hub(↗)  ║
║                      ║
║  ♥ Vibe Coding ©'26  ║
╚══════════════════════╝
```

---

## 13. Component Structure (Implementation Reference)

```
LoginPrompt.tsx
├── <div class="login-page">                 // Full viewport, flex container
│   ├── <div class="login-brand-panel">      // Left/top: gradient + brand
│   │   ├── <h1 class="login-brand-name">    // "Hapi Power" in Source Serif 4
│   │   ├── <p class="login-tagline">        // Tagline in DM Sans
│   │   └── <div class="login-terminal">     // Decorative ASCII terminal
│   ├── <div class="login-form-panel">       // Right/bottom: form area
│   │   ├── <LanguageSwitcher />             // Top-right corner
│   │   ├── <form class="login-form">
│   │   │   ├── <label class="login-label">  // "ACCESS TOKEN"
│   │   │   ├── <input class="login-input">
│   │   │   ├── <div class="login-error">    // Error (conditional)
│   │   │   └── <button class="login-btn">   // Submit
│   │   └── <div class="login-links">        // Help + Hub config
│   └── <footer class="login-footer">        // Copyright
```

### New CSS File

A new `web/src/styles/login.css` file will contain all login-page-specific styles using `--lp-*` tokens. This keeps login styles isolated from the global theme system.

### Font Loading

Add to `web/src/styles/typography.css`:

```css
@font-face {
  font-family: 'Source Serif 4';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/sourceserif4/v8EFw8TUnJCRWJ7q6GMWLEdXj.woff2') format('woff2');
}

@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/dmsans/v15/rP2YtY9yV00s8NghHVQ.woff2') format('woff2');
}
```

---

## 14. Quality Checklist

- [ ] Light theme: all elements visible and readable
- [ ] Dark theme: all elements visible and readable
- [ ] Mobile (< 768px): layout stacks correctly
- [ ] Small mobile (< 400px): content not clipped
- [ ] Login flow works end-to-end (token input → submit → authenticated)
- [ ] Bind mode works correctly (gradient shifts, label changes, links hidden)
- [ ] Hub URL Dialog opens and functions
- [ ] Language switcher works (EN ↔ 中文)
- [ ] Error states display correctly
- [ ] Loading state shows spinner + disabled button
- [ ] Entry animations play on mount
- [ ] `prefers-reduced-motion` disables animations
- [ ] Keyboard navigation works (Tab order correct)
- [ ] Focus rings visible on all interactive elements
- [ ] No iOS zoom on input focus (16px minimum font)
- [ ] Telegram Mini App renders correctly
- [ ] Lighthouse accessibility score >= 95
- [ ] No console errors or warnings
