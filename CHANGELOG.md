# Changelog

All notable changes to Hapi Power will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.10.0] - 2026-06-04

### Changed

- Login page redesigned with Claude-style visual direction

## [0.9.0] - 2026-06-03

### Changed

- UI unification with SubPageLayout component, CSS variables, and context menus
- Unified page layout system across all session sub-pages

## [0.8.0] - 2026-06-03

### Changed

- Skill management UI redesign with online install and marketplace browsing
- Mobile layout fixes and responsive improvements

### Fixed

- Service worker cache optimization for faster loads

## [0.7.0] - 2026-06-02

### Added

- Custom model API provider configuration with CRUD management
- Model auto-discovery via `/v1/models` endpoint probing
- Provider-to-agent-flavor assignment system
- API key encryption with AES-256-GCM in SQLite
- Provider config delivery from Hub to CLI via RPC injection
- Model selector with custom provider integration

## [0.6.0] - 2026-05-31

### Added

- Visual Git management: status, commit, diff, branch, push, pull, clone
- File CRUD operations: create, delete, rename, move, copy, upload, download
- Markdown file preview with syntax highlighting
- File context menu with path copy and directory browsing

### Changed

- Production hardening and stability improvements

## [0.5.0] - 2026-05-31

### Added

- Core developer workflow: clone repository, edit files, review changes, push, create PR
- Session change tracking and file snapshot system

## [0.4.0] - 2026-05-31

### Added

- PWA service worker with precaching and navigation fallback
- PWA install prompt with iOS Safari guide
- Badge API integration for notification counts

### Changed

- Brand cleanup from upstream naming

## [0.3.0] - 2026-05-31

### Changed

- Full brand independence from upstream project
- Environment variables renamed with `HAPI_POWER_` prefix

## [0.2.0] - 2026-05-31

### Added

- iOS PWA optimization with keyboard handling and standalone mode support
- Mobile UX with dedicated `/m/*` routes and swipe gestures
- i18n framework with Chinese and English (397+ translation keys)

## [0.1.0] - 2026-05-30

### Added

- Full platform MVP with CLI, Hub, and Web packages
- Multi-agent support: Claude Code, Codex, Gemini, OpenCode, Cursor Agent, Kimi
- Socket.IO-based real-time communication between CLI, Hub, and Web
- React PWA frontend with TanStack Router, TanStack Query, Monaco Editor, xterm.js
- Hub HTTP API (20+ route files) with Hono framework
- SQLite persistence for sessions, messages, and machines
- Change review with file-level approve/reject
- Granular undo at session, step, and file granularity
- Monaco code editor with Shiki syntax highlighting
- Full PTY terminal via xterm.js with WebSocket transport
- E2E encrypted relay tunnel via WireGuard (tunwg)
- Single-file executable build for cross-platform deployment
- Homebrew formula auto-update via GitHub Actions
