# 品牌残留全面扫描报告

> 日期: 2026-05-31
> 范围: web/、hub/、cli/、shared/ 全量扫描

## 问题概述

v0.3 做了品牌独立升级（hapi → hapi-power），但用户实际体验发现仍有大量遗漏：
- 设置页面显示 "hapi.run" 作为官方网站
- APP_VERSION 仍为上游的 "0.18.4"
- 协议头仍为 "X-Hapi-Protocol-Version"
- 登录页 footer 显示 "HAPI"
- Hub 启动 banner 为 "HAPI Hub"
- CLI 系统提示词中多处 "HAPI" 品牌名
- 15 个 localStorage key 使用旧 "hapi-" 前缀

## 统计

| 类别 | 数量 | 优先级 |
|------|------|--------|
| URL 残留 (hapi.run) | 4 | P0 |
| 品牌名 "HAPI" 残留 (用户可见 UI) | 10 | P0 |
| 版本号不匹配 (0.18.4 vs 0.3.0) | 1 | P0 |
| Hub HTML banner | 2 | P0 |
| 协议头 X-Hapi-* | 1 | P1 |
| CLI 系统提示词/注释/日志 | ~40 | P1 |
| shared/ 注释和字符串 | 5 | P1 |
| localStorage key 未统一 | 15 | P1 |
| 测试文件 | ~8 | P1 |
| 文档 (cli/README.md, runner/README.md) | ~20 | P2 |
| .gitignore / .npmignore | 2 | P2 |
| **合计** | **~88** | |

## P0 用户可见问题（必须修复）

### 1. 设置页面 — 官方网站
- `web/src/routes/settings/index.tsx:1088-1093` — href="YOUR_DOMAIN", 文本 "hapi.run"

### 2. 登录页 footer
- `web/src/components/LoginPrompt.tsx:234` — `{new Date().getFullYear()} HAPI`

### 3. i18n 翻译文件
- `web/src/lib/locales/en.ts:30` — "Set hapi hub origin..."
- `web/src/lib/locales/en.ts:332` — "HAPI remote mode..."
- `web/src/lib/locales/zh-CN.ts:30` — "设置 HAPI 服务器地址"
- `web/src/lib/locales/zh-CN.ts:334` — "HAPI 远程模式暂不支持"

### 4. 版本号
- `shared/src/buildInfo.ts:1` — APP_VERSION = "0.18.4"（应为 "0.4.0"）

### 5. Hub HTML banner
- `hub/src/web/server.ts:128-130` — `<title>HAPI Hub</title>`, `<h1>HAPI Hub</h1>`

### 6. Runner 启动文本
- `cli/src/runner/run.ts:727` — "Hapi runner started."

## P1 代码质量问题

### CLI 系统提示词（影响 AI 行为）
- `cli/src/claude/utils/systemPrompt.ts` — 3 处 "HAPI"
- `cli/src/opencode/utils/systemPrompt.ts` — 2 处 "HAPI"
- `cli/src/opencode/utils/hookPlugin.ts` — 5 处 "HAPI"
- `cli/src/claude/utils/startHappyServer.ts` — 4 处 "HAPI"

### CLI 日志/注释
- `cli/src/runner/doctor.ts` — 4 处
- `cli/src/utils/autoStartServer.ts` — 3 处
- `cli/src/utils/spawnHappyCLI.ts` — 5 处
- `cli/src/runner/run.ts` — 2 处
- `cli/src/commands/claude.ts` — 1 处

### Hub
- `hub/src/web/routes/cli.ts:61` — X-Hapi-Protocol-Version
- `hub/scripts/cleanup-sessions.ts:122` — ~/.hapi 路径回退（高危）
- `hub/src/configuration.ts:22` — 注释中 ~/.hapi

### Shared
- `shared/src/slashCommands.ts:18`
- `shared/src/effort.ts:2`
- `shared/src/voice.ts` — 4 处

### localStorage keys（15 个）
- hapi:composer-drafts, hapi.sessionLastSeen.v1, hapi-recent-skills
- hapi:message-window:v1:, hapi-file:, hapi-lang
- hapi-composer-enter-behavior, hapi-terminal-font-size
- hapi-session-list-status-mode, hapi-sidebar-width
- hapi-terminal-tool-display-mode, hapi-tool-group-bg
- hapi-user-message-bg, hapi-session-preview-limit
- hapi:recentPaths

## 修复策略

### Phase A: 核心品牌替换（sed 批量）
使用 sed/replace_all 进行机械替换：
- "HAPI Hub" → "HapiPower Hub"
- X-Hapi- → X-HapiPower-
- APP_VERSION 版本号更新

### Phase B: 逐文件审查替换
无法用 sed 简单替换的上下文相关替换（i18n、系统提示词、localStorage 迁移逻辑）

### Phase C: localStorage 迁移
在应用启动时添加一次性迁移逻辑，检测旧 key → 读取值 → 写入新 key → 删除旧 key

### Phase D: 验证
- typecheck 通过
- grep 零残留确认
- 真机 UI 验证
