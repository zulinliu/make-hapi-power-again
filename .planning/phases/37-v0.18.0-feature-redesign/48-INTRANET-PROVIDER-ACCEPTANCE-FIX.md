# Phase 37 调试修复记录：内网 Provider 与验收环境

## 实施范围

- Model Nexus SSRF 策略新增受控私网 Provider 开关。
- 默认安全策略保持不变：未开启策略时继续阻断解析到内网、metadata、loopback、link-local 的 Provider。
- 开启 `HAPI_POWER_PROVIDER_ALLOW_PRIVATE_NETWORKS=1` 后允许 RFC1918 / CGNAT 公司内网地址。
- metadata、localhost、loopback、link-local、保留/文档/多播地址仍不放行。
- 新增 `HAPI_POWER_PROVIDER_ALLOW_NON_STANDARD_PORTS=1`，用于受控允许内网网关非 80/443 端口；默认仍拒绝。
- Provider 保存、模型发现、健康检查、flavor model fallback 使用同一安全策略，避免保存和探测策略不一致。
- 前端中英文错误提示更新为“管理员可开启受控私网供应商策略”。

## 修改文件

- `hub/src/services/providerSecurity.ts`
- `hub/src/services/modelDiscovery.ts`
- `hub/src/web/routes/providers.ts`
- `hub/src/services/providerSecurity.test.ts`
- `hub/src/services/modelDiscovery.test.ts`
- `hub/src/web/routes/providers.test.ts`
- `web/src/components/ProviderSettings.tsx`
- `web/src/components/ProviderSettings.test.tsx`
- `web/src/lib/locales/en.ts`
- `web/src/lib/locales/zh-CN.ts`
- `web/src/lib/locales/model-nexus-i18n.test.ts`

## 测试结果

- `bun test hub/src/services/providerSecurity.test.ts hub/src/services/modelDiscovery.test.ts hub/src/web/routes/providers.test.ts`
  - 65 tests passed。
- `cd hub; bun run typecheck`
  - 通过。
- `cd web; bun run typecheck`
  - 通过。
- `cd web; bun run test -- src/components/ProviderSettings.test.tsx src/lib/locales/model-nexus-i18n.test.ts`
  - 9 tests passed。

## 追加修复：模型探测 DNS lookup 兼容

### 问题

- 内网 Provider 已可保存，但点击“检查”和“发现模型”时报错：
  - `results.sort is not a function`
- 根因是保存阶段只执行 URL 安全校验；检查/发现模型阶段会通过安全 HTTP transport 发起真实请求。
- Bun 在 `node:http` 请求中可能以 `lookup({ all: true })` 调用自定义 DNS lookup，并期望回调返回 `LookupAddress[]`；旧实现始终按普通 lookup 返回单个地址，导致运行时内部排序崩溃。

### 修复范围

- `hub/src/services/modelDiscovery.ts`
  - `createSafeLookup` 支持 `options.all`，返回 `{ address, family }[]`。
  - 普通 lookup 仍返回单地址和 family。
  - 保留 DNS 解析后的 SSRF 校验、私网策略、metadata/loopback/link-local 阻断。
- `hub/src/services/modelDiscovery.test.ts`
  - 新增 `createSafeLookup` 回归测试，覆盖 `all: true` 和普通 lookup 两种回调形态。

### 追加验证

- `bun test hub/src/services/modelDiscovery.test.ts hub/src/services/providerSecurity.test.ts hub/src/web/routes/providers.test.ts`
  - 67 tests passed。
- `cd hub; bun run typecheck`
  - 通过。
- 本地验收环境重启 Hub 后，使用开发 token 登录并调用真实 Provider 检查接口：
  - `POST /api/providers/:id/check`
  - 返回 `success: true`，health 更新为 `online`，模型缓存写入 25 个模型。
- 继续调用：
  - `POST /api/providers/:id/discover-models`
  - 返回 `success: true`，模型数量 25。
- 两个接口均未再出现 `results.sort is not a function`。

## 追加修复：检查与发现模型职责拆分

### 问题

- “检查”和“发现模型”此前都使用模型探测链路，用户感知上像同一个按钮。
- “发现模型”成功后没有在 Provider 卡片中直接展示模型列表，用户无法确认拉取结果。

### 修复范围

- `hub/src/services/modelDiscovery.ts`
  - `DiscoveryOptions` 新增 `cache?: boolean`，允许健康检查绕过 discovery 内存缓存。
- `hub/src/web/routes/providers.ts`
  - `POST /api/providers/:id/check` 只刷新 `health` 和安全诊断，不写入 `modelCache`。
  - `POST /api/providers/:id/discover-models` 继续负责刷新模型缓存。
- `web/src/components/ProviderSettings.tsx`
  - Provider 卡片拆分 `isChecking` / `isDiscovering` 状态。
  - “检查”按钮只显示健康检查 loading。
  - “发现模型”按钮显示发现模型 loading。
  - 新增“可用模型 / Available models”列表，展示模型数量、更新时间、模型 ID/name/owner 和空态。
- `web/src/lib/locales/en.ts`、`web/src/lib/locales/zh-CN.ts`
  - 补齐模型列表中英文文案。

### 追加验证

- `bun test hub/src/web/routes/providers.test.ts hub/src/services/modelDiscovery.test.ts`
  - 52 tests passed。
- `cd web; bun run test -- src/components/ProviderSettings.test.tsx src/lib/locales/model-nexus-i18n.test.ts`
  - 11 tests passed。
- `bun run typecheck:hub`
  - 通过。
- `bun run typecheck:web`
  - 通过。
- `bun run build:web`
  - 通过；当前 3016 页面加载 `/assets/index-kV22Fdfq.js`。
- 本地 3016 运行态 API 验收：
  - 使用开发 token `123456` 通过 `/api/auth` 换取 JWT。
  - `GET /api/providers/overview` 返回内网 Provider `online`，模型缓存数量为 25。
- 移动端真实化验收：
  - 使用系统 Chrome + Playwright `iPhone 13` 视口访问 `http://127.0.0.1:3016/settings?acceptance=intranet-provider-mobile&token=123456`。
  - 页面可见 `检查` / `发现模型` / `可用模型` / `25 models found`。
  - 页面可见 Provider 名称和模型项，如 `claude-sonnet-4-6-web`、`deepseek-v4-flash`、`deepseek-v4-pro`。
  - `pageErrors` 为空，过滤浏览器扩展噪声后无前端 console issue。

## 自审结论

- 满足用户在公司内网环境同时支持公网和内网 API 供应商的验收诉求。
- SSRF 防护未默认放宽；必须显式设置环境变量才允许内网 Provider。
- 显式策略只允许公司内网范围，不允许 metadata / loopback / link-local。
- 诊断和错误提示仍不回显 API key。
- 测试和文档未写入用户真实供应商 key。
- “检查”与“发现模型”的用户可见语义已拆分：前者用于健康状态，后者用于拉取并展示模型列表。

## 已知风险

- 开启 `HAPI_POWER_PROVIDER_ALLOW_PRIVATE_NETWORKS=1` 后，管理员需要确认 Hub 运行环境的网络边界可信。
- 内网 DNS 若返回 metadata/link-local 地址仍会被阻断，符合 Phase 37 安全门禁。
- 当前验收需要同时启动 Hub 和 CLI runner；仅启动 Hub 时新建会话会显示无可用机器。

## 门禁符合性

- `37-PROTOCOL-ADDENDUM`：无协议破坏；Provider 探测继续走安全校验和缓存链路。
- `37-SECURITY-ADDENDUM`：默认阻断 SSRF 风险；显式内网策略保留 metadata / loopback / link-local 阻断；模型列表和诊断不泄露 API key。
- `37-UX-ACCEPTANCE-MATRIX`：前端错误提示改为可执行的管理员策略说明；模型发现结果在移动端可见。
- `37-BRAND-CONTRACT`：文案保持“模型星桥 / Model Nexus”命名，不新增第三方品牌残留。

## 下一阶段建议

- 验收环境使用：
  - `CLI_API_TOKEN=123456`
  - `HAPI_POWER_PROVIDER_ALLOW_PRIVATE_NETWORKS=1`
  - 如内网 Provider 使用非标准端口，再加 `HAPI_POWER_PROVIDER_ALLOW_NON_STANDARD_PORTS=1`
- 启动 Hub 后必须启动 CLI runner，并传入当前工作区作为 `--workspace-root`，用于新建会话机器注册。
