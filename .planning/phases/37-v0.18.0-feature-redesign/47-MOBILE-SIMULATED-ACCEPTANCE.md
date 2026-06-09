# Phase 47 — v0.18.0 推送后移动端模拟验收

> 日期：2026-06-09  
> 分支：`feat/v0.18.0`  
> 范围：推送后移动端真实化 smoke、五大特色功能移动视口验收、截图证据刷新  
> 适用基线：`37-PROTOCOL-ADDENDUM.md`、`37-SECURITY-ADDENDUM.md`、`37-UX-ACCEPTANCE-MATRIX.md`、`37-BRAND-CONTRACT.md`

## 阶段计划

目标：在 `feat/v0.18.0` 已推送后，补一次更贴近真实运行路径的移动端验收，明确哪些是实际 Hub/Web 请求，哪些是受控 mock 数据覆盖的功能态。

1. 确认分支、作者、远端同步和本地服务状态。
2. 使用 iPhone 移动视口跑真实 Hub `/api/auth` 登录和 Web 页面加载 smoke。
3. 使用真实 React/Vite 前端与 Playwright mock API 数据跑五大特色功能态截图验收。
4. 补充 Hub 直接服务 Web 的同源移动 smoke，覆盖更接近单文件发布形态的路径。
5. 记录验收边界、风险和门禁结果，避免把模拟验收描述成真实 iOS 设备验收。

## 实施范围

- 已确认当前分支为 `feat/v0.18.0`，本地与 `origin/feat/v0.18.0` 同步。
- 已确认最新推送提交作者符合 `GIT-STANDARDS.md` 的唯一作者约束。
- 本地 Hub 监听 `127.0.0.1:3016`，使用本地占位 `CLI_API_TOKEN` 做验收。
- 已发现现有 Vite dev server：
  - `127.0.0.1:5173`
  - `127.0.0.1:5174`
- 已使用 Playwright Chromium 模拟：
  - iPhone compact：`390×844`
  - iPhone large：`430×932`
  - `hasTouch=true`
  - iPhone Safari UA
  - `prefers-reduced-motion: reduce`

## 验收结果

### 真实 Hub API

- `POST http://127.0.0.1:3016/api/auth`
  - 通过：返回 JWT 形态 token 和 `Web User`。
  - 文档不记录 token 原文。

### Vite 同源代理移动 smoke

- URL：`http://127.0.0.1:5173/?token=<local-test-token>`
- 视口：`390×844`
- 结果：通过。
- 实际浏览器请求：
  - `/api/auth`：`200`
  - `/api/sessions`：`200`
  - `/api/machines`：`200`
  - `/api/events`：`200`
  - `/api/visibility`：`200`
- 断言：
  - 登录后不再显示登录表单。
  - URL 中 token 参数被清理。
  - `prefers-reduced-motion: reduce` 生效。
  - 无横向滚动。
  - 控制台无非预期错误。

### Hub 同源静态前端移动 smoke

- URL：`http://127.0.0.1:3016/?token=<local-test-token>`
- 视口：`430×932`
- 结果：通过。
- 实际浏览器请求：
  - `/api/auth`：`200`
  - `/api/sessions`：`200`
  - `/api/machines`：`200`
  - `/api/events`：`200`
  - `/api/visibility`：`200`
- 断言：
  - Hub 直接服务 Web 与 API 同源路径可登录。
  - 空态页面没有横向滚动。
  - 安装提示位于底部安全区域内，没有遮挡主操作。
  - reduced motion 生效。
  - 控制台无非预期错误。

### Vite 跨源 Hub URL smoke

- URL：`http://127.0.0.1:5173/?hub=http://127.0.0.1:3016&token=<local-test-token>`
- 视口：`390×844`
- 结果：未通过，不计入默认通过项。
- 现象：浏览器拦截跨源 `http://127.0.0.1:3016/api/auth` 预检，页面停留在登录表单。
- 判断：当前本地 Hub `CORS_ORIGINS` 未包含 `http://127.0.0.1:5173`，而开发架构默认使用 Vite `/api` 同源代理；正式 Hub 静态前端为同源路径。此项记录为本地配置风险，不在本阶段放宽 CORS。

### 五大特色功能态

- 命令：`V018_SCREENSHOT_BASE_URL=http://127.0.0.1:5173 node scripts/generate-v018-screenshots.cjs`
- 结果：通过。
- 覆盖：
  - 模型星桥 / Model Nexus：Provider 健康、能力、模型缓存、Agent 分配矩阵。
  - 引导光标 / Guide Beam：`待发送队列`、`立即引导`、移动端 44px 触控目标。
  - 上下文脉冲 / Context Pulse：`上下文：40%`、popover、`51k/128k`、59/60/80/81 阈值源码断言。
  - Git 脉络 / Git Atlas：分支态势、变更地图、Diff 预览、提交篮、同步中心。
  - 会话织锦 / Session Loom：移动端 Panel、大纲/导出、导出预览、`[REDACTED_PATH]`、脱敏状态。
- 输出：
  - `docs/assets/screenshot-model-nexus.png`：64 KB
  - `docs/assets/screenshot-guide-beam.png`：52 KB
  - `docs/assets/screenshot-context-pulse.png`：71 KB
  - `docs/assets/screenshot-git-atlas.png`：143 KB
  - `docs/assets/screenshot-session-loom.png`：51 KB
- 备注：dev 模式 Service Worker registration error 和 mock duplicate key warning 与 Phase 44 记录一致，属于 dev/mock 噪音，不计为生产阻断。

## 修改文件

- `.planning/phases/37-v0.18.0-feature-redesign/47-MOBILE-SIMULATED-ACCEPTANCE.md`
- `docs/assets/screenshot-model-nexus.png`
- `docs/assets/screenshot-guide-beam.png`
- `docs/assets/screenshot-context-pulse.png`
- `docs/assets/screenshot-git-atlas.png`
- `docs/assets/screenshot-session-loom.png`

## 自审结论

- 推送后移动端验收覆盖了两条真实同源路径：
  - Vite dev server 通过 `/api` 代理访问 Hub。
  - Hub 直接服务 Web 和 API。
- 五大特色功能态继续使用真实前端组件、真实路由和受控 mock API 数据，不是静态 HTML 拼图。
- Guide Beam、Context Pulse、Git Atlas、Session Loom 的移动端核心可见性、触控目标、reduced motion 和导出脱敏证据仍然通过。
- 已明确记录跨源 Vite→Hub 的 CORS 配置限制，避免把失败路径包装成通过。
- 本阶段没有修改产品代码；新增内容为验收记录和截图刷新。

## 已知风险

- 本阶段仍是 Playwright 移动模拟验收，不等同于真实 iPhone PWA standalone 实机验收。
- 真实 iOS 上的键盘遮挡、focus trap、系统分享 sheet、下载失败复制 / 分享 fallback 仍需人工设备复核。
- 若团队希望支持 Vite 页面显式指定远端 Hub，需要在启动 Hub 时配置 `CORS_ORIGINS`，或另行设计受控 CORS 策略；本阶段不扩大默认跨源访问面。
- 本地 smoke 使用占位弱 token，仅用于本机验收，不能作为生产配置示例。

## 门禁对照

### `37-PROTOCOL-ADDENDUM`

- Guide Beam 功能态继续覆盖 thinking 下的 `排队 / 立即引导`、普通队列并存和引导状态展示。
- 本阶段不改 Hub/CLI 协议；capability handshake、isolated queue、fallback、`messages-consumed` 时序仍以 Phase 39 测试为主证据。

### `37-SECURITY-ADDENDUM`

- 文档不记录 JWT、真实 API key、真实 Git credential 或个人路径。
- Session Loom 截图继续覆盖默认导出脱敏和 `[REDACTED_PATH]`。
- 跨源 CORS 失败未通过放宽服务端策略绕过，保持最小访问面。

### `37-UX-ACCEPTANCE-MATRIX`

- 覆盖 `390×844` 和 `430×932` 两档 iPhone 视口。
- 五功能脚本继续覆盖 desktop、mobile、多面板和 reduced motion。
- 移动端 smoke 断言无横向滚动，底部安装提示和主操作未出现明显遮挡。

### `37-BRAND-CONTRACT`

- 截图证据继续保持五节点顺序：接入 → 驾驶 → 观测 → 追踪 → 沉淀。
- README 截图资产仍对应模型星桥、引导光标、上下文脉冲、Git 脉络、会话织锦。

## 下一阶段建议

1. 使用真实 iPhone Safari 安装到主屏幕后进行 standalone 模式验收。
2. 若需要跨源 Web→Hub 直连体验，单独制定 CORS 安全策略和测试矩阵。
3. 发布前再次运行全量 `typecheck`、`test`、`build`、Git 规范和敏感信息扫描。
