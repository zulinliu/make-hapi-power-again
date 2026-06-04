---
phase: login-redesign
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - web/src/styles/login.css
  - web/src/styles/typography.css
  - web/src/components/LoginPrompt.tsx
  - web/src/index.css
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase Login Redesign: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the login page redesign comprising a new CSS stylesheet (`login.css`), modified typography (`typography.css`), a rewritten component (`LoginPrompt.tsx`), and an updated import in `index.css`. The implementation is well-structured overall with good use of CSS custom properties, responsive breakpoints, and reduced-motion support. However, several issues were found including a hardcoded placeholder URL that will break in production, dead CSS rules, missing accessibility attributes, and specificity concerns from excessive `!important` usage.

## Critical Issues

### CR-01: Hardcoded placeholder URL `YOUR_DOMAIN` in help link

**File:** `web/src/components/LoginPrompt.tsx:179`
**Issue:** The help link points to `https://YOUR_DOMAIN/docs`, which is a placeholder that was never replaced with an actual domain. This will navigate users to a broken URL in production. This is a user-facing link that appears on every login screen.
**Fix:**
```tsx
// Replace with actual domain or make configurable
<a
    href="https://test.liuzl.asia/docs"  // or use env var / config
    target="_blank"
    rel="noopener noreferrer"
    className="login-link"
>
    {t('login.help')}
</a>
```

## Warnings

### WR-01: Dead CSS rule `.login-dialog-overlay` never applied

**File:** `web/src/styles/login.css:285-288`
**Issue:** The `.login-dialog-overlay` class is defined but never used in any component. The Dialog component (`dialog.tsx`) renders its overlay via `DialogPrimitive.Overlay` with inline Tailwind classes (`bg-black/60 backdrop-blur-[2px]`). This CSS rule has no effect and creates a false expectation that the dialog overlay is themed.
**Fix:** Remove the unused `.login-dialog-overlay` rule, or apply the class to the Dialog overlay by customizing the Dialog component to accept an overlay className prop.

### WR-02: Excessive `!important` on dialog content overrides

**File:** `web/src/styles/login.css:291-296`
**Issue:** Six `!important` declarations are used on `.login-dialog-content` to override the base Dialog component styles. This creates a specificity war that makes future maintenance fragile. If the Dialog component changes its class structure, these overrides silently break.
**Fix:** Either customize the base Dialog component to accept theme variants, or use a more specific selector without `!important`:
```css
/* Instead of !important, use higher specificity */
.login-form-panel .login-dialog-content {
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.12);
  max-width: 420px;
  color: var(--lp-text-primary);
}
```

### WR-03: Missing `htmlFor` on server dialog label

**File:** `web/src/components/LoginPrompt.tsx:204`
**Issue:** The server dialog form has a `<label className="login-label">` without an `htmlFor` attribute, and the corresponding `<input>` at line 206 has no `id`. This breaks the label-input association, reducing accessibility (screen readers cannot announce the purpose of the field) and preventing click-to-focus on the label.
**Fix:**
```tsx
<label className="login-label" htmlFor="login-server-input">
    {t('login.server.origin')}
</label>
<input
    id="login-server-input"
    type="url"
    value={serverInput}
    // ...
/>
```

### WR-04: Font URLs may be unstable / single-source dependency

**File:** `web/src/styles/typography.css:29,37`
**Issue:** The `@font-face` URLs for Source Serif 4 and DM Sans point to specific Google Fonts CDN paths. These URLs use abbreviated gstatic paths that are not guaranteed to remain stable long-term. The existing Inter and JetBrains Mono URLs follow the same pattern (pre-existing issue), but the two new fonts add to this risk. If any font file is relocated, the login page will render with fallback fonts and the visual design degrades silently.
**Fix:** Consider self-hosting the font files or using the Google Fonts CSS API (fonts.googleapis.com/css) which handles URL stability. Alternatively, verify these URLs are actively monitored.

### WR-05: `labelKey` variable naming is misleading

**File:** `web/src/components/LoginPrompt.tsx:112`
**Issue:** The variable `labelKey` holds the resolved translation string (not a key), and its value is either the bind title (`t('login.bind.title')`) or the placeholder text (`t('login.placeholder')`). The name suggests it is a translation key (like `'login.placeholder'`), but it is actually the rendered label text. Additionally, using the placeholder translation as the input label is semantically odd -- in bind mode the label says "Bind Telegram" while the placeholder says "Access token", creating a mismatch between label and input purpose.
**Fix:** Rename to `inputLabel` and consider using a dedicated translation key for the label text:
```tsx
const inputLabel = isBindMode ? t('login.bind.label') : t('login.label')
```

## Info

### IN-01: Redundant `new Date().getFullYear()` in JSX renders on every call

**File:** `web/src/components/LoginPrompt.tsx:245`
**Issue:** `new Date().getFullYear()` is called during render. While functionally correct, it creates a new Date object on each render. Since the year is extremely unlikely to change during a user session, this could be a constant. Minor concern.
**Fix:** Extract to a module-level constant: `const CURRENT_YEAR = new Date().getFullYear()`.

### IN-02: `login-dialog-overlay` and `login-dialog-content` overlap with base Dialog styles

**File:** `web/src/styles/login.css:285-297`
**Issue:** The `.login-dialog-content` class overrides `max-width` (set to `420px` via CSS), but the DialogTrigger renders `DialogContent` with `className="login-dialog-content max-w-md"`. Tailwind's `max-w-md` (28rem = 448px) conflicts with the CSS `max-width: 420px !important`. This is confusing -- one wins via `!important` but the intent is ambiguous.
**Fix:** Remove the Tailwind `max-w-md` class from the DialogContent and rely solely on the CSS custom property or vice versa:
```tsx
{/* Remove max-w-md since login.css handles max-width */}
<DialogContent className="login-dialog-content">
```

### IN-03: `login.css` comment says "Inter (UI)" but DM Sans is now the primary sans font

**File:** `web/src/styles/typography.css:2`
**Issue:** The file header comment reads "Inter (UI) + JetBrains Mono (Code)" but the font stack has been updated to `'DM Sans', 'Inter', ...` with DM Sans as the primary. The comment is stale and could mislead future contributors.
**Fix:** Update the comment to reflect current fonts: `DM Sans (UI) + JetBrains Mono (Code) + Source Serif 4 (Display)`.

### IN-04: SVG noise texture in `::before` pseudo-element may not render in all browsers

**File:** `web/src/styles/login.css:71-77`
**Issue:** The `::before` pseudo-element uses a data URI with an SVG filter (`feTurbulence`). While this works in modern browsers, the SVG filter embedded as a data URI can fail in some mobile WebViews or older Safari versions. The visual impact is minimal (just a subtle noise texture), so this is low risk.
**Fix:** No action required if the target browser matrix is modern. Consider adding a fallback solid color for unsupported cases.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
