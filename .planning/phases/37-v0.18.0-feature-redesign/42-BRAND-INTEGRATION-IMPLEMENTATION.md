# Phase 42 — 品牌整合与发布准备实施记录

> 日期：2026-06-09
> 分支：`feat/v0.18.0`
> 范围：README / PRODUCT / planning / docs assets plan
> 适用基线：`37-BRAND-CONTRACT.md`、`37-README-BRAND-COPY.md`、`37-UX-ACCEPTANCE-MATRIX.md`

## 阶段计划

目标：把 v0.18.0 已实施的五个特色功能统一为对外品牌叙事，避免 README、PRODUCT、规划状态和截图计划继续使用旧的普通功能名。

1. README 英文版增加 Hapi Power Loop，并按 Connect → Drive → Observe → Trace → Preserve 排序。
2. README 中文版增加五节点工作流，并按 接入 → 驾驶 → 观测 → 追踪 → 沉淀 排序。
3. PRODUCT.md 从 v0.17 文件管理器定位更新为 AI 编码代理工作台与五节点能力环。
4. `.planning/STATE.md` 从“仅设计、未实施源码”更新为 Phase 38~42 已实施、待发布。
5. `.planning/PROJECT.md` 同步核心价值、v0.18 能力环和活跃能力补充。
6. `docs/assets` 增加 v0.18 截图计划，明确发布前需要补齐的五张 signature moment 截图。

## 实施范围

- README / README.zh-CN 顶部定位、功能特色、完整功能列表和模型供应商使用章节。
- PRODUCT 顶层用户、产品目的、设计原则和反参考。
- `.planning/STATE.md` v0.18 当前状态。
- `.planning/PROJECT.md` 核心价值、v0.18 能力环、关键决策和活跃能力补充。
- 新增 `docs/assets/v0.18-screenshot-plan.md`。

## 修改文件

- `README.md`
- `README.zh-CN.md`
- `PRODUCT.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`
- `.planning/phases/37-v0.18.0-feature-redesign/42-BRAND-INTEGRATION-IMPLEMENTATION.md`
- `docs/assets/v0.18-screenshot-plan.md`

## 测试结果

文档阶段无需重新运行源码 typecheck 或单元测试。本阶段提交前执行以下门禁：

- `git diff --check`
- `bun run check:git-standards`
- `bun run check:sensitive-info`
- 对本阶段变更文件扫描 Git 署名、第三方工具署名和旧官网域名残留。
- 对本阶段变更文件扫描旧 Provider、旧上下文监控和旧 token 余量文案残留。

## 自审结论

- README 英中版均把首屏叙事改为 AI 编码工程闭环，不再以旧功能列表作为主表达。
- 五个特色能力在 README、PRODUCT、STATE、PROJECT 中保持固定顺序：接入 → 驾驶 → 观测 → 追踪 → 沉淀。
- “API 供应商 / Provider”在用户阅读文档中退居功能描述，主品牌名使用“模型星桥 / Model Nexus”。
- “大纲”只作为会话织锦内部能力，不再作为主品牌名。
- `STATE.md` 明确 v0.18.0 仍待发布，未虚构 tag 或 GitHub Release 已完成。
- 截图计划明确是发布前待补齐资产，没有伪造不存在的 PNG。

## 已知风险

- 本阶段没有生成真实截图；`docs/assets/v0.18-screenshot-plan.md` 仅定义验收计划。发布前仍需启动应用并补齐五张截图。
- 本阶段是文档与品牌整合，不重新验证 Phase 38~41 的源码测试；发布前仍需运行全量 typecheck、全量测试、移动端截图和 iOS PWA 手动验收。
- `CHANGELOG.md` 尚未新增 `0.18.0` release notes，避免在未完成发布门禁前把版本写成已发布。

## 评审记录

- 品牌 / 产品只读复审：PASS。确认 README、README.zh-CN、PRODUCT、STATE、PROJECT、截图计划均保持五节点顺序；未发现旧功能名退化；未虚构 v0.18.0 已发布。
- 安全 / Git 规范只读复审：PASS。确认本阶段文件无真实 token、secret、内部 host、违规署名或第三方工具署名；`CLI_API_TOKEN`、`OPENAI_API_KEY`、`ANTHROPIC_API_KEY` 仅作为环境变量名出现；截图计划使用 `example.com` 占位值。

## 门禁对照

### `37-PROTOCOL-ADDENDUM`

本阶段不修改 Guide Beam 协议。README 和 PRODUCT 仅描述已实施的 deliveryMode、capability fallback、isolated guide queue 和 preserve-queue 语义。

### `37-SECURITY-ADDENDUM`

本阶段同步安全叙事：Provider 安全 health check、key reveal、Session Loom 默认 redaction、外部 LLM 提炼默认关闭。未新增 secret、token 或真实内部 host。

### `37-UX-ACCEPTANCE-MATRIX`

本阶段新增截图计划，发布前需覆盖 Model Nexus、Guide Beam、Context Pulse、Git Atlas、Session Loom 的 signature moment 与 iOS PWA fallback。

### `37-BRAND-CONTRACT`

满足 canonical naming 和五节点顺序。README、README.zh-CN、PRODUCT、STATE、PROJECT 均使用：

```text
接入 → 驾驶 → 观测 → 追踪 → 沉淀
Model Nexus → Guide Beam → Context Pulse → Git Atlas → Session Loom
```

## 下一阶段建议

1. 启动发布准备：补 `CHANGELOG.md` 0.18.0 release notes，但不要创建 tag 前写成已发布。
2. 生成或更新五张 v0.18 signature moment 截图，并替换 README 截图表。
3. 运行全量 `bun run typecheck`、`bun run test`、`bun run build`、Git 标准和敏感信息扫描。
4. 完成 v0.18.0 tag / GitHub Release 前再次确认作者、分支、release notes 和品牌残留。
