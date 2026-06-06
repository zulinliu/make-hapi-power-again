---
phase: 35-v0.17-file-manager-production
document: PLAN
version: v0.17.0
created: 2026-06-06
status: active
autonomous: true
---

# Plan: v0.17.0 全功能文件管理器生产化

## 总体策略

先修架构断点，再补操作闭环，最后做编辑、传输和质量门禁。每个阶段独立提交，提交前运行对应测试，并更新 `35-SELF-REVIEW.md`。

## Phase 35.0: 规划和 Git 基线

**目标**: 固化 v0.17 文件管理器专项方案，纠正文档状态高估，建立执行清单。

**交付物**:

- `35-CONTEXT.md`
- `35-PRD.md`
- `35-UX-SHAPE.md`
- `35-PLAN.md`
- `35-SELF-REVIEW.md`
- `.planning/ROADMAP.md` v0.17 Phase 35 条目
- `.planning/ROADMAP-filemanager.md` v0.17 生产化章节

**验收**:

- 文档覆盖用户提出的 5 个问题。
- 阶段拆分可执行。
- Git commit 符合 `GIT-STANDARDS.md`。

## Phase 35.1: 统一数据源接口和导航基础

**目标**: 引入文件管理数据源接口，让 UI 不再直接绑定 sessionId。先补显性上一级、文件打开兜底和隐藏文件参数链路。

**计划修改**:

- `web/src/components/FileManager/types.ts`
- `web/src/components/FileManager/FileManager.tsx`
- `web/src/lib/file-manager-api.ts`
- `web/src/api/client.ts`
- `shared/src/apiTypes.ts`
- `shared/src/schemas.ts`
- `hub/src/web/routes/machines.ts`
- `cli/src/api/apiMachine.ts`

**任务**:

1. 为 machine list API 增加 `showHidden?: boolean`。
2. 移除 CLI machine list 中无条件过滤 dotfile 的逻辑。
3. FileManager 工具栏增加显性上一级按钮。
4. FileManager 点击文件在无 sessionId 时进入全局预览占位路由或打开内联 preview 状态，不能静默无动作。
5. 创建 `FileManagerMode` 或 `FileManagerDataSource` 类型，为后续 CRUD 统一做准备。

**验收**:

- `/browse` 显示隐藏文件开关真实生效。
- `/browse` 有上一级按钮。
- 点击文件至少有明确打开反馈，不再无动作。
- `bun run typecheck` 和相关测试通过。

## Phase 35.2: Machine 文件 CRUD API

**目标**: 让 `/browse` 无需活动会话即可执行基础 CRUD。

**计划修改**:

- `shared/src/rpcMethods.ts`
- `shared/src/apiTypes.ts`
- `shared/src/schemas.ts`
- `cli/src/api/apiMachine.ts`
- `hub/src/web/routes/machines.ts`
- `hub/src/sync/rpcGateway.ts`
- `hub/src/sync/syncEngine.ts`
- `web/src/api/client.ts`
- `web/src/lib/file-manager-api.ts`

**任务**:

1. 增加 machine 文件操作 RPC 方法。
2. 实现 workspaceRoots 内路径校验，覆盖绝对路径、相对路径、符号链接、URL 编码、空字节。
3. 实现 create file、mkdir、delete、rename、copy、move。
4. Web API client 增加 machine file methods。
5. FileManager 根据 mode 选择 machine 或 session 操作。

**验收**:

- `/browse` 新建、重命名、删除、移动、复制真实可用。
- 越界路径被拒绝。
- 文件已存在时不静默覆盖。
- CLI/Hub 测试覆盖主要路径。

## Phase 35.3: UI 行为收敛和去空壳

**目标**: 删除重复和不可用入口，形成一致的操作模型。

**计划修改**:

- `web/src/components/FileManager/*`
- `web/src/routes/sessions/files.tsx`
- `web/src/components/SessionFiles/DirectoryTree.tsx` 或替换为统一 FileManager
- `web/src/lib/locales/en.ts`
- `web/src/lib/locales/zh-CN.ts`

**任务**:

1. 新建入口收敛为单一 New action，支持文件和文件夹。
2. 移除 unavailable toast，对未支持操作隐藏或禁用并说明原因。
3. 会话文件页复用统一 FileManager 当前目录列表。
4. 保留 Git changes tab，但 directory tab 使用统一文件管理体验。
5. 批量操作栏只显示真实可执行动作。

**验收**:

- 用户不会看到“下一阶段提供”或无意义 unavailable action。
- 新建文件/文件夹所有入口行为一致。
- `/browse` 和 session files 的基础操作一致。

## Phase 35.4: 预览编辑生产化

**目标**: 建立全局和会话通用的文件打开、预览、编辑和保存冲突安全闭环。

**计划修改**:

- `web/src/routes/sessions/file.tsx`
- 新增 `web/src/components/FileViewer/*` 或 `web/src/components/FileManager/FilePreviewPane.tsx`
- `cli/src/modules/common/handlers/files.ts`
- `cli/src/api/apiMachine.ts`
- `shared/src/apiTypes.ts`

**任务**:

1. read file 返回 `content`, `hash`, `size`, `modified`。
2. save file 默认传 `expectedHash`。
3. 冲突时显示 reload、copy local、force overwrite。
4. Markdown、图片、二进制、大文件状态统一。
5. Monaco 路由级懒加载接入，保留 textarea fallback。

**验收**:

- 保存不会静默覆盖外部修改。
- 保存失败不丢本地内容。
- 全局和会话模式都能打开文件。

## Phase 35.5: 上传下载和搜索

**目标**: 补齐生产文件流转能力。

**任务**:

1. 单文件上传到当前目录。
2. 上传进度和失败重试。
3. 单文件下载。
4. 文件名搜索。
5. 内容搜索复用 ripgrep 或新增 machine search RPC。

**验收**:

- 上传下载不再是占位。
- 文件名搜索可在大目录中使用。
- 移动端操作可见。

## Phase 35.6: 测试、自审、发布准备

**目标**: 关闭回归风险，准备 v0.17 发布。

**任务**:

1. 新增 CLI machine file handler 测试。
2. 新增 Hub route 测试。
3. 新增 FileManager 行为测试。
4. 新增 i18n parity 扫描。
5. 运行完整质量门禁。
6. 更新 release checklist。

**验收命令**:

```bash
bun run typecheck
bun run test:shared
bun run test:web
bun run test:hub
bun run test:cli
bun run test
bun run build
git diff --check
```

## 自主推进规则

1. 每个 phase 完成后更新 `35-SELF-REVIEW.md`。
2. 每个 phase 至少一个 Git commit。
3. 提交信息使用中文，禁止 Co-Authored-By 和第三方品牌残留。
4. 如发现 P0 架构阻塞，先修架构，不做 UI 补丁掩盖。
5. 用户明确反馈的问题优先级高于历史规划中的“已完成”标记。

