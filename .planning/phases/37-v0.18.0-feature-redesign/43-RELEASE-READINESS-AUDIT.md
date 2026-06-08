# Phase 43 — v0.18.0 发布准备审计记录

> 日期：2026-06-09
> 分支：`feat/v0.18.0`
> 范围：完成度审计、CHANGELOG、发布前全量门禁
> 适用基线：`37-REQUIREMENTS.md`、`37-BRAND-CONTRACT.md`、`37-SECURITY-ADDENDUM.md`、`37-UX-ACCEPTANCE-MATRIX.md`

## 阶段计划

目标：接手 Phase 38~42 后做一次发布前收敛，确认 v0.18.0 五大特色功能已有实施和测试证据，并补齐 release notes 缺口。

1. 恢复上下文：确认分支、dirty 状态、`AGENTS.md`、`GIT-STANDARDS.md` 和指定 skills。
2. 审计基线：读取 Phase 37 需求、协议、安全、UX、品牌契约和 Phase 38~42 实施记录。
3. 运行全量门禁：typecheck、test、build、Git 规范、敏感信息扫描和 diff whitespace。
4. 补齐发布说明：在 `CHANGELOG.md` 增加 v0.18.0 待发布条目，保持五节点顺序。
5. 记录自审结论和剩余发布风险。

## 实施范围

- 确认当前仓库位于 `feat/v0.18.0`，且仅有无关 dirty `.codegraph/codegraph.db`。
- 复核 Phase 38~42 实施记录与关键门禁：
  - Model Nexus：Provider namespace、SSRF、health/capability/model cache、safe reveal、Wizard、i18n。
  - Guide Beam：deliveryMode、capability handshake、isolated guide queue、fallback、`messages-consumed` 时序。
  - Context Pulse：`上下文：40%`、不可用诊断、usage 白名单、59/60/80/81 阈值测试。
  - Git Atlas：git-dashboard、Diff preview、Commit Basket selected paths、Sync Center、危险操作服务端确认。
  - Session Loom：完整 outline、export preview、Markdown export、默认 redaction、本地提炼、下载/复制/share fallback。
- 新增 `CHANGELOG.md` v0.18.0 待发布条目，未创建 tag 或 GitHub Release。

## 修改文件

- `CHANGELOG.md`
- `.planning/phases/37-v0.18.0-feature-redesign/43-RELEASE-READINESS-AUDIT.md`
- `.planning/STATE.md`

## 测试结果

- `bun run typecheck`
  - 通过：CLI、Web、Hub TypeScript 检查均通过。
- `bun run test`
  - 通过：CLI 91 files passed / 813 tests passed，1 个 runner 直连 integration 文件因缺少 `CLI_API_TOKEN` 按测试设计跳过 12 tests；Hub 406 tests passed；Web 测试通过；Shared 57 tests passed。
  - 备注：Web 输出包含既有 Browserslist 数据过期提示与 jsdom navigation not implemented 警告，不影响测试结果。
- `bun run build`
  - 通过：Web production build、PWA service worker、embedded web assets 生成、Hub build 均通过。
  - 备注：构建输出包含既有 CSS optimizer、KaTeX font runtime resolve 和 chunk size warning。
- `bun run check:git-standards`
  - 通过。
- `bun run check:sensitive-info`
  - 通过。
- `git diff --check`
  - 通过。

## 自审结论

- v0.18.0 五大特色功能的源码、测试、i18n 与文档实施记录完整，且与 Phase 37 的品牌顺序一致：接入 → 驾驶 → 观测 → 追踪 → 沉淀。
- `CHANGELOG.md` 已补齐 v0.18.0 待发布说明，但明确标记为“待发布”，未虚构 tag、GitHub Release 或已发布状态。
- 发布前全量门禁已通过，当前未发现需要继续修复的源码缺口。
- `.codegraph/codegraph.db` 仍是无关 dirty 文件，本阶段不纳入 stage。

## 已知风险

- 尚未补齐五张 signature moment 真实截图；`docs/assets/v0.18-screenshot-plan.md` 仍是截图计划。
- 尚未完成 iOS PWA 实机手动验收，代码层和组件测试已覆盖 safe-area、focus trap、copy/share fallback、reduced motion 等关键点。
- 尚未创建 `v0.18.0` tag 或 GitHub Release；正式发布前仍需按 `GIT-STANDARDS.md` 再次检查作者、tag、release notes 和分支状态。

## 门禁对照

### `37-PROTOCOL-ADDENDUM`

发布审计复核 Phase 39 记录与测试结果：Guide capability handshake、fallback queue、isolated guide queue、preserve queue、`messages-consumed` collect 后触发均已覆盖。

### `37-SECURITY-ADDENDUM`

发布审计复核 Phase 38~41 安全实现，并重新运行敏感信息扫描。Provider SSRF、Export 默认 redaction、Git 危险操作服务端确认和 Guide 安全降级均已有测试证据。

### `37-UX-ACCEPTANCE-MATRIX`

组件与单元测试覆盖关键交互和 i18n，真实移动端截图与 iOS PWA 实机验收仍作为发布前人工门禁保留。

### `37-BRAND-CONTRACT`

`CHANGELOG.md`、README、README.zh-CN、PRODUCT、STATE、PROJECT 均保持五节点顺序和 canonical naming。`大纲`、`Provider`、`Git` 等描述名未替代对外主品牌名。

## 下一阶段建议

1. 启动 dev server，按 `docs/assets/v0.18-screenshot-plan.md` 补齐五张 signature moment 截图。
2. 做 iOS PWA 实机验收：safe-area、键盘、focus trap、reduced motion、下载失败 copy/share fallback。
3. 完成发布前最终门禁后，按 Git 标准创建 `v0.18.0` tag 和 GitHub Release。
