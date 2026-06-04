[English](./README.md) | [中文](./README.zh-CN.md)

<p align="center">
  <img src="docs/assets/logo-lockup.svg" alt="Hapi Power" width="400">
</p>

<p align="center">
  <strong>One workbench for every AI coding agent.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/tag/zulinliu/make-hapi-power-again" alt="version">
  <img src="https://img.shields.io/github/license/zulinliu/make-hapi-power-again" alt="license">
  <img src="https://img.shields.io/github/stars/zulinliu/make-hapi-power-again" alt="stars">
</p>

<p align="center">
  <a href="#why-hapi-power">Why</a> ·
  <a href="#features">Features</a> ·
  <a href="#install">Install</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="./CHANGELOG.md">Changelog</a>
</p>

---

## Why Hapi Power?

Most AI coding tools lock you into one agent, one terminal, one machine. Hapi Power gives you a unified workbench where you can switch between Claude Code, Codex, Gemini, and more — anytime, anywhere, on any device.

**Vibe code on your phone.** Review AI agent changes with a swipe, monitor terminal output, and approve or reject file edits — all from your phone. No laptop needed.

**A complete development toolkit in the browser.** Visual Git management, full file operations, Monaco code editor, and custom model provider support with encrypted API keys. Everything you need to code with AI agents, in one place.

**Deploy anywhere in seconds.** Single binary, zero dependencies. Self-host on any server, or run locally with one command.

---

## Screenshots

<p align="center">
  <img src="docs/assets/screenshot-desktop.png" alt="Desktop: Multi-agent workbench" width="720">
</p>

<p align="center">
  <img src="docs/assets/screenshot-mobile.png" alt="Mobile: Swipe to approve changes" height="400">
</p>

---

## Features

**Multi-Agent Orchestration** — Run Claude Code, OpenAI Codex, Google Gemini, Cursor Agent, OpenCode, and Kimi side by side. Switch agents per session, each with its own permission modes — from read-only to autopilot.

**Change Review & Granular Undo** — Every AI file change grouped by conversation turn. Review diffs file by file, approve or reject individually or in bulk. Undo at session, step, or file granularity with impact preview.

**Visual Git + File Management** — Commit, diff, branch, push, pull, and clone from the browser. Browse directory trees, create, rename, move, copy, upload, download, and search files — all via an intuitive context menu.

**Custom Model Providers** — Configure third-party API endpoints, auto-discover available models, and bind providers per session. API keys stored with AES-256-GCM encryption.

**Mobile-First PWA** — Dedicated mobile routes with swipe-to-approve gestures, read-only terminal, and iOS-optimized PWA experience. Review and approve AI agent changes from your phone, anytime, anywhere.

**Single Binary Deploy** — Build a self-contained executable with embedded web assets. One file, full platform, zero dependencies. Deploy on any server in seconds.

<details>
<summary><strong>See all features</strong></summary>

### AI Workflow

**Change Review** — File changes grouped by agent conversation turn. Review diffs file by file, approve or reject individually or in bulk. Context window token usage bar shows how much context your agent has consumed (normal, warning, critical).

**Granular Undo** — Undo at session, step, or file granularity with impact preview. Confirm what will be reverted before executing. Full snapshot history with diff-based rollback.

**Context Monitoring** — Real-time token usage bar with color-coded status (normal, warning, critical) so you know when to compact or start a fresh session.

### Platform

**Custom Model Providers** — Configure third-party API endpoints, auto-discover models via `/v1/models`, and bind providers per session or agent type. AES-256-GCM encrypted key storage.

**Permission Modes** — Each agent supports its own permission modes. Claude: default, acceptEdits, bypassPermissions, plan. Codex: default, read-only, safe-yolo, yolo.

**Mobile-First PWA** — Dedicated `/m/*` routes with swipe gestures for change review, read-only terminal, iOS-optimized install guidance, and offline support via service worker.

**E2E Encrypted Relay** — WireGuard-based secure tunnel for remote CLI-to-Hub connections. Connect with `--relay` — no configuration needed.

**Single Binary Deploy** — Self-contained executable with embedded web assets. Cross-platform builds for macOS (ARM/x64), Linux (ARM/x64), and Windows.

**i18n** — Full Chinese and English interface. Switch languages in settings.

### Chat

**Rich Message Rendering** — GitHub Flavored Markdown, Mermaid diagrams, KaTeX math formulas, and syntax-highlighted code blocks via Shiki.

**Image Paste & Drop** — Paste or drag images directly into chat. Images go directly to the AI agent for visual analysis and code generation.

**Slash Command Autocomplete** — Agent-specific built-in commands (`/compact`, `/clear`, `/plan`, `/stats`, etc.) with inline autocomplete.

**Skill & Plugin Management** — Browse and search the skills.sh marketplace, install and uninstall skills per session. Manage plugins with install and uninstall support. Extend your AI agents without leaving the browser.

</details>

---

## Install

### Download Binary (Recommended)

Download the latest release for your platform from [GitHub Releases](https://github.com/zulinliu/make-hapi-power-again/releases).

### Homebrew (macOS / Linux)

```bash
brew tap zulinliu/hapi-power
brew install hapi-power
```

### Build from Source

Prerequisites: [Bun](https://bun.sh) >= 1.0, Node.js >= 18

```bash
git clone https://github.com/zulinliu/make-hapi-power-again.git
cd make-hapi-power-again
bun install
```

---

## Quick Start

### 1. Start the Hub

```bash
bun run dev
```

Hub runs at `http://localhost:3016`, Web UI at `http://localhost:5173`.

### 2. Connect an AI Agent

```bash
# Claude Code (default)
hapi-power claude

# OpenAI Codex
hapi-power codex

# Google Gemini
hapi-power gemini

# Start hub with E2E encrypted relay
hapi-power hub --relay
```

### 3. Open in Browser

Visit `http://localhost:5173` on your desktop, or open it on your phone for mobile vibe coding.

### 4. Build Single Binary

```bash
bun run build:single-exe
```

---

## Usage

### CLI Commands

| Command | Description |
|---------|-------------|
| `start hub` | Connect to Hub with Claude Code |
| `start codex` | Start Codex mode |
| `start gemini` | Start Gemini mode |
| `start cursor` | Start Cursor Agent mode |
| `start opencode` | Start OpenCode mode |
| `start kimi` | Start Kimi mode |
| `start hub --relay` | Connect via E2E encrypted relay |
| `runner start` | Start background Runner daemon |
| `hub` | Start Hub server |
| `auth` | Manage authentication |

### Environment Variables

**Hub:**

| Variable | Description | Default |
|----------|-------------|---------|
| `HAPI_POWER_LISTEN_PORT` | Hub listen port | `3016` |
| `HUB_TOKEN` | Hub authentication token | — |
| `OPENAI_API_KEY` | Whisper voice transcription | — |
| `VAPID_PUBLIC_KEY` | Web Push public key | — |
| `VAPID_PRIVATE_KEY` | Web Push private key | — |
| `ALLOWED_ORIGINS` | CORS allowed origins | — |
| `DATA_DIR` | Data storage directory | `~/.hapi-power` |

**CLI:**

| Variable | Description | Default |
|----------|-------------|---------|
| `HAPI_POWER_API_URL` | Hub address | `http://localhost:3016` |
| `CLI_API_TOKEN` | CLI authentication token | auto-generated |
| `ANTHROPIC_API_KEY` | Claude API key | — |

### Custom Model Providers

Configure third-party API providers in Settings → API Providers:

1. Add a provider with name, base URL, and API key
2. Click "Discover Models" to auto-detect available models
3. Assign the provider to an agent type (Claude, Codex, Gemini, etc.)
4. Select the provider when creating a new session

API keys are encrypted with AES-256-GCM and never stored in plaintext.

---

## Architecture

```
┌─────────┐  Socket.IO(/cli)  ┌──────────────────┐  REST/SSE  ┌─────────┐
│   CLI   │ ────────────────  │       Hub        │ ────────── │   Web   │
│ (Agent) │                   │ (Hono + Socket.IO)│            │ (React) │
└─────────┘                   └──────────────────┘            └─────────┘
    │                               │       │                       │
    ├─ Agent wrappers               ├─ SQLite persistence          ├─ TanStack Router
    │  (Claude/Codex/Gemini/        ├─ Session cache               ├─ TanStack Query
    │   OpenCode/Cursor/Kimi)       ├─ RPC Gateway                 ├─ Monaco Editor
    ├─ Socket.IO client             ├─ Push notifications          ├─ xterm.js
    └─ RPC handlers                 └─ EventBus                   └─ Socket.IO client
```

Three-layer monorepo connected via Socket.IO and REST/SSE:

1. **CLI** starts an AI agent process and connects to Hub via Socket.IO `/cli` namespace
2. **Hub** persists data to SQLite, broadcasts events via SSE, and routes RPC calls
3. **Web** subscribes to SSE for real-time updates, sends user actions to Hub REST API

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Backend | [Hono](https://hono.dev) + Socket.IO + better-sqlite3 |
| Frontend | [React 19](https://react.dev) + TanStack Router + TanStack Query + Tailwind CSS |
| Code Editor | Monaco Editor + Shiki |
| Terminal | xterm.js + Bun.Subprocess |
| Git | system `git` CLI via RPC |
| Validation | Zod |
| Build | Vite + Bun |
| Realtime | Socket.IO + SSE |

---

## Documentation

- [CLI Reference](./cli/README.md) — commands, configuration, agent setup
- [Hub API Reference](./hub/README.md) — REST endpoints, Socket.IO events
- [Web Architecture](./web/README.md) — routes, components, data flow
- [AGENTS.md](./AGENTS.md) — development guide for contributors and AI agents

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

By contributing, you agree that your code will be licensed under AGPL-3.0 and you have the right to submit it under that license.

---

## License

Hapi Power is licensed under [AGPL-3.0](./LICENSE). What this means:

- **Free to use** — self-host, modify, and run for any purpose
- **Your code is yours** — your own project's code is not affected by this license; using Hapi Power to build your projects does not change your project's license
- **Share changes** — if you modify Hapi Power and offer it as a network service, you must share your modifications under the same license

---

## Acknowledgments

Hapi Power is a modified version of [hapi](https://github.com/twsxtd/hapi) by the twsxtd team. Their work on the agent communication protocol and web UI provided the foundation for this project.

The CLI module includes code derived from [happy-cli](https://github.com/slopus/happy-cli) by Kirill Dubovitskiy, licensed under the MIT License.
