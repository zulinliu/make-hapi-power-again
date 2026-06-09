# Phase 46 — v0.18.0 测试稳定性收尾

> 日期：2026-06-09
> 分支：`feat/v0.18.0`
> 范围：Phase 45 后置测试稳定性修复
> 适用基线：`37-PROTOCOL-ADDENDUM.md`、`37-SECURITY-ADDENDUM.md`、`37-UX-ACCEPTANCE-MATRIX.md`、`37-BRAND-CONTRACT.md`

## 阶段计划

目标：修复全量测试中 `NotificationHub > throttles ready notifications per session` 的非确定性失败，确保 v0.18.0 发布前质量门禁不依赖真实计时和事件循环调度。

1. 复核上下文：确认当前分支为 `feat/v0.18.0`，继续排除无关 dirty 文件 `.codegraph/codegraph.db`。
2. 复查失败原因：确认原测试依赖 `readyCooldownMs: 20` 与真实 `sleep(5/30)`，全量负载下事件循环延迟可能让第二次 ready 越过 cooldown。
3. 实施修复：用可控 `Date.now` 代替真实等待，并通过 `try/finally` 恢复全局时间函数和 Hub 订阅。
4. 验证门禁：运行目标测试、Hub typecheck、全量 typecheck、全量 test、build、Git 规范、敏感信息扫描和 whitespace 检查。

## 使用的 Skill

- `$karpathy-guidelines`：按最小范围修复测试，不改生产逻辑，不引入抽象。
- `$gsd-new-project`：项目已存在，不重新初始化 `.planning/PROJECT.md`，沿用既有 GSD phase 记录方式。
- `$impeccable`：本阶段无 UI 改动；仅加载产品上下文，确认不需要新增视觉或 i18n 变更。

## 实施范围

- 将 ready 通知节流测试从真实时间等待改为手动推进 `Date.now`。
- 第一次 ready 立即发送，第二次同一时间戳被 cooldown 拦截，手动推进 21ms 后第三次 ready 放行。
- `Date.now` 覆盖和 `NotificationHub.stop()` 放入 `finally`，避免断言失败时污染后续测试。

## 修改文件

- `hub/src/notifications/notificationHub.test.ts`
- `.planning/phases/37-v0.18.0-feature-redesign/46-TEST-STABILITY-AUDIT.md`
- `.planning/STATE.md`

## 测试结果

- `bun run test:hub -- src/notifications/notificationHub.test.ts`
  - 通过：4 tests passed。
- `bun run typecheck:hub`
  - 通过。
- `bun run typecheck`
  - 通过：CLI、Web、Hub TypeScript 检查均通过。
- `bun run test`
  - 通过：CLI 813 tests passed，12 个 direct-connect integration tests 因缺少 `CLI_API_TOKEN` 按测试设计跳过；Hub 406 tests passed；Web 测试通过；Shared 57 tests passed。
  - 备注：Web 输出包含既有 Browserslist 数据过期提示和 jsdom navigation not implemented 警告，不影响命令结果。
- `bun run build`
  - 通过：Web production build、PWA service worker、embedded web assets 生成、Hub build 均通过。
  - 备注：输出包含既有 CSS optimizer、KaTeX font runtime resolve 和 chunk size warning。
- `bun run check:git-standards`
  - 通过。
- `bun run check:sensitive-info`
  - 通过。
- `git diff --check`
  - 通过。

## 自审结论

- 修复只影响 Hub 通知测试，不改变 `NotificationHub` 生产行为。
- 原测试验证目标保持不变：同一 session 的 ready 通知在 cooldown 内只发一次，超过 cooldown 后可再次发送。
- 修复消除了真实等待和全量负载下事件循环延迟导致的偶发失败。
- `.codegraph/codegraph.db` 仍是无关 dirty 文件，本阶段不纳入 stage。

## 门禁对照

- `37-PROTOCOL-ADDENDUM.md`：无协议变更。
- `37-SECURITY-ADDENDUM.md`：无安全边界变更，无敏感信息新增。
- `37-UX-ACCEPTANCE-MATRIX.md`：无 UI/PWA/i18n 变更。
- `37-BRAND-CONTRACT.md`：无品牌文案变更，五节点顺序不受影响。

## 已知风险

- 真实 iOS PWA standalone 模式尚未人工验收。
- 尚未创建 `v0.18.0` tag 或 GitHub Release。
- `.codegraph/codegraph.db` 仍处于无关 dirty 状态，需要继续排除在 v0.18.0 提交之外。

## 下一阶段建议

1. 保持当前分支 tip 运行最终发布门禁。
2. 完成真实 iOS PWA 人工验收。
3. 验收后按 `GIT-STANDARDS.md` 创建 `v0.18.0` tag 和 GitHub Release。
