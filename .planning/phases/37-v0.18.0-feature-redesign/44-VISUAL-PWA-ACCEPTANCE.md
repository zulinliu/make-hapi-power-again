# Phase 44 — v0.18.0 视觉截图与浏览器级 PWA 验收

> 日期：2026-06-09
> 分支：`feat/v0.18.0`
> 范围：五张 signature moment 截图、浏览器级移动端 / PWA 验收、发布文档证据
> 适用基线：`37-BRAND-CONTRACT.md`、`37-UX-ACCEPTANCE-MATRIX.md`、`37-SECURITY-ADDENDUM.md`、`37-PROTOCOL-ADDENDUM.md`

## 阶段计划

目标：补齐 Phase 43 留下的截图与浏览器级 PWA 验收缺口，让 v0.18.0 发布前具备可审查的视觉证据。

1. 恢复上下文：确认 `feat/v0.18.0` 分支、作者配置、dirty 文件边界和 Git 标准。
2. 生成截图：用 Playwright 启动真实 Web 前端，注入安全 mock 数据，输出五张 signature moment PNG。
3. 修复触控缺口：对 Guide Beam 和队列相关移动端按钮补齐 44×44px 触控目标。
4. 更新文档：把截图计划改为验收记录，README 增加五节点截图，STATE 记录当前发布状态。
5. 运行门禁：Web typecheck、Web 相关测试、截图脚本、Git 规范、敏感信息扫描和 diff whitespace。

## 实施范围

- 新增 `scripts/generate-v018-screenshots.cjs`，固定使用 `http://127.0.0.1:53180` 启动 `web/` dev server，并在 Windows 下清理进程树。
- 脚本通过 Playwright 截取：
  - 模型星桥 / Model Nexus
  - 引导光标 / Guide Beam
  - 上下文脉冲 / Context Pulse
  - Git 脉络 / Git Atlas
  - 会话织锦 / Session Loom
- mock API 使用真实前端路由和组件，只注入占位数据：
  - `example.com`
  - `git.internal.example.com`
  - `test-user`
  - `/home/tester/project`
- 移动端验收使用 iPhone UA、touch、`prefers-reduced-motion: reduce`，并用 DOM 断言检查 44×44px 触控目标。
- 修复 Guide Beam 相关移动端按钮尺寸：
  - Composer 工具按钮移动端 44px，桌面仍保持紧凑 32px。
  - `排队 / 立即引导` 分段按钮移动端 44px，桌面仍保持紧凑。
  - 队列编辑 / 取消按钮移动端 44px，桌面仍保持 24px。

## 修改文件

- `scripts/generate-v018-screenshots.cjs`
- `docs/assets/screenshot-model-nexus.png`
- `docs/assets/screenshot-guide-beam.png`
- `docs/assets/screenshot-context-pulse.png`
- `docs/assets/screenshot-git-atlas.png`
- `docs/assets/screenshot-session-loom.png`
- `docs/assets/v0.18-screenshot-plan.md`
- `README.md`
- `README.zh-CN.md`
- `web/src/components/AssistantChat/ComposerButtons.tsx`
- `web/src/components/AssistantChat/HappyComposer.tsx`
- `web/src/components/AssistantChat/QueuedMessagesBar.tsx`
- `.planning/STATE.md`
- `.planning/phases/37-v0.18.0-feature-redesign/44-VISUAL-PWA-ACCEPTANCE.md`

## 测试结果

- `bun run typecheck:web`
  - 通过：`web` TypeScript `tsc --noEmit` 无错误。
- `bun run test:web -- AssistantChat/HappyComposer.test.tsx AssistantChat/QueuedMessagesBar.test.tsx`
  - 通过：2 个测试文件、19 个测试全部通过。
- `node scripts/generate-v018-screenshots.cjs`
  - 通过：五张截图重新生成，输出 `v0.18.0 screenshots generated and browser-level PWA checks passed.`
  - 输出体积：Model Nexus 64 KB、Guide Beam 52 KB、Context Pulse 71 KB、Git Atlas 143 KB、Session Loom 51 KB。
  - 备注：dev 模式 Service Worker registration error 与 mock duplicate key warning 为已记录的 dev/mock 噪音，不影响验收通过。
- `bun run check:git-standards`
  - 通过。
- `bun run check:sensitive-info`
  - 通过。
- `git diff --check`
  - 通过，仅输出 Windows 换行提示，无 whitespace error。

## 自审结论

- 五张 signature moment 截图已覆盖固定顺序：接入 → 驾驶 → 观测 → 追踪 → 沉淀。
- 截图脚本使用真实 React 前端，不用静态 HTML 拼图，能够捕获路由、i18n、状态栏、Panel、按钮尺寸和导出预览的真实回归。
- Guide Beam 与 Session Loom 的移动端触控目标缺口已修复，且脚本在截图前用 DOM box 尺寸断言防止回退。
- Context Pulse 的浏览器验收覆盖 `上下文：40%` 和 popover，阈值 59/60/80/81 通过源码逻辑断言兜底。
- README 和 README.zh-CN 已追加五节点截图，不再只依赖旧通用截图展示 v0.18.0。
- `.codegraph/codegraph.db` 是无关 dirty 文件，本阶段不纳入 stage。

## 已知风险

- 本阶段完成的是浏览器级移动端 / PWA 模拟验收，不等同于真实 iOS 设备验收。
- iOS Safari 的实际下载失败、系统分享 sheet、键盘遮挡和安装后 standalone safe-area 仍需人工在设备上复核。
- 截图脚本在 dev 模式下可能输出 Service Worker registration error 和 mock duplicate key warning，已确认属于 dev/mock 噪音，不记录为生产缺陷。

## 门禁对照

### `37-PROTOCOL-ADDENDUM`

- Guide Beam 截图和断言覆盖 thinking 状态下 `排队 / 立即引导`、`引导中` 反馈与普通待发送队列并存。
- 本阶段未改动 Hub/CLI Guide 协议实现；Phase 39 的 capability handshake、isolated queue、fallback 和 `messages-consumed` 测试仍是协议门禁主证据。

### `37-SECURITY-ADDENDUM`

- 截图脚本只使用占位 URL、占位用户和占位路径，不包含真实 API key、token、私有 remote credential、个人路径或内部 host。
- Session Loom 截图覆盖导出预览中的 `[REDACTED_PATH]` 和脱敏状态，保持 export redaction 默认开启的发布证据。
- 本阶段不新增 Provider、Git 或 export 服务端逻辑，安全主证据仍来自 Phase 38~41 测试与 Phase 43 敏感信息扫描。

### `37-UX-ACCEPTANCE-MATRIX`

- 覆盖 desktop 1440×1000、desktop 1280×900、desktop 1440×1100、mobile 390×844、mobile 430×932。
- 移动端 touch target 断言覆盖 Guide Beam 和 Session Loom 的核心交互。
- reduced motion 在移动端截图上下文中启用并断言。
- 真实 iOS PWA 设备验收仍作为发布前人工项保留。

### `37-BRAND-CONTRACT`

- 五张截图与 README 截图区严格使用五节点顺序：接入 → 驾驶 → 观测 → 追踪 → 沉淀。
- 对外主标题继续使用模型星桥、引导光标、上下文脉冲、Git 脉络、会话织锦；`大纲` 仅作为 Session Loom 内部 Tab。
- README、README.zh-CN、STATE 和截图验收记录均未把五个特色功能退回普通 Provider 表、Git Tab、旧上下文状态条或下载聊天记录按钮。

## 下一阶段建议

1. 在真实 iPhone PWA standalone 模式下手动验收 safe-area、键盘、focus trap、reduced motion、下载失败复制 / 分享 fallback。
2. 实机通过后运行最终全量 `bun run typecheck`、`bun run test`、`bun run build`、Git 规范和敏感信息扫描。
3. 按 `GIT-STANDARDS.md` 创建 `v0.18.0` tag 和 GitHub Release。
