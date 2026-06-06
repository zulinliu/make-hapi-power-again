---
phase: 34-file-preview-editing
feature_version: Phase 6.0
document: CONTEXT
status: ready
created: 2026-06-06
---

# Phase 34 / Phase 6.0 Context：文件预览 / 编辑

## Why this phase exists

Phase 5.1 closed FileManager foundation quality at 20/20. The next high-leverage product slice is not upload/download or git clone yet; it is the file content loop. Users can browse and manage files, but opening, previewing, editing, saving, and recovering from failures must become reliable before larger file workflows build on top.

## Current implementation facts

- FileManager exists under `web/src/components/FileManager/` and is now i18n/style-clean.
- Existing file route: `web/src/routes/sessions/file.tsx`.
- Existing session files page: `web/src/routes/sessions/files.tsx`.
- Existing Git preview: `web/src/components/git/GitFilePreview.tsx`.
- File read/write API exists:
  - `web/src/api/client.ts` → `readSessionFile`, `writeSessionFile`
  - `hub/src/web/routes/git.ts` → GET/PUT `/api/sessions/:id/file`
  - `hub/src/sync/rpcGateway.ts` → `ReadFile` / `WriteFile`
  - `cli/src/modules/common/handlers/files.ts` → reads/writes base64 content
- File utility exists: `web/src/lib/file-utils.ts`.

## Key product constraints

- Product register: app/tool UI, design serves task completion.
- Mobile/iOS is first-class.
- Avoid IDE complexity in MVP.
- Never lose local edits on save failure or accidental navigation.
- Maintain WCAG AA and 44px touch targets.
- New copy must be bilingual.

## Planning artifacts

- PRD: `.planning/phases/34-file-preview-editing/34-PRD.md`
- UX Shape: `.planning/phases/34-file-preview-editing/34-UX-SHAPE.md`
- Plan: `.planning/phases/34-file-preview-editing/34-PLAN.md`
