# Phase 40 — Git 脉络 / Git Atlas 实施记录

> 日期：2026-06-08
> 分支：`feat/v0.18.0`
> 范围：Git Atlas
> 适用基线：`37-BRAND-CONTRACT.md`、`37-UX-ACCEPTANCE-MATRIX.md`、`37-SECURITY-ADDENDUM.md`、`37-TECH-DESIGN.md`

## 阶段计划

目标：把会话 Git 页面从命令分区升级为 Git Atlas 工作流，让首屏直接回答当前分支、变更风险、同步状态与下一步安全动作。

1. Hub 新增结构化 Git Atlas API：dashboard、diff preview、commit basket、sync center。
2. CLI 支持 Commit Basket selected paths，并确保 Git 路径按字面量处理。
3. Web Git 页面重构为 Hero、Change Map、Diff Preview、Commit Basket、Sync Center。
4. 危险操作服务端强确认，force push、delete branch、delete remote 不只依赖 UI。
5. Git remote、clone URL、stderr/stdout、sync 结果默认脱敏 credential。
6. 补 en / zh-CN i18n parity、路径显示、移动端触控、reduced motion 与回归测试。

## 实施范围

- `hub/src/web/routes/git.ts`
  - 新增 `/git-dashboard`，聚合 porcelain v2 status、diff numstat、remote、recent log，返回 Git Atlas 结构化数据。
  - 新增 `/git-diff`，支持单文件 diff preview、二进制/过大/截断状态。
  - 新增 `/git-commit-basket`，提交显式 selected paths，并回传最终 committed paths。
  - 新增 `/git-sync`，统一 fetch/pull/push，包含 session 级 in-flight lock。
  - 对 force push、branch delete、remote delete 增加服务端 confirmation phrase。
  - 对 legacy remotes/push/pull/fetch API 响应统一脱敏。
  - 修正 porcelain v2 rename/copy 解析方向，确保 `path` 是新路径，`oldPath` 是旧路径。
- `cli/src/modules/common/handlers/git.ts`
  - `GitCommitRequest` 支持 `paths`。
  - `GitAdd`、`GitCommit`、`GitAutoCommit` 对 pathspec 做统一校验。
  - 使用 `git --literal-pathspecs` 执行 selected paths，拒绝 `:(...)`、glob、绝对路径、目录穿越与参数注入。
- Web
  - `web/src/routes/sessions/git.tsx` 改为 Git Atlas 主体验：Hero、Change Map、Diff Preview、Commit Basket、Sync Center。
  - 首屏显示 branch、remote、dirty/ahead/behind/conflicts 与 recommended action。
  - Change Map 支持长路径 title、选中文件完整显示、路径复制、打开文件。
  - Diff Preview 分块渲染，避免大 diff 一次性撑爆 DOM。
  - Commit Basket 只提交 selectable selected paths，冲突文件不可加入篮子。
  - Sync Center 支持 fetch/pull/push/force push，force push 必须输入当前分支名。
  - 旧 Branch/Remote 管理组件补服务端 confirmation phrase 调用。
  - 移除 `GitPushDialog` 不被 Hub strict schema 接受的 `setUpstream` 字段。
- 类型与客户端
  - `shared/src/apiTypes.ts`、`web/src/types/api.ts` 新增 Git Atlas 类型。
  - `web/src/api/client.ts` 新增 dashboard、diff、commit basket、sync API。
  - `web/src/lib/git-atlas.ts` 提供本地推荐动作、状态映射、篮子路径工具。
- i18n
  - `web/src/lib/locales/en.ts` 与 `zh-CN.ts` 新增 `gitAtlas.*` 文案，保持中英 key parity。

## 修改文件

- `cli/src/modules/common/handlers/git.ts`
- `cli/src/modules/common/handlers/gitCommit.test.ts`
- `hub/src/web/routes/git.ts`
- `hub/src/web/routes/gitCloneRoutes.test.ts`
- `shared/src/apiTypes.ts`
- `web/src/api/client.ts`
- `web/src/api/client.gitPortal.test.ts`
- `web/src/components/git/GitBranchManager.tsx`
- `web/src/components/git/GitPushDialog.tsx`
- `web/src/components/git/GitRemoteManager.tsx`
- `web/src/lib/git-atlas.ts`
- `web/src/lib/git-atlas.test.ts`
- `web/src/lib/locales/en.ts`
- `web/src/lib/locales/zh-CN.ts`
- `web/src/lib/locales/git-atlas-i18n.test.ts`
- `web/src/routes/sessions/git.tsx`
- `web/src/routes/sessions/git.test.tsx`
- `web/src/types/api.ts`

说明：`.codegraph/codegraph.db` 为既有无关 dirty 文件，不纳入本阶段 stage 和 commit。

## 测试结果

已通过：

- `cd cli; bunx vitest run src/modules/common/handlers/gitCommit.test.ts`
  - 1 file / 3 tests passed
- `cd hub; bun test src/web/routes/gitCloneRoutes.test.ts`
  - 1 file / 14 tests passed
- `cd web; bunx vitest run src/lib/git-atlas.test.ts src/lib/locales/git-atlas-i18n.test.ts src/api/client.gitPortal.test.ts src/routes/sessions/git.test.tsx`
  - 4 files / 15 tests passed
- `cd cli; bun run typecheck`
  - passed
- `cd hub; bun run typecheck`
  - passed
- `cd web; bun run typecheck`
  - passed
- `bun run typecheck`
  - CLI / Web / Hub typecheck passed
- `git diff --check`
  - passed，仅 Windows 换行提示
- `bun run check:git-standards`
  - passed
- `bun run check:sensitive-info`
  - passed

## 自审结论

- Git Atlas 首屏不再是 status/history/branches/remotes 四个 Tab，Hero 直接呈现分支态势、变更指标和推荐动作。
- Commit Basket selected paths 已从 Web 传到 Hub，再传到 CLI，CLI 使用 `--literal-pathspecs` 和统一 pathspec 校验保证不会被 glob/magic 扩展。
- CLI 与 Hub 均拒绝 `--all`、`../outside.txt`、`*.txt`、`:(top)**` 等危险路径。
- force push、branch delete、remote delete 均有 Hub 服务端 confirmation phrase，旧 UI 组件也已补齐确认参数。
- `git-sync` 与旧 push/pull/fetch 共用 session 级 in-flight lock，避免重复点击并发同步。
- 新 dashboard 对 helper RPC 失败不再静默降级，返回脱敏错误，避免误导用户。
- legacy `git-remotes`、`git-push`、`git-pull`、`git-fetch` API 的 stdout/stderr/error 已统一脱敏，credential 不依赖前端显示层保护。
- porcelain v2 rename/copy 解析已修正，`path` 为新路径，`oldPath` 为旧路径。
- Diff Preview 对大 diff 分块渲染，二进制/截断/过大状态均有 UI 文案。
- Web 输入框使用 `text-base`，关键路径选择与操作按钮满足移动端 44px 触控目标；reduced motion 下滚动行为降级为静态跳转。
- `gitAtlas.*` 文案已通过 en / zh-CN parity 测试。

## 评审与修复

已按用户要求回收多子代理评审，并完成修复：

- UI/UX 审计：修复输入字号、长路径可读性、Hero 推荐动作 CTA、Change Map 触控尺寸、Diff 分块渲染、reduced motion。
- 代码评审：
  - 修复 Commit Basket pathspec magic/glob 扩展风险，CLI 改用 `--literal-pathspecs`，Hub/CLI 双层拒绝非字面 path。
  - 修复 porcelain v2 rename/copy 新旧路径解析反向问题。
  - 移除 `GitPushDialog` 发送的 `setUpstream` 字段，使 Web 请求与 Hub strict schema 对齐。
  - dashboard helper RPC 失败改为返回脱敏错误，不再伪装成空数据。
- 安全评审：
  - 修复 legacy `git-remotes` API 返回未脱敏 remote URL。
  - 修复 legacy push/pull/fetch stdout/stderr/error 原样返回 credential 的风险。

## 门禁对照

- `37-PROTOCOL-ADDENDUM.md`：本阶段不触碰 Guide Beam queue、abort/reset、messages-consumed 路径；未破坏 Phase 39 已完成协议语义。
- `37-SECURITY-ADDENDUM.md`：满足 Git Atlas 相关安全门禁。Git 参数走 Zod schema 与 `execFile` 数组参数；危险操作服务端确认；remote URL、stderr、stdout、sync response 脱敏；sync in-flight lock；Commit Basket selected paths 已验证真实生效。
- `37-UX-ACCEPTANCE-MATRIX.md`：满足 Git Atlas 可测试项。首屏显示 branch、dirty/ahead/behind、recommended action；长路径可查看完整路径；Diff 分块渲染；Commit Basket count 与 selected paths 一致；force push 需要完整分支名；移动端主操作具备 44px 触控目标。
- `37-BRAND-CONTRACT.md`：页面标题和 i18n namespace 使用 `Git 脉络 / Git Atlas` 与 `gitAtlas.*`，保持五节点中“追踪 / Trace”的品牌语义。

## 已知风险

- 本阶段以单元、route、组件测试和静态自审为主，未启动完整 dev server 做 Playwright 移动端截图验收。后续品牌整合阶段应补一次 iPhone 390x844、430x932、tablet、desktop 的视觉巡检。
- Commit Basket 当前策略会先 `git add selected paths` 再 `git commit -- selected paths`，能保证 selected paths 真实生效；但如果用户之前已有 unrelated staged 内容，Git 本身的 index 状态仍可能影响其他工作流感知。后续可增加“提交前 staged 差异预览”以进一步降低认知风险。
- Git remote URL 只在 API 响应层做 credential 脱敏；本阶段未改 CLI 原始命令输出模型，后续如果 CLI 输出被其他日志系统采集，仍应沿用统一日志脱敏策略。

## 下一阶段建议

1. 进入 Session Loom：优先完成服务端 outline、export preview、Markdown export、默认 redaction 与 synthesis job 显式确认。
2. Session Loom 导出必须默认开启 redaction，外部 LLM 提炼默认关闭。
3. 品牌整合阶段统一更新 README、README.zh-CN、PRODUCT、docs 与截图文案，按“接入 → 驾驶 → 观测 → 追踪 → 沉淀”排序。
