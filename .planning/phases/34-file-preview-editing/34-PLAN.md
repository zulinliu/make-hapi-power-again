---
phase: 34-file-preview-editing
feature_version: Phase 6.0
plan: 01
status: planned
created: 2026-06-06
autonomous: true
skills:
  - gsd-plan-phase
  - SPACE-prd-writer
  - impeccable shape file-preview
source_docs:
  - .planning/phases/34-file-preview-editing/34-PRD.md
  - .planning/phases/34-file-preview-editing/34-UX-SHAPE.md
---

# Phase 6.0 Plan：文件预览 / 编辑实现计划

## Objective

实现 FileManager 的文件预览/编辑闭环：用户从文件列表打开文件，按类型预览，编辑文本/Markdown，保存成功或失败都有明确反馈，Dirty 离开不丢内容。

## Current Code Anchors

| 现有文件 | 用途 | 计划动作 |
|---|---|---|
| `web/src/routes/sessions/file.tsx` | 已有文件页面、Markdown/图片/textarea/diff 雏形 | 收敛为 Phase 6.0 Viewer 主入口，拆组件 |
| `web/src/components/git/GitFilePreview.tsx` | 预览 panel，类型判断，CodeBlock/Image/Markdown 复用 | 抽共享 preview primitives，避免重复逻辑 |
| `web/src/lib/file-utils.ts` | 图片 MIME、二进制、Markdown 判断 | 扩展语言/大小/可编辑判断工具 |
| `web/src/api/client.ts` | read/write file API | 复用，必要时扩展 hash/size 类型 |
| `hub/src/web/routes/git.ts` | `/api/sessions/:id/file` GET/PUT | 复用，必要时扩展 schema/response |
| `cli/src/modules/common/handlers/files.ts` | `ReadFile`/`WriteFile` RPC | 复用，建议返回 hash/size/mtime |
| `web/src/components/FileManager/FileManager.tsx` | 文件行打开入口 | 确认点击文件跳转/打开 Viewer |

## Requirements Mapping

| ID | Requirement | Priority | Source |
|---|---|---:|---|
| FPV-01 | FileManager 文件点击打开 Viewer | P0 | PRD 3.1 |
| FPV-02 | 文本/代码加载和预览 | P0 | PRD 3.2/3.3 |
| FPV-03 | 文本编辑、Dirty、保存 | P0 | PRD 3.4 |
| FPV-04 | 保存失败保留本地内容 + Retry | P0 | PRD 3.4 |
| FPV-05 | Dirty 离开确认 | P0 | PRD 3.8 |
| FPV-06 | Markdown 默认预览，可编辑 | P1 | PRD 3.5 |
| FPV-07 | 图片预览 | P1 | PRD 3.6 |
| FPV-08 | 二进制和大文件保护 | P1 | PRD 3.7 |
| FPV-09 | i18n/a11y/mobile polish | P0 | PRD 3.9 |
| FPV-10 | Tests + quality gates | P0 | PRD 5 |

## Execution Slices

### Slice 1：收敛 Viewer 基础与打开入口

**Goal:** 用户从 FileManager 点击文件后进入统一 Viewer，加载文件并展示基础状态。

**Files likely modified:**

- `web/src/components/FileManager/FileManager.tsx`
- `web/src/routes/sessions/file.tsx`
- `web/src/lib/file-utils.ts`
- `web/src/lib/locales/en.ts`
- `web/src/lib/locales/zh-CN.ts`

**Tasks:**

1. 确认 FileManager `onOpenFile` 跳转到 `/sessions/$sessionId/file?path=<encoded>`。
2. 梳理 `file.tsx` 的 header、loading、error、missing path 状态。
3. 新增或整理 `file.viewer.*` i18n keys。
4. 确保长路径、超长文件名不溢出。
5. 保持 existing `readSessionFile` query key。

**Acceptance:**

- 点击文本文件能打开 Viewer。
- 缺 path / read error / empty file 都有明确状态。
- 移动端 390px 无横向溢出。

### Slice 2：文本编辑 + 保存闭环

**Goal:** 完成 `打开 → 编辑 → Dirty → 保存 → 成功/失败恢复`。

**Files likely modified:**

- `web/src/routes/sessions/file.tsx`
- `web/src/hooks/*` 或 `web/src/components/FileViewer/*`（如拆组件）
- `web/src/lib/query-keys.ts`（如需要）
- `web/src/lib/locales/*`

**Tasks:**

1. 明确 `serverContent` 和 `localContent` baseline。
2. Dirty 判断只基于当前成功加载版本，保存中不覆盖用户输入。
3. Save 按钮 loading，禁止重复提交。
4. 保存成功后更新 baseline、invalidate file query 和 git status/diff query。
5. 保存失败保留 localContent，显示 Retry / Copy content / Discard。
6. 避免使用 `alert()`，改为页面内状态或 toast。

**Acceptance:**

- 保存成功清除 Dirty。
- 保存失败不丢本地内容。
- 连续输入时 query refetch 不覆盖 local dirty 内容。

### Slice 3：Dirty 离开保护

**Goal:** 用户有未保存修改时，关闭/返回/切换文件/刷新前必须确认。

**Files likely modified:**

- `web/src/routes/sessions/file.tsx`
- `web/src/components/FileManager/Dialog.tsx` 或共享 confirm dialog
- `web/src/lib/locales/*`

**Tasks:**

1. 实现内部离开确认：返回按钮、切换模式、切换文件。
2. 实现浏览器 `beforeunload` guard。
3. 如 TanStack Router blocker 可用，接入路由离开；否则先覆盖明确操作入口。
4. 弹窗按钮：Stay / Discard changes。

**Acceptance:**

- Dirty 状态下返回会弹确认。
- Stay 不丢输入。
- Discard 后继续离开。

### Slice 4：Markdown / 图片 / 二进制 / 大文件

**Goal:** 补全类型分支与边界状态。

**Files likely modified:**

- `web/src/lib/file-utils.ts`
- `web/src/routes/sessions/file.tsx`
- `web/src/components/git/GitFilePreview.tsx`（抽共享工具后同步）
- `web/src/lib/locales/*`

**Tasks:**

1. Markdown 默认 Preview，保留 Edit。
2. 图片走 `ImagePreview`，无编辑入口。
3. 二进制展示不可文本预览，提供下载/复制路径。
4. 大文件阈值：先按 1MB 编辑阈值，超过只读并说明。
5. 抽出共享 `getFilePreviewKind()` / `resolveEditableState()`，让 GitFilePreview 和 FilePage 不重复判断。

**Acceptance:**

- `.md` 默认预览。
- `.png/.jpg/.svg` 图片预览。
- 二进制不乱码。
- 大文件不会直接进入编辑 textarea。

### Slice 5：后端响应增强（可选但推荐）

**Goal:** 为冲突检测和大文件判断提供可靠元数据。

**Files likely modified:**

- `shared/src/apiTypes.ts`
- `cli/src/modules/common/handlers/files.ts`
- `hub/src/sync/rpcGateway.ts`（类型可能无需变）
- `web/src/api/client.ts`
- tests

**Tasks:**

1. `FileReadResponse` 增加 `hash?: string`, `size?: number`, `modified?: number`。
2. CLI ReadFile 读取 buffer 后计算 sha256 和 size。
3. Web Save 使用 `expectedHash`，保存成功后更新 hash。
4. hash mismatch 展示 conflict state。

**Acceptance:**

- 保存时 expectedHash 生效。
- 文件被外部改变时不静默覆盖。
- 旧调用保持兼容。

**Scope note:** 如果实现周期紧，Slice 5 可降级为 Phase 6.1，但 Slice 2 必须保证失败不丢内容。

### Slice 6：测试、harden、polish、audit

**Goal:** 按用户要求完成专业质量把关。

**Skills:**

- `gsd-add-tests`
- `gsd-code-review`
- `impeccable harden file-preview`
- `impeccable polish file-preview`
- `impeccable audit file-preview`

**Test targets:**

- `web/src/lib/file-utils.test.ts`
- `web/src/routes/sessions/file.test.tsx` 或抽出 hook/component 的测试
- `cli/src/modules/common/handlers/files.test.ts`（如果扩展 hash/size）
- `shared/src/apiTypes` 类型/contract 测试（如已有方式）

**Quality gates:**

```bash
bun run typecheck
bun run test:web
bun run test:hub
bun run test:cli
bun run build:web
git diff --check
python3 locale parity scan
```

最终发布前再跑：

```bash
bun run test
bun run build
node ~/.codex/gsd-core/bin/gsd-tools.cjs query audit-uat --raw
node ~/.codex/gsd-core/bin/gsd-tools.cjs query audit-open
```

## Risk Register

| Risk | Severity | Mitigation |
|---|---:|---|
| 保存失败覆盖用户输入 | P0 | localContent 与 serverContent 分离，失败不 refetch 覆盖 dirty |
| 大文件卡顿 | P1 | 阈值保护，默认只读/确认加载 |
| 二进制乱码或崩溃 | P1 | base64 decode + binary detection，图片例外 |
| Markdown XSS | P1 | 不启用 raw HTML，使用现有安全 Markdown 渲染 |
| 移动端键盘遮挡保存按钮 | P2 | bottom safe-area action bar 或 sticky toolbar |
| FilePage 与 GitFilePreview 逻辑重复 | P2 | 抽共享 file preview utilities/primitives |
| expectedHash 兼容问题 | P2 | 可选字段，旧调用不传仍可工作 |

## Implementation Order

1. **Slice 1 + 2**：先实现文本垂直闭环。
2. **Slice 3**：补 Dirty 离开保护，防止数据丢失。
3. **Slice 4**：补 Markdown、图片、二进制、大文件。
4. **Slice 5**：有时间则做 hash/size 冲突检测。
5. **Slice 6**：tests + harden + polish + audit。

## Definition of Done

- [ ] PRD 中 P0/P1 状态全部实现或明确降级。
- [ ] 新增 UI 文案全部进入 en/zh-CN locale，parity 通过。
- [ ] 文件保存失败不会丢失本地编辑内容。
- [ ] Dirty 离开确认覆盖主要离开路径。
- [ ] Markdown/图片/二进制/大文件状态均可手动验证。
- [ ] `bun run typecheck` 通过。
- [ ] `bun run test:web` 通过。
- [ ] 相关 CLI/Hub 测试通过。
- [ ] `bun run build:web` 通过。
- [ ] `impeccable audit file-preview` 目标 ≥16/20，建议 18+/20。

## Next Command Recommendation

最直接的下一步执行指令：

```text
/gsd-execute-phase 34 --mvp
```

并在每个实现 slice 后依次跑：

```text
/gsd-add-tests file-preview
/gsd-code-review file-preview
/impeccable harden file-preview
/impeccable polish file-preview
/impeccable audit file-preview
```
