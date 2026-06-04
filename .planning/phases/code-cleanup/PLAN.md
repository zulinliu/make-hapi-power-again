# 功能删减方案 — 代码精简与焦点聚焦

> **目标**: 删除已屏蔽/禁用的功能代码，保持代码库整洁，聚焦核心实用功能，形成生产可用的稳定版本
> **状态**: 规划中，待审批后实施
> **创建日期**: 2026-06-04

---

## 一、功能删减分层决策

### 探索发现的隐藏/禁用功能全景

| # | 功能 | 状态 | 导航入口 | 后端路由 | 代码量估算 |
|---|------|------|----------|----------|-----------|
| 1 | 操作时间线 (Timeline) | 前端隐藏 | 无 | 活跃 | ~900行 |
| 2 | 会话分享 (Share) | 无创建UI | 无创建按钮 | 活跃 | ~700行 |
| 3 | 语音录制 (VoiceRecorder STT) | **活跃** | Composer按钮 | 活跃 | ~100行 |
| 4 | 实时语音 (ElevenLabs) | 隐藏(undefined) | 无 | 活跃 | ~600行 |
| 5 | 白板 (Whiteboard) | 完全隐藏 | 无 | 无 | ~200行 |
| 6 | Skill编排 (Orchestration) | 导航隐藏 | 无(已hidden) | 纯假数据 | ~260行 |
| 7 | 变更审查页 (Changes) | 前端隐藏 | 无 | 活跃 | ~400行 |
| 8 | 撤销页 (Undo) | 前端隐藏 | 无 | 活跃 | ~300行 |
| 9 | 移动端路由 (/m/*) | 无链接入口 | 无 | 无独立后端 | ~400行 |

### 决策分层

#### Tier 1: 确定删除 — 用户确认 + 完全死代码（无依赖风险）

| 功能 | 理由 |
|------|------|
| **白板** | 完全隐藏，零依赖，纯客户端组件 |
| **Skill编排** | 纯假数据，无真实后端逻辑 |
| **移动端路由** | 无导航入口，硬编码中文，独立组件 |

#### Tier 2: 建议删除 — 已知禁用 + 深度隔离（低风险）

| 功能 | 理由 | 风险评估 |
|------|------|----------|
| **操作时间线** | 导航已隐藏，路由/后端/i18n 仍然活跃 | 低 — reducerTimeline.ts 是聊天核心渲染器，不删 |
| **会话分享** | 后端完整但无创建UI，API方法从未调用 | 低 — 后端独立路由，前端仅API client方法 |
| **变更审查页** | 与Timeline同组隐藏，路由注册但不可达 | 低 — 后端独立路由 |
| **撤销页** | 与Timeline同组隐藏，路由注册但不可达 | 低 — 后端独立路由 |

#### Tier 3: 暂不删除 — 需额外确认或存在活跃依赖

| 功能 | 理由 | 状态 |
|------|------|------|
| **语音录制 (STT)** | Composer 中 VoiceRecorderButton **活跃渲染**，用户可能正在使用 | 需确认是否删除 |
| **实时语音 (ElevenLabs)** | `onVoiceToggle={undefined}` 禁用，但 VoiceProvider 包裹整个 App，加载初始化代码 | 建议删除但需谨慎 |

#### Tier 4: 不动 — 活跃基础设施

| 功能 | 理由 |
|------|------|
| Push Notifications | SSE 降级 + Web Push 活跃基础设施 |
| App Badge API | PWA 活跃功能 |
| FileSnapshotStore | DB 层基础设施，多功能共享 |

---

## 二、详细删减清单

### 2.1 白板 — 完全删除

**删除文件:**
- `web/src/components/Whiteboard.tsx` — 完整删除

**修改文件:**
- `web/src/components/SessionChat.tsx`
  - 移除 `import { Whiteboard }` (L29)
  - 移除注释掉的 `whiteboardOpen` state 和 Whiteboard 渲染 (L141-142, L720)
- `web/src/components/SessionActionMenu.tsx`
  - 移除 `onWhiteboard?: () => void` prop (L28)
  - 移除 `WhiteboardIcon` SVG 组件 (L103)
  - 从 `hasSecondaryActions` 中移除 `onWhiteboard` (L152)
- `web/src/lib/locales/en.ts` — 移除 `session.whiteboard` key
- `web/src/lib/locales/zh-CN.ts` — 移除 `session.whiteboard` key

**影响范围:** 零 — 组件从未渲染，无任何活跃调用

---

### 2.2 Skill编排 (Orchestration) — 完全删除

**删除文件:**
- `web/src/routes/orchestration.tsx` — 前端页面（纯展示假数据）
- `hub/src/web/routes/orchestration.ts` — 后端路由（纯假数据）
- `hub/src/web/routes/orchestration.test.ts` — 测试

**修改文件:**
- `web/src/router.tsx`
  - 移除 `import OrchestrationPage` (L51)
  - 移除 `orchestrationRoute` 定义 (L799-801)
  - 从路由树移除 `orchestrationRoute` (L823)
- `hub/src/web/server.ts`
  - 移除 `import { createOrchestrationRoutes }` (L23)
  - 移除路由注册 (L121)

**影响范围:** 零 — 纯假数据，无任何活跃依赖

---

### 2.3 移动端路由 (/m/*) — 完全删除

**删除文件:**
- `web/src/routes/mobile/changes.tsx` — 移动端变更审查
- `web/src/routes/mobile/terminal.tsx` — 移动端终端

**修改文件:**
- `web/src/router.tsx`
  - 移除 `import MobileChangesPage` (L48)
  - 移除 `mobileChangesRoute` 和 `mobileTerminalRoute` 定义 (L765-785)
  - 从路由树移除这两个路由

**影响范围:** 零 — 无任何导航链接指向 /m/* 路由

---

### 2.4 操作时间线 (Timeline) — 删除前端页面+后端路由

**注意:** `web/src/chat/reducerTimeline.ts` 和 `reducerTimeline.test.ts` 是**聊天消息核心渲染器**，与时间线页面功能无关，**不删除**。

**删除文件:**
- `web/src/routes/sessions/timeline.tsx` — 时间线页面
- `hub/src/web/routes/timeline.ts` — 后端时间线路由
- `hub/src/web/routes/timeline.test.ts` — 后端测试

**修改文件:**
- `web/src/router.tsx`
  - 移除 `import TimelinePage` (L46)
  - 移除 `sessionTimelineRoute` 定义 (L753-757)
  - 从 `sessionDetailRoute` 子路由移除 (L817)
- `web/src/api/client.ts`
  - 移除 `getTimeline` 方法 (L779-792)
  - 移除 `getSummaries` 方法 (L794-806)
  - 移除 `createCheckpoint` 方法 (L808-823)
  - 移除 `getCheckpoints` 方法 (L825-837)
- `web/src/lib/locales/en.ts` — 移除 17 个 `timeline.*` keys
- `web/src/lib/locales/zh-CN.ts` — 移除 17 个 `timeline.*` keys
- `hub/src/web/server.ts`
  - 移除 `import { createTimelineRoutes }` (L27)
  - 移除路由注册 (L115)
- `web/src/components/SessionActionMenu.tsx`
  - 移除 `onViewTimeline?: () => void` prop (L26)
  - 移除 `TimelineIcon` SVG 组件 (L87-93)
  - 从 `hasSecondaryActions` 移除 `onViewTimeline` (L152)

**不删除:**
- `web/src/chat/reducerTimeline.ts` — 聊天核心渲染器
- `web/src/chat/reducerTimeline.test.ts` — 聊天渲染测试
- `hub/src/store/fileSnapshotStore.ts` — DB基础设施，Undo/Changes可能间接使用

**影响范围:** 低 — 唯一消费者是前端时间线页面（已隐藏），聊天渲染器独立不受影响

---

### 2.5 会话分享 (Share) — 完整删除

**删除文件:**
- `web/src/routes/share.tsx` — 分享查看页面
- `hub/src/web/routes/share.ts` — 后端分享路由（含 ShareStore DB schema）

**修改文件:**
- `web/src/router.tsx`
  - 移除 `import ShareViewPage` (L50)
  - 移除 `shareViewRoute` 定义 (L787-791)
  - 从路由树移除 (L830)
- `web/src/api/client.ts`
  - 移除 `createShare` 方法 (L933-949)
  - 移除 `getShares` 方法 (L950-963)
  - 移除 `deleteShare` 方法 (L965-970)
  - 移除 `accessShare` 方法 (L971-977)
- `web/src/lib/locales/en.ts` — 移除 18 个 `share.*` keys
- `web/src/lib/locales/zh-CN.ts` — 移除 18 个 `share.*` keys
- `hub/src/web/server.ts`
  - 移除 `import { createShareRoutes }` (L29)
  - 移除公开路由注册 (L102-103)
  - 移除保护路由注册 (L117)

**影响范围:** 低 — 后端完全独立路由，前端 API 方法从未被任何 UI 组件调用

---

### 2.6 变更审查页 (Changes) — 删除前端页面+后端路由

**删除文件:**
- `web/src/routes/sessions/changes.tsx` — 变更审查页面
- `hub/src/web/routes/changeTracking.ts` — 后端路由（如果没有独立于 timeline 的逻辑）
- `hub/src/web/routes/changeTracking.test.ts` — 测试

**修改文件:**
- `web/src/router.tsx`
  - 移除 `import ChangesPage` (L45)
  - 移除 `sessionChangesRoute` 定义 (L749)
  - 从路由树移除
- `hub/src/web/server.ts`
  - 移除 `import { createChangeTrackingRoutes }` (L26)
  - 移除路由注册 (L114)
- `web/src/components/SessionActionMenu.tsx`
  - 移除 `onViewChanges?: () => void` prop (L25)
  - 从 `hasSecondaryActions` 移除 `onViewChanges` (L152)

**影响范围:** 低 — 页面已隐藏，后端路由独立

---

### 2.7 撤销页 (Undo) — 删除前端页面+后端路由

**删除文件:**
- `web/src/routes/sessions/undo.tsx` — 撤销页面
- `hub/src/web/routes/undo.ts` — 后端路由
- `hub/src/web/routes/undo.test.ts` — 测试

**修改文件:**
- `web/src/router.tsx`
  - 移除 `import UndoPage` (L47)
  - 移除 `sessionUndoRoute` 定义 (L761)
  - 从路由树移除
- `hub/src/web/server.ts`
  - 移除 `import { createUndoRoutes }` (L28)
  - 移除路由注册 (L116)
- `web/src/components/SessionActionMenu.tsx`
  - 移除 `onViewUndo?: () => void` prop (L27)
  - 从 `hasSecondaryActions` 移除 `onViewUndo` (L152)

**影响范围:** 低 — 页面已隐藏，后端路由独立

---

### 2.8 语音系统 — 分两部分处理

#### 2.8a 语音录制 (VoiceRecorder STT) — 需用户确认

**当前状态:** VoiceRecorderButton **活跃渲染**在 Composer 中，POST 到 `/api/voice/transcribe` 使用 Whisper。
如果 OPENAI_API_KEY 未配置，录音后会报错。

**如确认删除:**
- 删除 `web/src/components/VoiceRecorder.tsx`
- 修改 `web/src/components/AssistantChat/ComposerButtons.tsx` — 移除 VoiceRecorderButton 和相关 state/logic
- 修改 `web/src/components/AssistantChat/HappyComposer.tsx` — 移除 `onVoiceTranscribed` prop 传递
- 修改 `web/src/components/SessionChat.tsx` — 移除 `onVoiceTranscribed` 回调
- 删除 `hub/src/web/routes/voiceTranscription.ts` — Whisper 转录路由
- 修改 `hub/src/web/server.ts` — 移除 voiceTranscription 路由注册

#### 2.8b 实时语音 (ElevenLabs) — 建议删除

**当前状态:** `onVoiceToggle={undefined}` 禁用，但 VoiceProvider 包裹整个 App，RealtimeVoiceSession 条件渲染。

**如确认删除:**
- 删除 `web/src/realtime/` 整个目录 (8文件)
- 删除 `web/src/lib/voice-context.tsx`
- 删除 `web/src/components/VoiceErrorBanner.tsx`
- 删除 `web/src/lib/voices.ts` + `voices.test.ts`
- 删除 `web/src/lib/languages.ts` (ElevenLabs 语言映射，需确认是否有其他消费者)
- 删除 `hub/src/web/routes/voice.ts` + `voice.test.ts`
- 修改 `web/src/App.tsx` — 移除 VoiceProvider 包裹 + VoiceErrorBanner
- 修改 `web/src/components/SessionChat.tsx` — 移除 voice hooks + RealtimeVoiceSession
- 修改 `web/src/routes/settings/index.tsx` — 移除语音设置区域
- 修改 `web/vite.config.ts` — 移除 vendor-voice chunk
- 删除 `shared/src/voice.ts` — 共享协议
- 修改 `shared/package.json` — 移除 voice export
- 移除相关 i18n keys (voice.*, settings.voice.*)

---

## 三、SessionActionMenu 统一清理

完成所有删减后，`SessionActionMenu.tsx` 需要统一清理：
- 移除所有死 prop：onViewChanges, onViewTimeline, onViewUndo, onWhiteboard
- 移除对应的 Icon 组件：TimelineIcon, WhiteboardIcon 等
- 简化 `hasSecondaryActions` 检查，只保留活跃的 onViewGit, onViewExtensions, onOpenOutline
- 移除 `// Changes/Timeline/Undo/Whiteboard hidden` 注释

---

## 四、预估删减量

| 功能 | 删除文件 | 修改文件 | 预估删减行数 |
|------|---------|---------|------------|
| 白板 | 1 | 3 | ~200行 |
| Skill编排 | 3 | 2 | ~260行 |
| 移动端路由 | 2 | 1 | ~400行 |
| 时间线 | 3 | 6 | ~900行 |
| 会话分享 | 2 | 5 | ~700行 |
| 变更审查 | 3 | 3 | ~400行 |
| 撤销页 | 3 | 3 | ~300行 |
| 语音(2.8a) | 2 | 4 | ~200行 |
| 语音(2.8b) | 12 | 6 | ~800行 |
| **总计(不含语音)** | **17** | **23** | **~3160行** |
| **总计(含语音)** | **31** | **33** | **~4160行** |

---

## 五、实施顺序与风险控制

### 实施顺序（由低风险到高风险）

1. **白板** — 零依赖，最安全
2. **Skill编排** — 纯假数据，零依赖
3. **移动端路由** — 无导航入口
4. **变更审查页** — 后端独立
5. **撤销页** — 后端独立
6. **操作时间线** — 需注意不误删 reducerTimeline
7. **会话分享** — 后端+前端全删
8. **SessionActionMenu 统一清理** — 汇总清理
9. **语音录制 STT** — 需用户确认
10. **实时语音 ElevenLabs** — 最复杂，最后处理

### 质量门禁

每个功能删减后立即执行：
1. `pnpm typecheck` — 类型检查通过
2. `pnpm test` — 全部测试通过（删除测试文件后剩余测试通过）
3. `pnpm build` — 构建成功
4. 浏览器验证核心流程不受影响

### 安全保障

- 每个功能**独立 commit**，不混合
- 如发现问题，`git revert` 单个 commit 即可回退
- 不删除任何**共享基础设施**代码（FileSnapshotStore、reducerTimeline 等）
- 不修改任何**活跃功能**的核心逻辑

---

## 六、待用户确认

1. **语音录制 (STT VoiceRecorder)**: Composer 中的录音按钮目前是活跃的，是否一并删除？
2. **实时语音 (ElevenLabs)**: 整个实时语音系统（VoiceProvider、realtime/ 目录、语音设置），是否删除？
3. **变更审查页 + 撤销页**: 这两个功能虽然导航隐藏但后端完整，删除后如需恢复需重新实现。是否确认删除？
4. **实施节奏**: 是否按上述10步顺序逐步执行，还是分批（如先做1-7，语音后做）？
