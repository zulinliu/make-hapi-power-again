# Phase 38 — 模型星桥 / Model Nexus 实施记录

## 阶段计划

目标：按 Phase 37 基线先完成 Model Nexus 基础设施，为后续 Context Pulse、Guide Beam、Session Loom 的供应商能力与模型选择打底。

1. Provider 数据结构扩展：namespace、protocol、health、capabilities、model cache、default model。
2. Hub API 与 Store：Provider CRUD、overview、health check、model discovery、assignment matrix、key reveal。
3. 安全治理：Provider SSRF 校验、redirect 防护、诊断脱敏、namespace 隔离、reveal 二次确认。
4. Web 设置页：从普通 Provider 列表升级为 Model Nexus 控制舱，包含健康总览、Provider 卡、Agent 分配矩阵。
5. Provider Wizard：补齐 Protocol / Connection / Capability / Assignment 四步接入流，保存后可立即分配 Agent 默认路由。
6. 测试与文档：补 Hub route/store/security 测试、Web 组件/i18n parity 测试，并完成阶段自审。

## 实施范围

- 完成 `shared/src/providers.ts` 的 Provider schema 与 response 类型扩展。
- 完成 Hub `providers` / `provider_assignments` v12 schema 与 V11→V12 迁移。
- 完成 namespace-aware `ProviderStore`，支持同名跨 namespace 隔离、健康状态、模型缓存与默认模型。
- 完成 Provider 安全校验服务，覆盖 URL、DNS、IP literal、redirect 与诊断脱敏。
- 完成 Model Discovery 服务，支持公开 DNS 校验、候选模型 endpoint、响应大小限制、错误诊断保留与缓存。
- 完成 `/api/providers` 路由的 overview、check、discover-models、assign、reveal-key-token 等接口。
- 完成 session/machine spawn 模型选择携带 `providerId`。
- 完成 Web API client、Query/Mutation hooks、query keys 与 `ProviderSettings` UI 更新。
- 完成四步 Provider Wizard，新增供应商时可选择协议、连接信息、能力准备与 Agent 分配。
- 完成 en / zh-CN Model Nexus i18n 文案。

## 修改文件

- `shared/src/providers.ts`
- `hub/src/services/providerSecurity.ts`
- `hub/src/services/providerSecurity.test.ts`
- `hub/src/services/modelDiscovery.ts`
- `hub/src/services/modelDiscovery.test.ts`
- `hub/src/store/index.ts`
- `hub/src/store/providerStore.ts`
- `hub/src/store/providerStore.test.ts`
- `hub/src/store/migration-v12.test.ts`
- `hub/src/web/routes/providers.ts`
- `hub/src/web/routes/providers.test.ts`
- `hub/src/web/routes/sessions.ts`
- `hub/src/web/routes/machines.ts`
- `web/src/api/client.ts`
- `web/src/components/ProviderSettings.tsx`
- `web/src/components/ProviderSettings.test.tsx`
- `web/src/hooks/mutations/useProviders.ts`
- `web/src/hooks/queries/useProviders.ts`
- `web/src/lib/query-keys.ts`
- `web/src/lib/locales/en.ts`
- `web/src/lib/locales/zh-CN.ts`
- `web/src/lib/locales/model-nexus-i18n.test.ts`

## 测试结果

- `bun test hub/src/services/providerSecurity.test.ts hub/src/services/modelDiscovery.test.ts hub/src/store/providerStore.test.ts hub/src/store/migration-v12.test.ts hub/src/web/routes/providers.test.ts hub/src/web/routes/sessions.test.ts hub/src/web/routes/machines.test.ts`
  - 通过：108 pass, 0 fail
- `bun run --cwd web vitest run src/components/ProviderSettings.test.tsx src/lib/locales/model-nexus-i18n.test.ts`
  - 通过：8 pass, 0 fail
- `bun run typecheck:hub`
  - 通过
- `bun run typecheck:web`
  - 通过
- `bun run test:hub`
  - 第一次全量运行出现 `NotificationHub > throttles ready notifications per session` 计时类波动，376 pass / 1 fail；该测试文件单独复跑 4 pass，且相关文件无 diff。
  - 第二次全量复跑通过：377 pass, 0 fail
- `bun run test:web`
  - 通过：704 pass, 0 fail
  - 备注：输出包含既有 Browserslist 数据过期提示与 jsdom navigation not implemented 警告，不影响测试结果。
- `bun run typecheck`
  - 通过
- `bun run test:shared`
  - 通过：49 pass, 0 fail
- Browser 移动端烟测（`http://localhost:5174/settings`，390×844）
  - Model Nexus 首屏、登录后设置页、Add CTA、空状态正常渲染。
  - Wizard 动画结束后实测：Protocol radio 44px；Connection 输入框 45.33px；Capability 输入框 45.33px；Assignment 可点击 label 44px；底部 Back/Next/Save 46px；无横向溢出。

## 自审结论

- Provider namespace 已成为 Store、route、assignment、health check、model discovery、key reveal 的过滤边界。
- SSRF 防护已覆盖 scheme、userinfo、localhost、私网/metadata IP、IPv4 变体、IPv4-mapped IPv6、IPv6 ULA/link-local `/10`、DNS 解析、DNS rebinding、redirect、HTTPS 降级、非标准端口策略、整体 deadline、读取超时与响应大小。
- Model Discovery 使用受控 lookup 绑定真实连接校验，显式 protocol 优先于 hostname 推断；Google/Gemini 内部 `key` query 例外仅在探测候选 URL 内部临时允许，用户提交的敏感 query 默认拒绝。
- Discovery cache 纳入 namespace、providerId、baseUrl、protocol 与版本；更新 baseUrl/apiKey/protocol 会失效缓存；失败 check 只更新 health/diagnostic，不清空 last-known-good model cache。
- 诊断返回使用安全字段，不返回完整 header、Authorization、x-api-key、query key、裸 key 前缀或完整上游错误体。
- Key reveal 新 UI 使用显式确认动作，先创建短 TTL 一次性 reveal token，再调用 reveal 接口；前端默认只展示 masked key，复制失败时使用 textarea fallback。
- Model Nexus 首屏不再是普通 CRUD 表格，包含品牌标题、健康总览、Provider 卡、模型数/延迟/协议/default model、usage/context/tool/vision 能力摘要、Agent 分配矩阵和主 CTA。
- Provider Wizard 已完成四步接入，保存后按用户选择立即调用 Agent 分配矩阵 mutation。
- Dialog 标题与描述改用 Radix 可识别的 `DialogTitle` / `DialogDescription`，消除 reveal 弹窗 a11y 警告。
- en 与 zh-CN 新增 key 通过 Model Nexus i18n parity 测试。

## 门禁对照

- `37-PROTOCOL-ADDENDUM.md`：本阶段未实施 Guide Beam 协议，未触碰 queue/abort/messages-consumed 路径；不影响 Guide 门禁。
- `37-SECURITY-ADDENDUM.md`：Provider namespace、SSRF、DNS TOCTOU 缓解、redirect、diagnostic redaction、敏感 query 拒绝、一次性 key reveal token 已落地并有测试覆盖。Reveal 审计目前记录为服务端安全日志，后续可接入统一审计事件流。
- `37-UX-ACCEPTANCE-MATRIX.md`：Model Nexus 首屏、空状态、Provider 卡、可见操作入口、44px touch target、四步 Wizard、Dialog a11y、copy fallback 已覆盖，并完成 390×844 Browser 实测。
- `37-BRAND-CONTRACT.md`：UI 主标题使用 `模型星桥 / Model Nexus` 对应 i18n key；功能顺序与 README 总体品牌整合留到 Phase 42 统一处理。

## 已知风险

- Key reveal 尚未写入统一审计事件流；当前接口有 confirm、一次性 token、TTL、namespace 校验和安全日志记录，但审计持久化需在安全日志体系中继续补齐。
- Provider capability 已能记录模型、messages、usage/context 相关字段，Context Pulse 尚未消费这些诊断。
- Browser 已覆盖 390×844 移动视口和 Wizard 触控尺寸；iOS PWA 实机键盘/safe-area/download fallback 验收留给后续品牌整合/发布准备阶段。

## 评审与修复

- 已启动并回收多子代理只读评审：研发代码审查、安全审查、UI/i18n 审查、测试覆盖审查。
- 已修复评审指出的问题：
  - DNS TOCTOU：Model Discovery 改为受控 lookup，并补 DNS rebinding 测试。
  - Redirect：改为 manual redirect，阻断跨 host、userinfo、私网 literal 与 HTTPS 降级。
  - IPv6：补完整 link-local `/10`、IPv4-mapped IPv6 与 metadata IP 测试。
  - 端口与 query：创建/更新 provider 默认拒绝非标准端口和敏感 query 参数；内部 Gemini `key` 例外收窄到探测候选 URL。
  - 超时与响应大小：连接和 body read 共用整体 deadline，响应体限制 1MB。
  - 协议：显式 Anthropic/Gemini protocol 在泛代理 host 上优先生效。
  - 缓存：provider 配置更新会失效 discovery cache，失败 check 保留 last-known-good model cache。
  - Machine spawn：明确传入 `providerId` 时 provider 缺失、解密失败或配置应用失败会返回错误，不静默成功。
  - V12 迁移：旧默认 assignment 按 namespace/flavor 收敛为单一默认。
  - Reveal：旧 GET 明文接口返回 410；新 POST 两步 token 只能消费一次。
  - UI：补四步 Wizard、DialogDescription、字段 label/id、host label、capability chips、blocked/unknown summary、品牌 CTA、中文 i18n parity 与移动端 44px 实测。

## 下一阶段建议

1. 进入 Guide Beam + Context Pulse 前，先实现 deliveryMode schema 与 capability handshake 的最小垂直切片。
2. Codex Guide interrupt 必须新建 preserve-queue 路径，禁止复用会 `queue.reset()` 的 abort/reset。
3. Context Pulse 优先消费本阶段 Provider capability 与 session latest usage cache，并补 59/60/80/81 阈值测试。
