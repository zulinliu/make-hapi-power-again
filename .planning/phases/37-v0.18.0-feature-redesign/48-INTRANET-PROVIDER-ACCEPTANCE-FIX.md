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
- `web/src/lib/locales/en.ts`
- `web/src/lib/locales/zh-CN.ts`

## 测试结果

- `bun test hub/src/services/providerSecurity.test.ts hub/src/services/modelDiscovery.test.ts hub/src/web/routes/providers.test.ts`
  - 65 tests passed。
- `cd hub; bun run typecheck`
  - 通过。
- `cd web; bun run typecheck`
  - 通过。
- `cd web; bun run test -- src/components/ProviderSettings.test.tsx src/lib/locales/model-nexus-i18n.test.ts`
  - 9 tests passed。

## 自审结论

- 满足用户在公司内网环境同时支持公网和内网 API 供应商的验收诉求。
- SSRF 防护未默认放宽；必须显式设置环境变量才允许内网 Provider。
- 显式策略只允许公司内网范围，不允许 metadata / loopback / link-local。
- 诊断和错误提示仍不回显 API key。
- 测试和文档未写入用户真实供应商 key。

## 已知风险

- 开启 `HAPI_POWER_PROVIDER_ALLOW_PRIVATE_NETWORKS=1` 后，管理员需要确认 Hub 运行环境的网络边界可信。
- 内网 DNS 若返回 metadata/link-local 地址仍会被阻断，符合 Phase 37 安全门禁。
- 当前验收需要同时启动 Hub 和 CLI runner；仅启动 Hub 时新建会话会显示无可用机器。

## 门禁符合性

- `37-PROTOCOL-ADDENDUM`：无协议破坏；Provider 探测继续走安全校验和缓存链路。
- `37-SECURITY-ADDENDUM`：默认阻断 SSRF 风险；显式内网策略保留 metadata / loopback / link-local 阻断。
- `37-UX-ACCEPTANCE-MATRIX`：前端错误提示改为可执行的管理员策略说明。
- `37-BRAND-CONTRACT`：文案保持“模型星桥 / Model Nexus”命名，不新增第三方品牌残留。

## 下一阶段建议

- 验收环境使用：
  - `CLI_API_TOKEN=123456`
  - `HAPI_POWER_PROVIDER_ALLOW_PRIVATE_NETWORKS=1`
  - 如内网 Provider 使用非标准端口，再加 `HAPI_POWER_PROVIDER_ALLOW_NON_STANDARD_PORTS=1`
- 启动 Hub 后必须启动 CLI runner，并传入当前工作区作为 `--workspace-root`，用于新建会话机器注册。
