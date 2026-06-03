---
phase: v9-full
type: review
reviewers: 4 parallel agents
depth: deep
date: 2026-06-03
files_reviewed: 30
---

# v9 Deep Code Review — Consolidated Report

> 4 parallel agents reviewed all 30 source files changed across v9.1–v9.4.

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0     |
| HIGH     | 10    |
| MEDIUM   | 17    |
| INFO     | 10    |

**Verdict: WARNING** — 10 HIGH issues should be addressed before merge.

---

## HIGH Findings (must fix)

### H-01: MarkdownFilePreview renders untrusted content without sanitization (XSS)
- **Files**: `GitFilePreview.tsx:107`, `MarkdownFilePreview.tsx`
- **Risk**: Markdown files from Git repos may contain raw HTML. `react-markdown` allows HTML by default.
- **Fix**: Install `rehype-sanitize` and pass as rehype plugin.

### H-02: Long press + click conflict — context menu and preview both open
- **File**: `GitStatusPanel.tsx:166-168`
- **Risk**: After a long press opens context menu, the subsequent touch-end click also fires `onPreview`. Both panels open simultaneously.
- **Fix**: Add a `justLongPressedRef` in GitFileRow, set true on long press, reset after 400ms. Guard `onClick` with this ref.

### H-03: file.tsx handleSave silently swallows errors
- **File**: `file.tsx:145-157`
- **Risk**: `try/finally` with no `catch`. If `api.writeSessionFile` rejects, user sees no error feedback.
- **Fix**: Add `catch` block with toast or inline error display.

### H-04: GitFilePreview hardcoded English strings — no i18n
- **File**: `GitFilePreview.tsx:68,72,76,79,103,123,157`
- **Strings**: "File has been deleted", "Loading...", "Failed to load file", "Retry", "Binary file, cannot preview", "No content available", "Open in file manager"
- **Fix**: Add locale keys and use `t()`.

### H-05: GitHistory parseLog regex doesn't match standard `git log --oneline`
- **File**: `GitHistory.tsx:74`
- **Risk**: Regex requires line-start with `*|/|\\` but `git log` outputs don't have these. History tab may always show "no commits".
- **Fix**: Make line prefix optional; test with real `git log` output.

### H-06: GitCommitDialog sign checkbox is a no-op
- **File**: `GitCommitDialog.tsx:39,72-76`
- **Risk**: `sign` state collected from UI but never passed to API. User believes they're signing commits.
- **Fix**: Wire `{ sign }` to `createGitCommit` API or remove checkbox until backend supports it.

### H-07: SubPageLayout tabs overflow on small screens
- **File**: `SubPageLayout.tsx:38-69`
- **Risk**: Tab row uses `flex` with `flex-1` per tab but no `overflow-x` handling. 7+ tabs (timeline) on 320px screens cause overflow/compression.
- **Fix**: Add `overflow-x-auto` on tab container, `flex-shrink-0` on tabs, or collapse to dropdown on mobile.

### H-08: pathname.includes() active state detection is fragile
- **File**: `SessionHeader.tsx:135-137`
- **Risk**: `/file` and `/files` both match. Session IDs containing 'git' could false-match.
- **Fix**: Use exact suffix matching: `pathname.slice(basePath.length)` then compare.

### H-09: GitFilePreview handleClose missing useCallback — stale closure risk
- **File**: `GitFilePreview.tsx:36,42-45`
- **Risk**: Escape key useEffect captures initial `handleClose`. If `onClose` changes, stale reference persists.
- **Fix**: Wrap `handleClose` in `useCallback` with `onClose` dependency.

### H-10: extensions.tsx h-full inside scrollable SubPageLayout is ineffective
- **File**: `extensions.tsx:229`
- **Risk**: `h-full` on child of `overflow-y-auto` container doesn't constrain to viewport.
- **Fix**: Remove `h-full` from the wrapper div.

---

## MEDIUM Findings (should fix)

### M-01: GitFileRow missing tabIndex and role for keyboard accessibility
- **File**: `GitStatusPanel.tsx:165-181`
- **Fix**: Add `tabIndex={0}`, `role="button"`, `aria-label={file.path}`.

### M-02: GitFilePreview missing role="dialog" and aria-modal
- **File**: `GitFilePreview.tsx:129`
- **Fix**: Add `role="dialog"`, `aria-modal="true"`, `aria-label="File preview"`.

### M-03: GitFilePreview doesn't trap focus on open
- **File**: `GitFilePreview.tsx:129-163`
- **Fix**: Auto-focus close button when panel opens.

### M-04: isBinaryContent O(n) performance for large files
- **File**: `file-utils.ts:14-22`
- **Fix**: Limit check to first 8192 bytes instead of full content.

### M-05: changes.tsx + timeline.tsx useSession called but session unused
- **Files**: `changes.tsx:90`, `timeline.tsx:125`
- **Fix**: Remove unused `useSession` calls or use the data.

### M-06: Dead code — unused imports and variables
- `undo.tsx:1` — `useCallback` imported but unused
- `terminal.tsx:403` — `subtitle` variable declared but unused
- `file.tsx:14` — `IMAGE_MIME_BY_EXTENSION` imported but unused
- `extensions.tsx:10-16` — `BackIcon` defined but unused

### M-07: changes.tsx + timeline.tsx hardcoded Chinese strings — no i18n
- **Files**: `changes.tsx:57-61`, `timeline.tsx:11-17`
- **Fix**: Replace raw strings with `t()` calls.

### M-08: SessionChat voice useEffect hooks missing cleanup
- **File**: `SessionChat.tsx:239-274`
- **Fix**: Return cleanup functions that unregister stores on unmount.

### M-09: GitBranchManager branch delete has no confirmation
- **File**: `GitBranchManager.tsx:69-79`
- **Fix**: Add ConfirmDialog before destructive delete operation.

### M-10: GitBranchManager branch parser fragile for edge cases
- **File**: `GitBranchManager.tsx:154-162`
- **Fix**: Handle branches with spaces and HEAD-detached lines.

### M-11: SubPageLayout tab indicator fixed 40px width doesn't adjust
- **File**: `SubPageLayout.tsx:61`
- **Fix**: Use percentage width or scale with tab width.

### M-12: SessionHeader border-b causes 1px layout shift between views
- **File**: `SessionHeader.tsx:176`
- **Fix**: Use `box-shadow` instead of conditional `border-b`, or always render border with transparent color.

### M-13: Git page toolbar 5 buttons may overflow on 320px
- **File**: `git.tsx:138-172`
- **Fix**: Add `overflow-x-auto` or flex-wrap on toolbar.

### M-14: Dual CSS token system (--hp-* vs --app-*)
- **Files**: `tokens.css`, `typography.css` vs component files
- **Fix**: Consolidate or have --app-* reference --hp-* tokens.

### M-15: SessionList exceeds 800 lines (991 lines)
- **File**: `SessionList.tsx`
- **Fix**: Extract SessionItem and icon components to separate files.

### M-16: GitCommitDialog amend locale key defined but unused
- **Files**: `en.ts:625`, `zh-CN.ts`
- **Fix**: Remove dead key or implement amend feature.

### M-17: files.tsx approaching 800-line limit (743 lines)
- **File**: `files.tsx`
- **Fix**: Extract sub-components (StatusBadge, GitFileRow, etc.).

---

## INFO Findings (nice to have)

1. `router.tsx` at 850 lines — slightly over limit
2. `SessionChat` has 5x `console.error` in catch blocks
3. `SessionActionMenu` desktop detection may flash on SSR
4. `GitStatusBadge` missing 'C' (copied) status color
5. `resolveLanguage` returns filename for dotless files (e.g., Makefile)
6. No query cache cleanup for binary base64 in GitFilePreview
7. `ContextMenu` uses array index as key (safe for static items)
8. No unit tests for `file-utils.ts`
9. Duplicate `resolveLanguage` in CodeEditor, DiffView, GitFilePreview
10. `GitHistory` `t` in useCallback deps causes extra fetch

---

## Positive Notes

- `--hp-*` to `--app-*` migration thorough — no residual `--hp-*` in components
- SubPageLayout has correct ARIA roles (`tablist`, `tab`, `tabpanel`)
- SessionActionMenu has full pointerdown/keydown/resize/scroll cleanup
- Route params typed correctly via TanStack Router `useParams`
- SessionHeader toggle navigation (click active icon to return) is intuitive UX
- Locale keys fully symmetric between en.ts and zh-CN.ts
- No hardcoded secrets or credentials in source
- No path traversal risk in file-utils.ts
