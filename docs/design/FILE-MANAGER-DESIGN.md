# File Manager Module — Design Specification

> Hapi Power 全局文件管理器，移动端优先的全功能文件管理体验。
> 基于 impeccable product register，遵循 "Power Geometry" 品牌设计语言。

---

## 1. Functional Architecture

### 1.1 Module Map

```
FileManager (全局文件管理器)
├── FileBrowser (文件浏览核心)
│   ├── DirectoryView (目录列表视图)
│   ├── BreadcrumbNav (面包屑导航)
│   ├── SearchPanel (搜索与过滤)
│   └── HiddenFilesToggle (隐藏文件切换)
├── FileOperations (文件操作)
│   ├── CreateFlow (新建文件/文件夹)
│   ├── RenameFlow (重命名)
│   ├── DeleteFlow (删除确认)
│   ├── MoveCopyFlow (移动/复制)
│   ├── UploadFlow (上传)
│   ├── DownloadFlow (下载)
│   ├── ClipboardOps (剪贴板操作)
│   ├── ArchiveOps (压缩/解压)
│   └── BatchOps (批量操作)
├── FilePreview (文件预览)
│   ├── TextEditor (CodeMirror 6 编辑器)
│   ├── ImageViewer (图片预览器)
│   └── BinaryInfo (二进制文件信息)
├── GitClone (Git 克隆)
│   └── CloneDialog (克隆对话框)
├── FileInspector (文件属性)
│   └── PropertiesPanel (属性面板)
└── SessionLauncher (会话启动器)
    └── StartSessionButton (从目录启动会话)
```

### 1.2 User Flows

**Primary Flow: Browse and Manage**
```
打开文件管理器 → 选择机器 → 选择 workspace root → 浏览目录层级
→ 对文件/文件夹进行操作（查看/编辑/移动/复制/删除等）
```

**Secondary Flow: Quick Session**
```
打开文件管理器 → 导航到目标目录 → 点击"启动会话" → 跳转新建会话页
```

**Flow: Text Editing**
```
点击文件 → 文件预览/编辑器全屏展开 → 查看内容 → 编辑 → 保存
```

**Flow: Batch Operations**
```
进入编辑模式（移动端）/ 勾选文件（桌面端）→ 选择多个文件
→ 底部工具栏出现批量操作 → 执行移动/复制/删除/压缩
```

**Flow: Git Clone**
```
点击工具栏 Git Clone 按钮 → 输入 URL → 选择目标目录 → 开始克隆
→ 克隆完成自动刷新目录 → 可选立即启动会话
```

### 1.3 Feature Matrix

| # | Feature | Mobile | Desktop | Priority |
|---|---------|--------|---------|----------|
| 1 | Directory browsing (list view) | P0 | P0 | Must |
| 2 | Hidden files toggle | P0 | P0 | Must |
| 3 | Create file/folder | P0 | P0 | Must |
| 4 | Rename | P0 | P0 | Must |
| 5 | Delete (with confirm) | P0 | P0 | Must |
| 6 | Move | P0 | P0 | Must |
| 7 | Copy | P0 | P0 | Must |
| 8 | Copy path | P1 | P1 | Should |
| 9 | Upload file(s) | P0 | P0 | Must |
| 10 | Download file | P0 | P0 | Must |
| 11 | Text preview & edit (CodeMirror 6) | P0 | P0 | Must |
| 12 | Image preview | P0 | P0 | Must |
| 13 | Search by name | P0 | P0 | Must |
| 14 | Filter by type/size/date | P1 | P1 | Should |
| 15 | Batch select & operate | P1 | P0 | Should |
| 16 | File properties view | P1 | P1 | Should |
| 17 | ZIP compress | P1 | P1 | Should |
| 18 | ZIP/tar.gz extract | P1 | P1 | Should |
| 19 | Git Clone | P0 | P0 | Must |
| 20 | Start session from directory | P0 | P0 | Must |
| 21 | Sort by name/size/date | P1 | P1 | Should |
| 22 | Breadcrumb navigation | P0 | P0 | Must |
| 23 | i18n zh/en | P0 | P0 | Must |

---

## 2. UI Component Design

### 2.1 Page Architecture

**Mobile Layout (< 768px):**
```
┌─────────────────────────────┐
│ ← Back    FileManager    ⚙  │  ← Header (56px)
├─────────────────────────────┤
│ Machine: Runner-1      ▼   │  ← Machine selector
├─────────────────────────────┤
│ / home / liuzl / projects   │  ← Breadcrumb
├─────────────────────────────┤
│ 🔍 Search  ☐ Hidden  ⬇ ↓  │  ← Toolbar (search + toggles + sort)
├─────────────────────────────┤
│ ┌─ 📁 src                ─┐ │
│ ├─ 📁 public             ─┤ │  ← File list
│ ├─ 📄 package.json    2KB ─┤ │     (scrollable area)
│ ├─ 📄 README.md      4KB ─┤ │
│ ├─ 📄 tsconfig.json  1KB ─┤ │
│ └─ 📄 .gitignore    256B ─┘ │
├─────────────────────────────┤
│  +  📋  📥  Git  │ 启动会话 │  ← Bottom toolbar (56px)
└─────────────────────────────┘
```

**Desktop Layout (≥ 768px):**
```
┌────────────┬──────────────────────────────────────────┐
│            │ ←  / home / liuzl / projects             │  ← Breadcrumb bar
│  Session   ├──────────────────────────────────────────┤
│  List      │ 🔍 Search  ☐ Hidden  Sort:Name ▼  + New │  ← Toolbar
│            ├──────────────────────────────────────────┤
│  ┌──────┐  │ ┌─ 📁 src                    ─ Checkbox ─┐│
│  │ Chat │  │ ├─ 📁 public                 ─ Checkbox ─┤│
│  │  1   │  │ ├─ 📄 package.json    2KB    ─ Checkbox ─┤│
│  ├──────┤  │ ├─ 📄 README.md      4KB    ─ Checkbox ─┤│
│  │ Chat │  │ ├─ 📄 tsconfig.json  1KB    ─ Checkbox ─┤│
│  │  2   │  │ └─ 📄 .gitignore    256B    ─ Checkbox ─┘│
│  └──────┘  ├──────────────────────────────────────────┤
│            │ 启动会话               2 selected → Delete│  ← Action bar
└────────────┴──────────────────────────────────────────┘
```

### 2.2 Component Specifications

#### Header (Mobile)
- Height: `--hp-mobile-header-height` (56px)
- Left: Back chevron button (36x44 tap target)
- Center: "Files" / "文件" title, `--hp-text-lg`, weight 600
- Right: Machine selector dropdown + Settings gear icon
- Background: `--hp-surface-0`
- Border bottom: `1px solid var(--hp-border)`
- Safe area: `padding-top: env(safe-area-inset-top)`

#### Breadcrumb Bar
- Height: 40px
- Horizontal scroll if overflow, scroll-snap to end
- Each segment: tap target 36x36px minimum
- Separator: `/` in `--hp-text-tertiary`
- Current segment: `--hp-primary` color, weight 600
- Parent segments: `--hp-text-secondary`, tap to navigate
- Background: `--hp-surface-1`

#### Toolbar
- Height: 44px
- Left: Search input (expandable on mobile)
- Right: Hidden files toggle switch, Sort dropdown, New button (+)
- Mobile: search icon → expand to full-width input, collapse on blur
- Desktop: search always visible, 200-300px width

#### File List Row
- Height: 52px (mobile), 44px (desktop)
- Layout: `[icon 28px] [gap 12px] [name + subtitle flex-1] [meta right-aligned]`
- Icon: FileIcon component, 22px (mobile), 18px (desktop)
- Name: `--hp-text-base`, weight 500, single-line truncate
- Subtitle (size + modified): `--hp-text-xs`, `--hp-text-tertiary`
- Meta: file size right-aligned, `--hp-text-sm`, `--hp-text-tertiary`
- Desktop only: checkbox on left (20px), 8px gap
- Action button (mobile): small "..." button (36x44 tap target) on right
- Hover (desktop): `background: var(--hp-surface-1)`
- Selected: `background: var(--hp-primary-subtle)`, left border 3px `--hp-primary`
- Divider: `1px solid var(--hp-divider)` between rows

#### Bottom Toolbar (Mobile)
- Height: 56px + `env(safe-area-inset-bottom)`
- Background: `--hp-surface-0`, `--hp-shadow-md` above
- Left group: Create (+), Paste clipboard, Upload
- Right: Primary CTA "Start Session" / "启动会话"
- Icons: 24px, labels below in `--hp-text-xs`
- CTA button: `--hp-primary` bg, `--hp-primary-text`, `--hp-radius-md`, min-width 100px

#### Action Bar (Desktop)
- Height: 40px
- Left: Primary CTA "Start Session"
- Right: Batch action buttons (visible only when items selected)
- Selected count badge: `--hp-primary-subtle` bg, `--hp-primary` text

### 2.3 Dialog Components

#### Create Dialog
- Title: "New File" / "新建文件" or "New Folder" / "新建文件夹"
- Input: Full-width text input with placeholder
- Validation: Empty name → error, duplicate name → error
- Buttons: Cancel (ghost) + Create (primary)

#### Rename Dialog
- Same structure as Create
- Input pre-filled with current name (without extension for files)
- Extension shown as disabled suffix

#### Delete Confirmation
- Description: "Delete {name}?" / "确定删除 {name}？"
- For folders: "This folder contains {n} items" / "此文件夹包含 {n} 个项目"
- Buttons: Cancel + Delete (danger, `--hp-danger`)

#### Move/Copy Dialog
- Directory picker tree with current path highlighted
- Search input to filter directories
- "New Folder" inline creation button
- Selected destination path shown at bottom
- Buttons: Cancel + Move/Copy (primary)

#### Git Clone Dialog
- URL input (required): "https://github.com/user/repo.git"
- Destination directory picker
- Branch input (optional)
- Depth input (optional, default: full)
- Progress bar during clone
- Buttons: Cancel + Clone (primary)

#### Properties Panel
- Slide-up sheet (mobile) / side panel (desktop)
- Fields: Name, Type, Size, Location, Modified, Created, Permissions
- For Git repos: branch, remote URL, commit count
- Close button or swipe down to dismiss

#### Archive Dialog
- Source: selected files/folders
- Format selector: ZIP (default), tar.gz
- Archive name input (pre-filled)
- Destination picker
- Buttons: Cancel + Create Archive (primary)

### 2.4 File Preview / Editor

**Mobile:**
```
┌─────────────────────────────┐
│ ← Back   filename.ts   💾  │  ← Editor header
├─────────────────────────────┤
│                             │
│  CodeMirror 6 editor        │  ← Full-height editor
│  with syntax highlighting   │     (100dvh - header)
│  and mobile keyboard        │
│  optimization               │
│                             │
└─────────────────────────────┘
```

**Desktop:**
```
┌──────────────────────────────────────────────────┐
│ ← Back  filename.ts  (saved)        💾 ⬇ 📋    │  ← Editor toolbar
├──────────────────────────────────────────────────┤
│                                                  │
│  CodeMirror 6 editor                             │  ← Full-height
│  with syntax highlighting,                       │     line numbers,
│  autocomplete, folding                           │     minimap
│                                                  │
└──────────────────────────────────────────────────┘
```

Editor features by platform:
- **Mobile**: Syntax highlighting, line numbers, basic editing, save button, word wrap on
- **Desktop**: All mobile features + autocomplete, code folding, minimap, find/replace, multi-cursor

Image preview:
- Full-screen view with zoom (pinch-to-zoom mobile, scroll-to-zoom desktop)
- Pan with drag
- Image info overlay (dimensions, size, type)
- Download button
- Swipe left/right for next/prev image in directory

---

## 3. Interaction Design

### 3.1 Navigation Interactions

**Breadcrumb tap**: Navigate to that directory. Current directory content fades out, new content slides in from right (200ms `--hp-ease-overlay`).

**Directory row tap**: Enter directory. Content slides left, new content slides in from right. Breadcrumb updates. Scroll position saved per path (restore on back).

**Back button / swipe right (mobile)**: Navigate to parent. Content slides right, previous content slides in from left. Scroll position restored.

**File row tap**: Open preview/editor. Editor slides up from bottom (mobile) or replaces content area (desktop).

### 3.2 File Operation Interactions

**Create file/folder**:
1. Tap "+" button in toolbar → Create dialog opens
2. Toggle between File/Folder type (segmented control)
3. Type name → validation inline
4. Tap "Create" → dialog closes, new item appears in list with highlight animation
5. Auto-scroll to new item position

**Rename**:
1. Tap "..." action button on row → context menu appears
2. Tap "Rename" → Rename dialog opens, input focused
3. Edit name → validation inline
4. Tap "Rename" → dialog closes, row updates with highlight flash

**Delete**:
1. Tap "..." → context menu → "Delete"
2. Confirmation dialog appears with item name
3. Tap "Delete" → dialog closes, row slides out with fade (300ms)
4. Undo toast appears for 5 seconds ("Undo" button)

**Move/Copy**:
1. Tap "..." → context menu → "Move to..." / "Copy to..."
2. Directory picker dialog opens (shows tree, current location highlighted)
3. Navigate to target directory
4. Tap "Move"/"Copy" → dialog closes, source list refreshes
5. Success toast with destination path

**Upload**:
1. Tap upload button → system file picker opens (iOS: document picker or camera roll)
2. File(s) selected → upload progress bar appears in a bottom sheet
3. Progress: percentage + file name + estimated time
4. Complete: toast "Uploaded {n} files" + list refresh
5. Error: inline error in progress sheet with retry button

**Download**:
1. Tap "..." → context menu → "Download"
2. Browser download starts (or save to Files on iOS)
3. Progress shown in browser download indicator
4. For folders: auto-zip then download

**Clipboard (Cut/Copy + Paste)**:
1. Tap "..." → "Cut" or "Copy" → item gets clipboard indicator (dashed outline for cut, subtle bg for copy)
2. Navigate to target directory
3. Paste button appears in toolbar (enabled when clipboard has items)
4. Tap "Paste" → item copied/moved to current directory
5. Clipboard cleared after paste (cut) or kept (copy)

### 3.3 Batch Operation Interactions

**Enter batch mode (mobile)**:
1. Tap "Select" / "编辑" button in toolbar
2. Toolbar transforms: left shows "Cancel", right shows "Select All"
3. Each row gains a checkbox on the left side
4. Bottom toolbar transforms to show batch actions: Move, Copy, Delete, Archive
5. Selected count shown in toolbar

**Batch mode (desktop)**:
- Checkboxes always visible
- Selecting any checkbox reveals the action bar
- Shift+click for range select
- Ctrl/Cmd+click for multi-select
- Select all checkbox in list header

**Batch operations**:
- Move/Copy: same dialog as single, but source shows "{n} items"
- Delete: "Delete {n} items?" with item list preview
- Archive: "Archive {n} items" with name input

### 3.4 Search Interactions

**Search flow**:
1. Tap search icon (mobile: expands to full-width input) / click search input (desktop)
2. Type query → results appear after 300ms debounce
3. Results: filtered file list showing matching files/folders
4. Each result shows: icon + name (query highlighted in `--hp-primary`) + path
5. Tap result → navigate to its location or open file

**Filter options** (expandable panel below search):
- Type: All / Files / Folders / Images / Code / Archives
- Size: Any / <1MB / 1-10MB / >10MB
- Date: Any / Today / This week / This month
- Hidden: toggle (also in toolbar)

### 3.5 State Transitions

```
[Empty] → [Loading] → [Populated]
                        ↓
                  [Searching] ←→ [Filtered Results]
                        ↓
                  [File Selected] → [Previewing] → [Editing]
                        ↓
                  [Batch Mode] → [Items Selected] → [Operating...]
                        ↓
                  [Error] (retry available)
```

---

## 4. Motion Design

### 4.1 Page Transitions

**Directory navigation (forward)**:
- Current content: `transform: translateX(-8%); opacity: 0` over 200ms `--hp-ease-overlay`
- New content: enters from `translateX(20%)` to `translateX(0)` over 250ms `--hp-ease-overlay`
- Breadcrumb: segments slide in from right, 50ms stagger per new segment
- Reduced motion: crossfade only, 150ms

**Directory navigation (backward)**:
- Current content: `translateX(20%); opacity: 0` over 200ms
- Previous content: enters from `translateX(-8%)` to `translateX(0)` over 250ms
- Breadcrumb: segments slide out to right
- Reduced motion: crossfade only

**File preview open**:
- Mobile: preview slides up from bottom, `transform: translateY(100%) → translateY(0)` over 300ms `--hp-ease-overlay`
- Desktop: preview fades in over 150ms, file list shrinks to sidebar width

**Dialog open**:
- Backdrop: `opacity: 0 → 0.5` over 150ms `--hp-ease-default`
- Content: `transform: translateY(16px) scale(0.98); opacity: 0` → `translateY(0) scale(1); opacity: 1` over 200ms `--hp-ease-out`
- Reduced motion: instant appear, backdrop crossfade

### 4.2 List Animations

**Initial load**: Skeleton placeholders (3-5 rows, pulsing `--hp-surface-1` on `--hp-canvas`), replaced by actual content with staggered fade-in (30ms per row, 150ms total).

**New item added**: Row slides in from left with `opacity: 0 → 1` over 200ms. Brief highlight flash: `background: var(--hp-primary-subtle)` fading to transparent over 500ms.

**Item deleted**: Row collapses: `height: 52px → 0; opacity: 1 → 0` over 250ms `--hp-ease-in`. Divider merges. Items below slide up.

**Item renamed**: Text updates with a brief highlight flash (same as new item).

**Item moved (cut source)**: Row fades out with `opacity: 0.5` over 150ms, then dashed border appears, then fully fades after paste.

### 4.3 Micro-interactions

**Checkbox toggle**: Scale bounce `transform: scale(0.8) → 1.1 → 1.0` over 200ms with `--hp-ease-spring`. Fill color transitions from transparent to `--hp-primary`.

**Toggle switch (hidden files)**: Knob slides 20px over 150ms `--hp-ease-default`. Track color transitions `--hp-surface-2 → --hp-primary`.

**Sort dropdown**: Arrow rotates 180° over 150ms. Menu slides down 4px with fade.

**Toast notification**: Slides up from bottom (mobile) or fades in at top-right (desktop). Auto-dismiss: slides down/fades out after 4s. Undo variant: persists for 8s, undo button has tap feedback.

**Progress bar**: Width transitions smoothly. Percentage text fades between values. Indeterminate state: gradient shimmer animation.

**Copy path success**: Brief `checkmark` icon replaces clipboard icon for 1.5s, then reverts.

**Save indicator (editor)**: "Saved" text fades in green for 2s, then fades out. Unsaved: dot indicator pulses.

### 4.4 Mobile-Specific Motion

**Pull to refresh**:
- Distance threshold: 60px
- Pull indicator: circular spinner that fills as pulled
- Release: spinner rotates during refresh, completes with checkmark
- Snap-back: `transform: translateY(pullDistance) → translateY(0)` over 300ms `--hp-ease-spring`

**Swipe actions (optional, not primary interaction)**:
- Left swipe on row reveals quick actions (delete, move)
- Threshold: 40px to reveal, 80px to confirm
- Reveal: action buttons slide in from right, row content slides left
- Cancel: snap back over 200ms `--hp-ease-spring`

**Bottom sheet (properties, upload progress)**:
- Drag handle at top (4px × 32px bar, `--hp-text-tertiary`)
- Drag to dismiss: follows finger, dismisses at 40% height
- Snap: `--hp-ease-spring` to either open or closed
- Backdrop: opacity proportional to sheet height

---

## 5. Mobile-Specific Design (iOS + PWA)

### 5.1 iOS Adaptation

**Safe areas**:
- Top: `padding-top: env(safe-area-inset-top)` on header
- Bottom: `padding-bottom: env(safe-area-inset-bottom)` on bottom toolbar
- Left/Right: `padding-inline: env(safe-area-inset-left), env(safe-area-inset-right)` in landscape

**Touch targets**:
- Minimum 44×44px for all interactive elements
- Row height 52px (comfortable tap target)
- Icon buttons: 36px visual size in 44px tap area
- Spacing between interactive elements: minimum 8px

**Keyboard handling**:
- Editor: CodeMirror 6 with `viewportMargin: Infinity` for mobile
- Viewport shrinks when keyboard appears (100dvh, not 100vh)
- Toolbar stays above keyboard
- Scroll to cursor when keyboard opens

**iOS file picker integration**:
- Upload button triggers `<input type="file">` which opens iOS document picker
- Support `accept` attribute for image filtering
- No camera integration (keep it simple)
- Multiple file upload: `<input type="file" multiple>`

**Share sheet (future)**:
- Share file via Web Share API: `navigator.share({ files: [file] })`
- Available on Safari 15+ and Chrome Android

### 5.2 Haptic Feedback

- Light impact: toggle switches, checkbox selection
- Medium impact: successful file operation (create, rename, move)
- Heavy impact: destructive action confirmation (delete)
- Selection changed: scrolling through picker lists
- Note: Use `navigator.vibrate()` on Android, no API on iOS (system handles)

### 5.3 PWA Considerations

**Offline behavior**:
- Directory listing requires connection (no offline cache)
- Show clear "Offline" banner when disconnected
- Editor can cache current file content for viewing
- Queue operations for retry when back online

**Install prompt**:
- File manager works as standalone PWA
- Manifest `display: standalone` already configured
- Back button in header for navigation (no browser chrome)

**Performance budget**:
- CodeMirror 6: lazy loaded, ~150KB gzipped (vs Monaco ~800KB)
- File list rendering: virtualize at >100 items
- Image preview: thumbnail generation for large images
- Initial page load: <2s on 3G

---

## 6. Design Specifications

### 6.1 Color Usage in File Manager

| Element | Token | Note |
|---------|-------|------|
| Page background | `--hp-canvas` | Dark: oklch(13% 0.015 55) |
| Header/toolbar bg | `--hp-surface-0` | Slightly lighter than canvas |
| Breadcrumb bg | `--hp-surface-1` | Subtle elevation |
| File row bg (default) | `transparent` | Inherits canvas |
| File row bg (hover) | `--hp-surface-1` | Desktop only |
| File row bg (selected) | `--hp-primary-subtle` | Orange tint |
| File row bg (clipboard cut) | `--hp-warning-subtle` | Yellow tint, dashed border |
| File name text | `--hp-text-primary` | |
| File size/date text | `--hp-text-tertiary` | |
| Folder icon | `--hp-primary` | Electric orange folders |
| CTA button | `--hp-primary` bg, `--hp-primary-text` text | |
| Danger button | `--hp-danger` | |
| Bottom toolbar | `--hp-surface-0` + `--hp-shadow-md` | |
| Dialog backdrop | `oklch(0% 0 0 / 0.5)` | |
| Dialog surface | `--hp-surface-0` | |
| Toast bg | `--hp-surface-3` with `--hp-shadow-lg` | |
| Progress bar track | `--hp-surface-2` | |
| Progress bar fill | `--hp-primary` | |
| Empty state text | `--hp-text-tertiary` | |
| Error state text | `--hp-danger` | |
| Search highlight | `--hp-primary-subtle` bg | |

### 6.2 Typography in File Manager

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Page title | `--hp-text-lg` | 600 | 1.25 |
| Breadcrumb segment | `--hp-text-sm` | 500 (current: 600) | 1.25 |
| File/folder name | `--hp-text-base` | 500 | 1.25 |
| File size/date | `--hp-text-xs` | 400 | 1.5 |
| Toolbar labels | `--hp-text-sm` | 500 | 1.25 |
| Button text | `--hp-text-sm` | 600 | 1.25 |
| Dialog title | `--hp-text-lg` | 600 | 1.25 |
| Dialog body | `--hp-text-sm` | 400 | 1.5 |
| Toast text | `--hp-text-sm` | 500 | 1.25 |
| Empty state title | `--hp-text-base` | 500 | 1.5 |
| Empty state description | `--hp-text-sm` | 400 | 1.5 |
| Properties label | `--hp-text-xs` | 500 | 1.5 |
| Properties value | `--hp-text-sm` | 400 | 1.5 |

### 6.3 Spacing Scale

| Context | Value |
|---------|-------|
| Page padding (mobile) | `--hp-space-3` (12px) |
| Page padding (desktop) | `--hp-space-4` (16px) |
| Row internal padding | `--hp-space-3` horizontal, `--hp-space-2` vertical |
| Section gap | `--hp-space-4` (16px) |
| Toolbar gap | `--hp-space-2` (8px) |
| Dialog padding | `--hp-space-5` (20px) |
| Dialog gap between elements | `--hp-space-4` (16px) |
| Icon-to-text gap | `--hp-space-3` (12px) |
| Breadcrumb segment gap | `--hp-space-1` (4px) |
| Bottom toolbar icon gap | `--hp-space-6` (24px) |

### 6.4 Radius

| Element | Value |
|---------|-------|
| Button default | `--hp-radius-md` (10px) |
| Button small | `--hp-radius-sm` (6px) |
| Input field | `--hp-radius-md` (10px) |
| Dialog | `--hp-radius-xl` (20px) |
| Toast | `--hp-radius-lg` (14px) |
| Checkbox | `--hp-radius-sm` (6px) |
| Context menu | `--hp-radius-lg` (14px) |
| Progress bar | `--hp-radius-full` (9999px) |
| Bottom sheet | `--hp-radius-xl` (20px) top corners only |
| File icon | `--hp-radius-sm` (6px) |

### 6.5 Shadows

| Element | Shadow |
|---------|--------|
| Bottom toolbar (mobile) | `--hp-shadow-md` (above) |
| Dialog | `--hp-shadow-xl` |
| Toast | `--hp-shadow-lg` |
| Context menu | `--hp-shadow-lg` |
| Bottom sheet | `--hp-shadow-xl` (above) |
| Dropdown | `--hp-shadow-md` |

---

## 7. File Icon System

### 7.1 Design Approach

Icons use a **duotone style**: primary shape in `--hp-text-secondary` with a colored accent detail. 24px grid, 2px stroke weight, rounded corners matching `--hp-radius-sm`.

### 7.2 Icon Categories

**Folder Icons (filled with accent)**:

| Type | Primary Color | Accent |
|------|---------------|--------|
| Default folder | `--hp-primary` (electric orange) | Tab fold darker |
| Folder open | `--hp-primary` | Interior lighter |
| Git repository | `--hp-primary` | Git branch icon overlay |
| Hidden folder (.) | `--hp-text-tertiary` | Reduced opacity |
| Symlink folder | `--hp-info` (blue) | Arrow overlay |
| Locked/protected | `--hp-warning` (amber) | Lock overlay |

**Code File Icons (colored dot on document shape)**:

| Extension | Color | Note |
|-----------|-------|------|
| .ts, .tsx | `oklch(60% 0.15 250)` | TypeScript blue |
| .js, .jsx, .mjs | `oklch(75% 0.16 85)` | JavaScript gold |
| .py | `oklch(55% 0.15 65)` | Python orange-blue |
| .rs | `oklch(60% 0.14 20)` | Rust red-brown |
| .go | `oklch(65% 0.12 190)` | Go teal |
| .java | `oklch(60% 0.16 30)` | Java red-orange |
| .css, .scss, .less | `oklch(65% 0.14 300)` | CSS pink-purple |
| .html, .htm | `oklch(60% 0.15 25)` | HTML orange |
| .json | `oklch(70% 0.10 85)` | JSON warm yellow |
| .yaml, .yml | `oklch(60% 0.12 250)` | YAML blue |
| .toml | `oklch(55% 0.12 160)` | TOML green |
| .xml | `oklch(65% 0.14 30)` | XML orange |
| .sql | `oklch(55% 0.12 190)` | SQL teal |

**Document Icons (monochrome with accent)**:

| Extension | Accent Color |
|-----------|-------------|
| .md, .mdx | `--hp-text-secondary` |
| .txt | `--hp-text-tertiary` |
| .pdf | `oklch(60% 0.18 22)` red |
| .doc, .docx | `oklch(55% 0.14 250)` blue |
| .xls, .xlsx | `oklch(65% 0.16 140)` green |
| .ppt, .pptx | `oklch(65% 0.14 30)` orange |

**Image Icons (colored frame)**:

| Extension | Frame Color |
|-----------|------------|
| .png, .jpg, .jpeg, .webp | `oklch(55% 0.12 160)` green |
| .gif | `oklch(65% 0.14 30)` orange |
| .svg | `oklch(60% 0.14 250)` blue |
| .ico | `oklch(55% 0.12 160)` green |

**Archive Icons**:

| Extension | Color |
|-----------|-------|
| .zip | `oklch(65% 0.10 85)` warm |
| .tar, .gz, .tar.gz, .tgz | `oklch(55% 0.12 250)` blue |
| .rar | `oklch(65% 0.14 300)` purple |
| .7z | `oklch(55% 0.12 160)` green |

**Config/System Icons**:

| Extension | Color |
|-----------|-------|
| .env, .env.* | `oklch(60% 0.12 250)` blue |
| .gitignore, .git* | `oklch(60% 0.14 20)` red-brown (Git) |
| .dockerfile, Dockerfile | `oklch(55% 0.14 55)` blue |
| .lock | `oklch(55% 0.10 250)` blue |
| .conf, .cfg, .ini | `--hp-text-tertiary` |
| Makefile | `oklch(55% 0.12 250)` blue |
| LICENSE | `oklch(60% 0.10 250)` blue |

**Generic/Unknown**: Document shape in `--hp-text-tertiary` with `?` in center.

### 7.3 Icon Rendering

Icons are SVG components rendered inline (not icon font). Each icon is a React component accepting `size` and `className` props. A `FileIcon` component determines the correct icon based on file extension:

```tsx
interface FileIconProps {
  fileName: string
  size?: number  // default 22
  className?: string
  isGitRepo?: boolean
  isHidden?: boolean
  isSymlink?: boolean
}
```

---

## 8. Empty States

### No Workspace Roots
- Icon: folder with question mark
- Title: "No workspace roots configured" / "未配置工作区根目录"
- Description: "Add workspace roots via CLI: `hapi-power runner start --workspace-root /path`"
- Action: "Learn more" link to docs

### Empty Directory
- Icon: empty folder
- Title: "This folder is empty" / "此文件夹为空"
- Description: "Create a new file or folder, or upload files" / "新建文件或文件夹，或上传文件"
- Actions: "New File" + "New Folder" + "Upload" buttons

### No Search Results
- Icon: magnifying glass with X
- Title: "No files match '{query}'" / "没有匹配 '{query}' 的文件"
- Description: "Try a different search term" / "尝试不同的搜索词"

### Offline State
- Icon: cloud with slash
- Title: "No connection" / "无网络连接"
- Description: "File manager requires an active connection" / "文件管理器需要网络连接"
- Action: "Retry" button

### Loading State
- Skeleton rows (6 rows) with pulsing animation
- Different widths for name and subtitle to simulate real content
- Duration: until data arrives

---

## 9. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile S | < 375px | Compact layout, smaller text |
| Mobile | 375-767px | Default mobile layout |
| Tablet | 768-1023px | Split view: sidebar + file manager |
| Desktop | 1024-1439px | Full split layout with tree sidebar |
| Desktop L | ≥ 1440px | Wider file list, more meta columns visible |

Key responsive changes:
- **< 768px**: Full-screen file manager, bottom toolbar, hierarchical navigation, edit mode for batch
- **≥ 768px**: Split layout, checkbox always visible, action bar, tree sidebar available
- **≥ 1024px**: Full desktop experience, right-click context menu, keyboard shortcuts

---

## 10. Keyboard Shortcuts (Desktop)

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New file |
| `Ctrl/Cmd + Shift + N` | New folder |
| `Ctrl/Cmd + F` | Focus search |
| `Ctrl/Cmd + A` | Select all |
| `Delete` | Delete selected |
| `Ctrl/Cmd + C` | Copy selected |
| `Ctrl/Cmd + X` | Cut selected |
| `Ctrl/Cmd + V` | Paste |
| `F2` | Rename selected |
| `Enter` | Open file/folder |
| `Backspace` | Navigate to parent |
| `Ctrl/Cmd + .` | Toggle hidden files |
| `Esc` | Clear selection / close dialog |

---

*Design specification for Hapi Power File Manager Module.*
*Last updated: 2026-06-06*
