# ROADMAP: File Manager Module

**Created:** 2026-06-06
**Mode:** Standard granularity, parallel execution, YOLO mode
**Design Spec:** docs/design/FILE-MANAGER-DESIGN.md

---

## Overview

Full-featured global file manager replacing the existing `/browse` page. Mobile-first (iOS), desktop split-pane layout. Frontend-first with mock API, backend follows.

---

### Phase 1: Foundation — File Browser Shell

**Goal:** Replace `/browse` page with the new file manager shell. Users can browse directories, see files, navigate with breadcrumbs, and toggle hidden files.

**Success Criteria:**
1. `/browse` route renders the new FileManager component
2. Directory listing shows both files and folders with proper icons
3. Breadcrumb navigation works (tap to navigate, back button)
4. Hidden files toggle filters dot-files
5. Responsive: mobile full-screen + desktop split-pane
6. All states: loading skeleton, populated, empty directory, error
7. i18n keys for all UI strings (zh/en)

**Requirements:** BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, NAV-01, NAV-02, RESP-01

---

### Phase 2: File Icons + Context Menu

**Goal:** Complete file icon system with per-extension colors, and context menu for all file operations.

**Success Criteria:**
1. 30+ file type icons with correct colors (per design spec section 7)
2. Folder icons: default, git repo, hidden, symlink
3. Context menu on "..." button / right-click with all CRUD operations
4. Menu items: New File, New Folder, Rename, Delete, Move, Copy, Copy Path, Download, Upload
5. Context menu positioned correctly (no overflow clipping)
6. Touch-friendly menu items (44px height)

**Requirements:** ICON-01, ICON-02, MENU-01, MENU-02

---

### Phase 3: CRUD Operations

**Goal:** All basic file operations working end-to-end (initially with mock API, swappable to real).

**Success Criteria:**
1. Create file/folder with inline validation
2. Rename with pre-filled input (extension preserved)
3. Delete with confirmation dialog + undo toast
4. Move/Copy with directory picker dialog
5. Copy path to clipboard with success feedback
6. Upload (system file picker) with progress indicator
7. Download (blob save) for individual files
8. All operations show loading state and success/error feedback
9. Clipboard cut/copy visual indicator on source row

**Requirements:** CRUD-01 through CRUD-09

---

### Phase 4: Desktop Enhancement + Polish

**Goal:** Desktop-specific features, batch selection, keyboard shortcuts, animations, and final polish.

**Success Criteria:**
1. Desktop: checkbox always visible in file rows
2. Desktop: shift+click range select, ctrl+click multi-select
3. Batch action bar appears when items selected (Move/Copy/Delete)
4. Keyboard shortcuts: Ctrl+N, Delete, F2, Ctrl+C/X/V, Enter, Backspace
5. Page transition animations (directory forward/backward)
6. Row animations (new item highlight, delete slide-out)
7. Dialog open/close animations
8. Bottom sheet for properties (slide-up on mobile)
9. Pull-to-refresh on mobile
10. Reduced-motion alternatives for all animations

**Requirements:** DESK-01, BATCH-01, KEYB-01, MOTION-01, MOTION-02

---

### Phase 5: Session Launcher + Integration

**Goal:** "Start Session" from any directory, integration with existing session flow, and cleanup of old browse code.

**Success Criteria:**
1. "Start Session" CTA button navigates to `/sessions/new?directory=...`
2. Machine selector in header works (multi-machine support)
3. Workspace root selector works
4. Old WorkspaceBrowser component removed
5. Session files page simplified (remove CRUD features)
6. All i18n keys complete (zh + en)
7. Build passes, typecheck passes, tests pass

**Requirements:** SESS-01, SESS-02, INTEG-01, INTEG-02

---

## Deferred to Phase 2 (Future Iteration)

- CodeMirror 6 text editor integration
- Image preview with zoom/pan
- Search & filter (by name, type, size, date)
- Git Clone dialog
- ZIP/tar.gz compress and extract
- File properties panel
- Sort by size/date
