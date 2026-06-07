# FileManager Design Critique

**Date**: 2026-06-07
**Target**: web/src/components/FileManager
**Score**: 26/40 (Acceptable)

## Priority Issues

### P0-1: Mobile "启动" button label+icon completely misleading
- fm.toolbar.sessionShort = "启动"/"Start" with file+checkmark icon
- Neither label nor icon conveys "start AI coding session"
- Fix: label → "会话"/"Session", icon → chat bubble SVG

### P0-2: Context menu "移动" icon is external-link style
- Move icon looks like "open in new tab"
- Fix: folder with directional arrow SVG

### P0-3: Desktop sort headers display:none (functional bug, out of scope)

### P1-1: Mobile "编辑" pencil icon for selection mode
- Pencil = edit content, but action is batch select
- Fix: label → "管理"/"Manage", icon → checkmark-circle SVG

### P1-2: Desktop batch bar "启动会话" → "新会话" (align with mobile)

### P1-3: Chinese "隐藏隐藏文件" tautology
- Fix: "显示点文件"/"隐藏点文件"

### P1-4: Edit mode bar missing aria-label + role="toolbar"

### P2-1: English fm.edit.selectAll "All" → "Select All"
### P2-2: Transfer dialog "Place" → split move/copy verbs
### P2-3: Desktop "+" text char vs SVG inconsistency
### P3-1: ~13 dead translation keys

## Heuristic Scores
H1:3 H2:2.5 H3:3 H4:2.5 H5:2.5 H6:3 H7:3.5 H8:3 H9:2 H10:1 = 26/40

## Personas
- Alex: sort unreachable, no undo
- Sam: InputField missing aria-label, edit bar missing role
- Casey: edit bar 6 elements cramped on small screens
