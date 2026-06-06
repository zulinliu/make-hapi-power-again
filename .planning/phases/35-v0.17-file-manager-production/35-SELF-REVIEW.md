---
phase: 35-v0.17-file-manager-production
document: SELF-REVIEW
version: v0.17.0
created: 2026-06-06
status: active
---

# Self Review: v0.17.0 文件管理器生产化

## Review Protocol

每个阶段完成后补充一节，必须回答：

1. 本阶段目标是否达成。
2. 用户原始 5 个问题中哪些被解决。
3. 是否引入新的空壳入口。
4. 是否有会话模式和全局模式行为不一致。
5. 是否满足移动端触控和可访问性基本要求。
6. 运行了哪些质量门禁。
7. 剩余风险和下一阶段动作。

## Phase 35.0 Review: 规划和 Git 基线

**状态**: 进行中。

### 目标

落地 v0.17.0 文件管理器专项方案，将此前代码审计结论转为可执行 PRD、UX Shape、阶段计划和自审机制。

### 覆盖用户反馈

| 用户问题 | 规划覆盖 |
|---|---|
| 没有返回上一级 | Phase 35.1 P0 |
| 新建文件/文件夹入口冗余 | Phase 35.3 P0 |
| 显示隐藏文件不可用 | Phase 35.1 P0 |
| 大量功能不可用或占位 | Phase 35.2、35.3、35.5 P0/P1 |
| 文件编辑入口不清晰，点击文件无反应 | Phase 35.1、35.4 P0/P1 |

### 当前风险

1. 历史规划文档把部分未完全落地功能标为完成，后续验收必须以代码和手动验证为准。
2. machine 文件操作需要严格 workspaceRoots 安全边界，不能直接复用 session validatePath 而忽略根目录策略。
3. Monaco 接入可能放大 bundle 和编辑状态复杂度，需要路由级懒加载和 fallback。

### 下一步

1. 更新 roadmap。
2. 提交 Phase 35.0 文档。
3. 开始 Phase 35.1 实现。

## Phase 35.1 Review: 导航、隐藏文件和文件打开反馈

**状态**: 完成。

### 本阶段交付

1. machine list directory 请求增加 `showHidden` 参数。
2. CLI machine list handler 不再无条件过滤 dotfile，只有 `showHidden !== true` 时过滤隐藏项。
3. Web FileManager 继续按前端状态刷新目录，隐藏文件开关现在能触达后端。
4. FileManager 工具栏增加显性“返回上一级”按钮，根路径禁用。
5. FileManager 增加 `FileManagerMode`，为后续 machine/session 数据源收敛打基础。
6. 全局模式点击文件不再静默无动作，会给出明确反馈。
7. 移除 `fm.toast.unavailableAction` 中“下一阶段提供”的表达，避免继续暴露空壳式文案。

### 用户反馈覆盖

| 用户问题 | 状态 | 说明 |
|---|---|---|
| 没有返回上一级 | 已解决 | 工具栏新增显性上一级按钮 |
| 显示隐藏文件不可用 | 已解决基础链路 | machine API、Hub、CLI、Web 均支持 showHidden |
| 点击文件无反应 | 已改善 | 不再静默，后续 35.4 接入真实全局预览编辑 |
| 新建入口冗余 | 未解决 | 进入 35.3 |
| CRUD 大量不可用 | 未解决 | 进入 35.2 和 35.3 |

### 是否引入新空壳入口

没有新增空壳按钮。文件点击反馈仍是过渡能力，已标记进入 35.4 完成真实全局预览编辑。

### 全局和会话一致性

- 隐藏文件开关目前只覆盖全局 FileManager。
- session files 仍未统一到 FileManager core，后续 35.3 收敛。

### 质量门禁

```bash
bun run typecheck
# PASS

bun run test:shared
# PASS: 37 tests

cd hub && bun test src/sync/rpcGateway.test.ts
# PASS: 2 tests

bun run test:web
# PASS: 78 files, 669 tests

git diff --check
# PASS
```

### 剩余风险

1. machine CRUD 仍未实现，`/browse` 新建、删除、重命名等仍需要 35.2 处理。
2. 全局文件预览仍未真实接入，需 machine read API 和统一 viewer。
3. 上一级按钮以 initialPath 作为 root 边界，后续多 workspace root 切换时需要联动 root selector。

## Phase 35.2 Review: Machine 文件 CRUD API

**状态**: 完成。

### 本阶段交付

1. CLI machine client 覆盖 common file handlers，注册 workspaceRoots 受限的 `ReadFile`、`WriteFile`、`DeleteFile`、`RenameFile`、`CopyFile`、`MoveFile`、`CreateDirectory`。
2. Machine `readFile` 返回 `content`、`hash`、`size`、`modified`，为后续预览编辑冲突检测打底。
3. Machine `writeFile` 默认拒绝覆盖已有文件，支持 `expectedHash` 安全保存和显式 `forceOverwrite`。
4. Machine CRUD 路径统一经过 workspaceRoots containment，拒绝相对路径、null byte、workspace 外路径和符号链接逃逸。
5. Hub SyncEngine/RpcGateway 增加 machine 文件操作转发方法。
6. Hub `/api/machines/:id` 增加 machine 文件 REST API：读、写、删、重命名、复制、移动、建目录。
7. Web ApiClient 增加 machine file methods。
8. FileManager 的新建文件、新建文件夹、删除、批量删除、重命名在无 `sessionId` 时已走 machine API，不再要求活动会话。
9. 新增 CLI machine file operation 测试，覆盖隐藏文件、读写删、越界拒绝、mkdir/copy/move/rename、hash 冲突、force 覆盖、相对路径、null byte、符号链接逃逸。
10. 新增 Hub machine file route 测试，覆盖 REST route 转发和无效 payload 拒绝。

### 用户反馈覆盖

| 用户问题 | 状态 | 说明 |
|---|---|---|
| 除浏览和新建会话外，其他功能几乎不可用 | 部分解决 | `/browse` 新建、删除、重命名、批量删除已可在 machine mode 工作；移动、复制 UI 待 35.3 接入 |
| 新建文件/文件夹提示没有活动会话 | 已解决基础链路 | 无 `sessionId` 时调用 machine write/mkdir |
| 删除、重命名提示没有活动会话 | 已解决基础链路 | 无 `sessionId` 时调用 machine delete/rename |
| 显示隐藏文件不可用 | 已保持解决 | 35.1 链路继续由测试覆盖 |
| 文件点击无反应和编辑入口不清晰 | 未完全解决 | 35.2 提供 machine read API，真实 preview/edit 进入 35.4 |

### 是否引入新空壳入口

没有新增空壳入口。本阶段只把已有基础 CRUD 入口接到真实 machine API。移动、复制、上传、下载仍未接 UI，必须在 35.3 隐藏/禁用占位或接入真实能力。

### 全局和会话一致性

- 全局 `/browse` 的 create/delete/rename 已与 session mode 的基础行为对齐。
- 会话文件页仍是旧 `/sessions/:id/files` 页面，未复用统一 FileManager core，属于 35.3。
- Machine copy/move API 已具备，但 FileManager 右键和批量栏尚未调用，属于 35.3。

### 移动端触控和可访问性

本阶段主要是后端和 API 链路，未新增移动端小触控目标。既有 FileManager toolbar、context menu、dialog 的触控目标和 focus-visible 样式保持不变。

### 质量门禁

```bash
bun run typecheck
# PASS

cd cli && bun test src/api/apiMachine.fileOperations.test.ts
# PASS: 6 tests

cd hub && bun test src/web/routes/machines.test.ts src/sync/rpcGateway.test.ts
# PASS: 8 tests

bun run test:shared
# PASS: 37 tests

bun run test:web
# PASS: 78 files, 669 tests

git diff --check
# PASS
```

### 剩余风险

1. Machine API 已可复制/移动，但 UI 仍显示 unavailable toast，下一阶段必须接入或隐藏。
2. 上传、下载仍是占位入口，不能在 v0.17 最终状态保留。
3. 全局文件点击仍未真实打开预览编辑，需 35.4 使用 machine read/write/hash API 接入。
4. 会话文件页仍与全局 FileManager 割裂，35.3 必须收敛操作模型。
5. session common read handler 还未返回 `hash/size/modified`，35.4 需要补齐以实现统一冲突检测。

## Phase 35.3 Review: UI 行为收敛和去空壳

**状态**: 完成。

### 本阶段交付

1. FileManager 顶部、空状态、移动端底部栏统一为单一“新建”入口。
2. 新建弹窗内选择文件或文件夹，避免“新建文件”和“新建文件夹”在多个入口重复出现。
3. 右键菜单移除与当前文件项无关的“新建文件/新建文件夹”入口。
4. 移动、复制、批量移动、批量复制接入真实 API：session mode 调 session API，machine mode 调 machine API，mock mode 调 mock FS。
5. 上传、下载占位入口从全局 FileManager 的右键菜单和移动端底部栏移除，避免继续显示空壳操作。
6. `/sessions/:id/files` 的“目录”Tab 改为复用统一 FileManager，保留“变更”Tab 作为 Git 增强视图。
7. 删除旧 session directory tree 的右键菜单、弹窗、上传占位和独立 CRUD 状态，减少两套文件页割裂。
8. 新增 `web/src/lib/file-manager-api.test.ts`，覆盖 move/copy 目标路径拼接和 create failure 冒泡。

### 用户反馈覆盖

| 用户问题 | 状态 | 说明 |
|---|---|---|
| 新建文件/文件夹多处冗余 | 已解决全局 FileManager | 单一“新建”按钮 + 弹窗选择类型 |
| 大量功能不可用或占位 | 已进一步解决 | 移动/复制已真实可用；上传/下载占位已隐藏 |
| 没有活动会话导致操作不可用 | 已解决基础 CRUD | machine mode create/delete/rename/move/copy 不需要 session |
| session 文件页和全局文件管理割裂 | 已显著改善 | session “目录”Tab 复用 FileManager；Git 变更 Tab 保留 |
| 文件点击无反应和编辑入口不清晰 | 待 35.4 | 仍需全局 preview/edit 真实接入 |

### 是否引入新空壳入口

没有新增空壳入口。上传和下载尚未实现，因此从全局 FileManager 可见操作中移除，等待 35.5 以真实上传下载能力重新接入。

### 全局和会话一致性

- `/browse` 和 `/sessions/:id/files?tab=directories` 现在复用同一个 FileManager 组件。
- create/delete/rename/move/copy 的 UI 操作模型一致。
- session files 的 Git changes 仍保持独立增强视图，这是有意保留的 session 上下文能力。

### 移动端触控和可访问性

- 移动端底部栏减少为“新建”和“会话”，不再暴露上传占位。
- 新建类型选择按钮和移动/复制目标输入保持 40px 以上高度，底部栏按钮保持 48px 触控目标。
- 右键菜单仍使用 fixed 定位和 keyboard focus 管理。

### 质量门禁

```bash
bun run typecheck
# PASS

cd web && bun test src/lib/file-manager-api.test.ts src/lib/files-i18n.test.ts
# PASS: 7 tests

bun run test:web
# PASS: 79 files, 672 tests

git diff --check
# PASS
```

### 剩余风险

1. 全局文件点击仍只是提示，需要 35.4 接入 machine read/write 到统一 viewer/editor。
2. 上传、下载已隐藏但尚未交付，35.5 必须以真实能力回归。
3. session common read handler 还缺 `hash/size/modified`，统一冲突检测仍待补齐。
4. FileManager 的移动/复制目标当前是路径输入，生产上后续可以增强为目录选择器，但当前不再是空壳。

## Phase 35.4 Review: 预览编辑生产化

**状态**: 完成。

### 本阶段交付

1. session `ReadFile` RPC 返回 `content`、`hash`、`size`、`modified`，补齐保存冲突检测所需元数据。
2. session 文件页保存从默认 `forceOverwrite=true` 改为 `expectedHash` 安全保存，避免静默覆盖外部修改。
3. session 保存失败时保留本地内容，并提供重试、重新加载、强制覆盖、复制内容四种恢复动作。
4. 新增 machine scoped `/browse/file` 路由，全局 `/browse` 点击文件直接打开预览/编辑，不再依赖活动会话。
5. machine 文件页支持文本轻编辑、Markdown 预览/编辑切换、图片预览、二进制保护、大文件只读保护和下载。
6. machine 文件页保存同样使用 `expectedHash`，支持冲突后 reload / force overwrite / copy local recovery。
7. `/browse/file` 返回 `/browse` 时携带父目录路径，避免深层目录打开文件后返回丢失空间上下文。
8. 修正轻编辑工具栏只读提示，只在预览态显示，不在编辑态误导用户。
9. 新增 `cli/src/modules/common/handlers/files.test.ts`，覆盖 read metadata 和 stale expectedHash 拒绝。

### 用户反馈覆盖

| 用户问题 | 状态 | 说明 |
|---|---|---|
| 文件点击无反应 | 已解决 | `/browse` 文件点击进入 `/browse/file` 全局文件页 |
| 编辑入口不清晰 | 已解决基础闭环 | 文件页提供预览、编辑、保存、下载和恢复动作 |
| 没有活动会话导致文件无法操作 | 已进一步解决 | 全局文件打开和保存走 machine API，不需要 session |
| 大量占位功能不可用 | 已进一步解决 | 下载在文件页以真实 blob 下载接入，上传和搜索进入 35.5 |
| session 和全局割裂 | 部分解决 | session directory 复用 FileManager；文件页行为基本对齐，但 viewer 代码仍可继续抽组件 |

### 是否引入新空壳入口

没有新增空壳入口。Monaco 懒加载未在本阶段落地，当前以 textarea 轻编辑作为明确可用的生产兜底；35.6 前需要决定是否继续接 Monaco，或将 Monaco 留到后续版本并在文档中明确。

### 全局和会话一致性

- 全局和会话文件页都支持预览、轻编辑、保存、失败恢复、二进制保护和大文件保护。
- 全局文件页不含 Git diff tab，这是符合 machine scoped 模式的差异；session 文件页保留 Git diff 作为会话增强能力。
- 当前两套文件页存在重复 UI 代码，后续可抽 `FileViewer` 组件降低维护风险。

### 移动端触控和可访问性

- 关键按钮在移动端保持 44px 触控目标或通过 `max-md:min-h-[44px]` 增强。
- 保存失败恢复动作均为显性按钮，不依赖右键或长按。
- Dirty 离开保护使用确认对话框，避免移动端误触丢失内容。

### 质量门禁

```bash
bun run typecheck
# PASS

cd cli && bun test src/modules/common/handlers/files.test.ts src/api/apiMachine.fileOperations.test.ts
# PASS: 8 tests

cd web && bun test src/lib/file-manager-api.test.ts src/lib/files-i18n.test.ts
# PASS: 7 tests

bun run test:web
# PASS: 79 files, 672 tests

git diff --check
# PASS
```

### 剩余风险

1. 上传仍未接入真实能力，35.5 必须实现并重新显示入口。
2. FileManager 列表页下载入口仍未恢复，35.5 需要接入单文件下载，目录下载 zip 可作为后续增强。
3. 全局和会话文件页重复较多，35.6 质量收敛时应评估是否抽组件。
4. Monaco 懒加载未落地，当前轻编辑可用但不满足历史“代码编辑器”理想形态。
5. 文件保存大小仍受 Hub `writeFileSchema` 5MB 限制，上传阶段需要明确限制和错误文案。
