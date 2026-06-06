---
phase: 32-file-management-crud
reviewed: 2026-06-06T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - web/src/components/FileManager/FileManager.tsx
  - web/src/components/FileManager/DirectoryView.tsx
  - web/src/components/FileManager/BatchActionBar.tsx
  - web/src/components/FileManager/types.ts
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 32: Code Review Report -- FileManager Module (Re-review)

**Reviewed:** 2026-06-06T12:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Re-reviewed the FileManager module with focus on React hooks correctness, event handling bugs, state management issues, TypeScript type safety, and edge cases. Found 4 critical bugs and 5 warnings. The critical issues are: batch delete is completely non-functional due to passing a display string instead of a filename to `mockDelete`; shift-click range select operates on unsorted `entries` instead of the visually sorted list; dialog submit early-returns silently on empty input with no user feedback; and `selectedPaths` survives directory navigation, causing stale phantom selections.

---

## Critical Issues

### CR-01: Batch delete is non-functional -- passes display label instead of filename

**File:** `web/src/components/FileManager/FileManager.tsx:196-200`
**Issue:** `handleBatchDelete` constructs the delete dialog as:
```tsx
const names = [...selectedPaths].map((p) => p.split('/').pop()).join(', ')
setDialog({ type: 'delete', name: `${selectedPaths.size} items: ${names}`, path: '' })
```
When submitted, `handleDialogSubmit` case `'delete'` (line 174-178) calls:
```tsx
await mockDelete(currentPath, dialog.name)
```
Here `dialog.name` is `"3 items: file1.ts, file2.ts, file3.ts"` -- a human-readable display string, not a valid filename. `mockDelete` does `entries.findIndex((e) => e.name === name)` which will never match, so it always throws `"not found"`. Additionally, `dialog.path` is `''`, so the cleanup `n.delete(dialog.path)` on line 176 is a no-op that tries to delete the empty string from the set. The entire batch delete feature is broken end-to-end.

**Fix:**
```tsx
const handleBatchDelete = useCallback(() => {
  if (selectedPaths.size === 0) return
  // Store the actual paths for batch deletion
  const pathsToDelete = [...selectedPaths]
  setDialog({ type: 'delete' as const, name: `${pathsToDelete.length} item${pathsToDelete.length > 1 ? 's' : ''}`, path: '__batch__' })
  // Store pathsToDelete in a ref or pass through dialog state
}, [selectedPaths])
```
Then in `handleDialogSubmit`, detect batch mode and iterate:
```tsx
case 'delete': {
  if (dialog.path === '__batch__') {
    for (const p of batchDeletePaths.current) {
      const name = p.split('/')!.pop()!
      await mockDelete(currentPath, name)
    }
    setSelectedPaths(new Set())
  } else {
    await mockDelete(currentPath, dialog.name)
    setSelectedPaths((prev) => { const n = new Set(prev); n.delete(dialog.path); return n })
  }
  showToast('Deleted')
  break
}
```

### CR-02: Shift-click range select operates on unsorted entries -- wrong file order

**File:** `web/src/components/FileManager/FileManager.tsx:120-139`
**Issue:** `handleToggleSelect` captures `entries` from its closure (line 125: `const paths = entries.map((e) => e.path)`). However, `entries` is the raw unsorted array. The `DirectoryView` component renders files in a `sorted` order produced by its `useMemo` (DirectoryView.tsx:274-287). When the sort is anything other than `name asc` (e.g., `size desc` or `modified desc`), the visual order of files differs from `entries` order. A shift-click from one visible file to another selects a range based on the raw `entries` ordering, which does not match what the user sees on screen.

**Fix:** Pass the sorted path list to the toggle handler so range selection matches visual order:
```tsx
// In DirectoryView, compute sorted paths
const sortedPaths = useMemo(() => sorted.map((e) => e.path), [sorted])

// Pass to FileRow, and FileRow calls onToggleSelect with sortedPaths
// so the range computation uses the visible order
```

### CR-03: Dialog submit silently returns on empty input with no feedback

**File:** `web/src/components/FileManager/FileManager.tsx:155-156`
**Issue:** In `handleDialogSubmit`, the `newFile` and `newFolder` cases:
```tsx
case 'newFile': {
  if (!inputValue.trim()) return
```
This early return exits the `try` block, the `finally` resets `dialogLoading`, but the dialog remains open and no error message is shown. The user sees no feedback -- the dialog just sits there with an empty input field, which appears broken. Similarly, the `rename` case on line 169 calls `setDialog(null); setDialogLoading(false); return` where `setDialogLoading(false)` is redundant with the `finally` block, indicating confused control flow.

**Fix:**
```tsx
case 'newFile':
case 'newFolder': {
  if (!inputValue.trim()) {
    showToast('Name is required', 'error')
    return
  }
  // ...
}
case 'rename': {
  if (!inputValue.trim()) {
    showToast('Name is required', 'error')
    return  // finally handles dialogLoading
  }
  if (inputValue.trim() === dialog.name) {
    setDialog(null)
    return  // finally handles dialogLoading
  }
  // ...
}
```

### CR-04: selectedPaths persists across directory navigation -- phantom selections

**File:** `web/src/components/FileManager/FileManager.tsx:45-59`
**Issue:** When `loadDirectory` is called to navigate to a new directory, it clears `selectedPath` (line 48) but does NOT clear `selectedPaths`. After navigating to a new directory, paths from the previous directory remain in the `Set`. The `BatchActionBar` continues to show a non-zero count based on stale data. If the user presses Delete in the new directory, `handleBatchDelete` runs with the old paths. Since `mockDelete` searches by name in the current directory's entries, it might accidentally delete files in the new directory that happen to share filenames with the old selections, or throw errors for non-existent names.

**Fix:**
```tsx
const loadDirectory = useCallback(async (path: string, hidden: boolean) => {
  setIsLoading(true)
  setError(null)
  setSelectedPath(null)
  setSelectedPaths(new Set())  // Clear batch selection on navigation
  // ...
}, [])
```

---

## Warnings

### WR-01: breadcrumbs not memoized -- keyboard handler re-registers on every render

**File:** `web/src/components/FileManager/FileManager.tsx:79`
**Issue:** `buildBreadcrumbs` is called in the render body without `useMemo`:
```tsx
const breadcrumbs: BreadcrumbSegment[] = buildBreadcrumbs(currentPath, 'project')
```
This creates a new array reference on every render. Since `breadcrumbs` is in the keyboard `useEffect` dependency array (line 248), the event listener is removed and re-added on every render. This causes a brief window where keyboard shortcuts are unregistered, and the constant listener churn is wasteful.

**Fix:**
```tsx
const breadcrumbs = useMemo(() => buildBreadcrumbs(currentPath, 'project'), [currentPath])
```

### WR-02: handleDialogSubmit early-exit in rename has redundant setDialogLoading(false)

**File:** `web/src/components/FileManager/FileManager.tsx:169`
**Issue:** The rename case does `setDialog(null); setDialogLoading(false); return`. The `finally` block on line 187 also calls `setDialogLoading(false)`. While idempotent, this pattern indicates the developer was unsure about control flow. If someone later changes the `finally` block logic (e.g., adding a condition), the redundant call could cause subtle bugs.

**Fix:** Remove `setDialogLoading(false)` from line 169. Let `finally` handle it unconditionally:
```tsx
case 'rename': {
  if (!inputValue.trim()) { showToast('Name is required', 'error'); return }
  if (inputValue.trim() === dialog.name) { setDialog(null); return }
  // ...
}
```

### WR-03: handleToggleSelect captures entries via closure -- fragile with concurrent React

**File:** `web/src/components/FileManager/FileManager.tsx:139`
**Issue:** `handleToggleSelect` depends on `[entries]` in its dependency array. Each time `entries` changes, a new function instance is created. The `setSelectedPaths` updater function inside it reads `entries` from the closure rather than from a ref. With React 18's automatic batching and potential future concurrent features, the `entries` captured in the closure could be stale if multiple state updates are batched between renders.

**Fix:** Use a ref for entries:
```tsx
const entriesRef = useRef(entries)
entriesRef.current = entries

const handleToggleSelect = useCallback((path: string, shiftKey: boolean, _ctrlKey: boolean) => {
  const currentEntries = entriesRef.current
  setSelectedPaths((prev) => {
    // use currentEntries instead of entries
  })
}, [])  // no dependency on entries
```

### WR-04: onSelect passes raw setState -- accidental correctness via batching

**File:** `web/src/components/FileManager/FileManager.tsx:288`
**Issue:** `onSelect={setSelectedPath}` passes the raw state setter as a prop. In `FileRow.handleClick`, `onSelect(entry.path)` sets the selected path, then immediately `onOpenDirectory(entry.path)` triggers `loadDirectory` which calls `setSelectedPath(null)`. React batches these synchronous calls within the same event handler, so the final state is `null`. This is accidentally correct but fragile -- if `onOpenDirectory` ever becomes async or deferred, the selection flash would become visible.

**Fix:** Wrap in a proper callback:
```tsx
const handleSelect = useCallback((path: string) => {
  setSelectedPath(path)
}, [])
// Pass as: onSelect={handleSelect}
```
Better yet, skip the selection for directory clicks since it is immediately cleared.

### WR-05: Context menu captures path but handleContextMenu missing entries dependency

**File:** `web/src/components/FileManager/FileManager.tsx:93-117`
**Issue:** `handleContextMenu` has `[ctxMenu]` as its only dependency. The inline `onClick` closures it creates for each menu item capture `path` and `name` from the function arguments, which is fine. However, the `setDialog({ type: 'delete', name, path })` on line 112 captures the correct per-item path. This is currently not buggy because context menu items do not read `entries` state. However, the missing dependency annotation will trigger lint warnings and could mislead future developers into adding selection logic to context menu items without realizing the closure is stale.

**Fix:** Add `entries` to the dependency array if it will be needed, or add an eslint-disable comment explaining why it is intentionally omitted.

---

## Info

### IN-01: onMove and onCopy handlers are no-ops

**File:** `web/src/components/FileManager/FileManager.tsx:302-303`
**Issue:** Both `onMove={() => {}}` and `onCopy={() => {}}` in the `BatchActionBar` props are empty functions. These buttons are visible and clickable but do nothing. The context menu has the same on lines 102-103. Presumably intentional for future phases but should be tracked.

**Fix:** Either disable the buttons visually or add a "Coming soon" toast:
```tsx
onMove={() => showToast('Move not yet implemented')}
```

### IN-02: Global mutable styleInjected flag survives unmount -- animations break on remount

**File:** `web/src/components/FileManager/DirectoryView.tsx:254-266`
**Issue:** `styleInjected` is a module-level boolean. If the component unmounts and the framework removes the injected `<style data-fm>` element, `styleInjected` remains `true`, preventing re-injection on the next mount. Animations silently break.

**Fix:** Check DOM instead of using a mutable flag:
```tsx
function useDirectoryStyles() {
  useInsertionEffect(() => {
    if (document.querySelector('style[data-fm]')) return
    const el = document.createElement('style')
    el.setAttribute('data-fm', '')
    el.textContent = STYLESHEET
    document.head.appendChild(el)
  }, [])
}
```

### IN-03: Keyboard handler uses capture phase -- may conflict with child components

**File:** `web/src/components/FileManager/FileManager.tsx:246`
**Issue:** `window.addEventListener('keydown', handler, true)` uses capture phase. This fires before any child component's handlers, including `Dialog`'s Escape handler and `InputField`'s Enter handler. While the `if (dialog) return` guard on line 205 prevents interference when a dialog is open, the capture phase means this handler always runs first. If a child component adds a keydown listener in capture phase (e.g., a rich text editor), there could be ordering conflicts.

**Fix:** Use bubble phase:
```tsx
window.addEventListener('keydown', handler)
return () => window.removeEventListener('keydown', handler)
```

---

_Reviewed: 2026-06-06T12:00:00Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
