# GSD Phase Record: v0.12.0 功能精简与代码删减

> **Phase**: v0.12.0
> **状态**: ✓ 已完成 (2026-06-04)
> **Commits**: bdcc220 (55 files, -8999/+411) + f58c8ae (5 files, -43/+7)
> **目的**: 删除已屏蔽/禁用的非核心功能代码，聚焦核心实用功能

---

## 一、完成流程（GSD 标准删减流程）

> **后续迭代参考此流程执行功能删减任务。**

### Step 1: 深度探索发现 — 自主发现所有候选删减项

**方法：** 启动 4 个并行探索 agent，从不同维度扫描代码库
- Agent A: 前端路由分析 — 检查所有 router.tsx 注册的路由，找出无导航入口的
- Agent B: 后端路由分析 — 检查 hub server.ts 注册的路由，找出无前端消费者的
- Agent C: 组件活性分析 — 检查 components/ 中的组件是否被 import 和渲染
- Agent D: i18n 孤儿分析 — 检查 locale 文件中无代码引用的 key

**已知输入：** 用户已告知的 4 个功能（时间线、会话分享、语音录制、白板）
**自主发现：** 通过探索额外发现 5 个候选（Skill编排、移动端路由、变更审查、撤销、实时语音）

### Step 2: 依赖分析评审 — 启动多个专业子代理评审

**方法：** 启动 3 个并行 review agent
- Reviewer A: 跨模块依赖分析 — 确认删除不会破坏其他功能
- Reviewer B: 基础设施影响分析 — 区分"功能代码"和"共享基础设施"
- Reviewer C: 安全风险评估 — 检查删除是否引入安全漏洞

**关键发现：**
- `reducerTimeline.ts` 是聊天核心渲染器，与时间线页面无关 — **必须保留**
- `FileSnapshotStore` 是 DB 层基础设施 — **必须保留**
- VoiceRecorder 有两套实现（standalone 死代码 + ComposerButtons 内联活跃代码） — **需合并处理**

### Step 3: 方案制定 — 分层决策 + 风险分级

根据评审结果制定删减方案（见 PLAN.md），按风险分 4 级：
- **Tier 1** (确定删除): 白板、Skill编排、移动端路由 — 零依赖风险
- **Tier 2** (建议删除): 时间线、会话分享、变更审查、撤销 — 低风险
- **Tier 3** (需确认): 语音录制、实时语音 — 有活跃代码路径
- **Tier 4** (不动): Push Notifications、Badge API、FileSnapshotStore — 活跃基础设施

### Step 4: 实施 — 按风险从低到高逐项执行

实施顺序：白板 → 编排 → 移动端 → 变更 → 撤销 → 时间线 → 分享 → 语音(统一)

**原则：**
- 每项功能独立处理，避免交叉影响
- 先删前端页面+路由，再删后端路由，最后清理 API client + i18n
- 语音系统因为 2.8a/2.8b 存在交叉依赖，合并为统一删除步骤

### Step 5: 实施后审计 — 多维度验证

启动 3 个并行审计 agent：
- Auditor A: 遗漏检查 — 是否还有应删未删的代码
- Auditor B: 误删检查 — 是否有错误删减导致功能不可用
- Auditor C: 文档一致性 — AGENTS.md、README 等是否还引用已删除功能

**发现并修复：**
- AGENTS.md 仍有 12 处引用已删除功能 → 已清理
- web/README.md 功能描述过时 → 已更新
- vite.config.ts 有 vendor-pdf 死代码 → 已清理
- i18n 有 1 个孤立键 session.action.copy → 已清理

### Step 6: 质量门禁

```
✓ typecheck: 通过
✓ vitest: 77 文件 651 测试全部通过
✓ build: 成功
✓ 服务启动: Hub + Web + Runner 三服务正常
```

### Step 7: 文档更新 — 防止后续迭代误解

更新以下文档，确保未来 AI agent 不会误读：
- `PROJECT.md` — 已删除功能标记 `[x] ~~删除线~~`，新增活跃功能清单
- `STATE.md` — 新增"当前活跃功能清单"表格
- `NEXT-ROADMAP.md` / `ROADMAP-V2.md` / `REQUIREMENTS-v9.md` — 删除线标注
- `REQUIREMENTS.md` — MOB 需求标注
- `phases/v9.1*/v9.2*` (6个) — 开头添加废弃警告

---

## 二、删减结果

### 已删除功能 (9 项)

| # | 功能 | 删除范围 | 删除文件数 | 原因 |
|---|------|---------|-----------|------|
| 1 | 白板 (Whiteboard) | 组件 + SessionChat 引用 + i18n | 1 | 完全隐藏，从未渲染 |
| 2 | Skill编排 (Orchestration) | 前端页面 + 后端路由(假数据) + 测试 | 3 | 纯假数据，无真实后端 |
| 3 | 移动端路由 (/m/*) | 2 个页面 + 路由注册 | 2 | 无导航入口，硬编码中文 |
| 4 | 变更审查页 (Changes) | 前端页面 + 后端路由 + API方法 + i18n | 3 | 导航隐藏，后端独立 |
| 5 | 撤销页 (Undo) | 前端页面 + 后端路由 + API方法 + i18n | 3 | 导航隐藏，后端独立 |
| 6 | 操作时间线 (Timeline) | 前端页面 + 后端路由 + API方法 + i18n | 3 | 导航隐藏，reducerTimeline保留 |
| 7 | 会话分享 (Share) | 前端页面 + 后端路由(含DB) + API方法 + i18n | 2 | 后端完整但无创建UI |
| 8 | 语音录制 STT (Whisper) | VoiceRecorder + 后端转录路由 | 2 | 外部API依赖，非核心 |
| 9 | 实时语音 (ElevenLabs) | realtime/ 目录 + VoiceProvider + 语音设置 + 后端路由 + 共享协议 | ~21 | onVoiceToggle=undefined 禁用 |

### 代码变更统计

- **删除文件**: ~40 个
- **修改文件**: ~25 个
- **删除 i18n 键**: 103 个 (en + zh-CN)
- **移除 npm 依赖**: @elevenlabs/react
- **净删减**: ~4000+ 行

### 保留的基础设施（不删除）

| 基础设施 | 原因 | 文件 |
|---------|------|------|
| `reducerTimeline.ts` + `.test.ts` | 聊天消息核心渲染器，与时间线页面无关 | `web/src/chat/` |
| `FileSnapshotStore` | DB Schema 基础设施，保留兼容 | `hub/src/store/` |
| `file_snapshots` 表 | DB 表创建逻辑在 Store schema 中 | `hub/src/store/db.ts` |
| Push Notifications | 活跃 PWA 基础设施 | `hub/src/notifications/` |
| App Badge API | 活跃 PWA 功能 | `web/src/` |
| ServerChan / Telegram Bot | 活跃通知渠道 | `hub/src/` |

---

## 三、当前活跃功能清单

> **后续迭代以本清单为准，不要从早期文档推断功能范围。**

| # | 功能 | 代码入口 | 状态 |
|---|------|---------|------|
| 1 | 会话管理 | `web/src/routes/sessions/` | ✓ 活跃 |
| 2 | AI 多代理聊天 | `web/src/components/SessionChat.tsx` | ✓ 活跃 |
| 3 | 文件管理 + Monaco Editor | `web/src/routes/sessions/files.tsx` | ✓ 活跃 |
| 4 | Git 管理 | `web/src/routes/sessions/git.tsx` | ✓ 活跃 |
| 5 | PTY 终端 | `web/src/routes/sessions/terminal.tsx` | ✓ 活跃 |
| 6 | 扩展系统 | `web/src/routes/sessions/extensions.tsx` | ✓ 活跃 |
| 7 | 供应商配置 | `web/src/routes/settings/` | ✓ 活跃 |
| 8 | 图片上传 | `web/src/components/ImagePasteDrop.tsx` | ✓ 活跃 |
| 9 | 推送通知 | `hub/src/notifications/` | ✓ 活跃 |
| 10 | PWA | `web/src/sw.ts` + `web/src/main.tsx` | ✓ 活跃 |
| 11 | i18n | `web/src/lib/locales/` | ✓ 活跃 |

---

## 四、经验教训

### 1. 功能隐藏 ≠ 功能可删
- 导航隐藏的功能可能有后端依赖（如 Share 有完整后端+DB表）
- 删除前必须做跨模块依赖分析

### 2. 名称相似 ≠ 功能相同
- `reducerTimeline.ts` 是聊天渲染器，与时间线页面功能完全不同
- `FileSnapshotStore` 是 DB 层基础设施，不仅服务于已删除的 Undo 功能

### 3. 一处功能可能有多处代码
- VoiceRecorder 有两套实现：standalone 组件（死代码）+ ComposerButtons 内联（活跃）
- 删除时需统一处理，不能只删一部分

### 4. 实施后审计必须有
- 首次实施后仍残留：AGENTS.md 引用、vite vendor chunk、i18n 孤立键
- 多维度审计（遗漏、误删、文档）才能确保完整

### 5. 文档同步是持续性约束
- 不仅更新代码，还要更新 PROJECT.md、STATE.md、ROADMAP、REQUIREMENTS
- 用 `~~删除线~~` + 原因标注，不要直接删除历史记录
- 未来 agent 读到删除线就知道这些功能已不在代码库中

---

## 五、后续版本补丁

### v0.12.1 — Tab 切换自动刷新修复 (2026-06-05)

Phase 19 (PWA 更新机制) 引入的三个叠加问题已修复：
1. `main.tsx` visibilitychange 节流：仅离开 >5 分钟后切回才检查更新
2. `sw.ts` 移除 SKIP_WAITING 内的 activate listener 累积 bug
3. 确认 workbox-window registerType:'prompt' 无自动 reload

质量门禁: typecheck ✓ | vitest 651/651 ✓ | build ✓

---
*Phase record created: 2026-06-05*
*Based on: .planning/phases/code-cleanup/PLAN.md (original plan)*
