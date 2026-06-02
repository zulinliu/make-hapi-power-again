# Requirements: Hapi Power v0.7 — 自定义模型 API 配置与切换

**Defined:** 2026-05-31
**Core Value:** 让 AI 编码代理拥有完整的开发者环境 — 代码编辑、终端操作、版本控制、插件扩展、自定义模型 API 配置，全部在浏览器中完成。
**Reference:** .planning/research/V07-CC-SWITCH-RESEARCH.md

## v0.7 Requirements

### Provider Management（供应商管理）

- [ ] **PROV-01**: 用户可以创建 API 供应商（名称 + Base URL + API Key + 分配给哪些代理）
- [ ] **PROV-02**: 用户可以编辑已有供应商的所有字段
- [ ] **PROV-03**: 用户可以删除供应商（删除前确认）
- [ ] **PROV-04**: 用户可以在供应商列表中查看所有已配置的供应商及其分配状态
- [ ] **PROV-05**: 一个供应商可以被多个代理（Claude/Codex/Gemini/OpenCode）共用
- [ ] **PROV-06**: 供应商的 API Key 使用 AES-256-GCM 加密存储在 SQLite 中
- [ ] **PROV-07**: Base URL 支持 HTTP/HTTPS，且经过 SSRF 防护校验
- [ ] **PROV-08**: 供应商支持可选的备注字段（notes）

### Model Discovery（模型发现）

- [ ] **MODEL-01**: 用户可以从已配置的供应商自动拉取可用模型列表
- [ ] **MODEL-02**: 模型发现使用 /v1/models 端点，支持多候选 URL 自动降级
- [ ] **MODEL-03**: 兼容子路径自动剥离（/anthropic、/claudecode 等 10 种已知后缀）
- [ ] **MODEL-04**: 模型发现结果包含模型 ID 和显示名称
- [ ] **MODEL-05**: 模型发现支持多协议认证（x-api-key、Bearer、URL query key）
- [ ] **MODEL-06**: 模型发现失败时显示明确的错误信息

### Provider Assignment & Switching（供应商分配与切换）

- [ ] **ASSIGN-01**: 用户可以将供应商分配给特定代理（Claude/Codex/Gemini/OpenCode）
- [ ] **ASSIGN-02**: 每个代理可以有一个"默认供应商"和"当前会话供应商"
- [ ] **ASSIGN-03**: 切换供应商时，Hub 通过 RPC 将配置下发到 CLI
- [ ] **ASSIGN-04**: CLI 接收到供应商配置后，更新运行时环境变量（ANTHROPIC_BASE_URL 等）
- [ ] **ASSIGN-05**: 供应商切换对正在进行的会话即时生效
- [ ] **ASSIGN-06**: 新建会话时可以选择使用哪个供应商（或使用代理默认）

### UI Integration（UI 融合）

- [ ] **UI-01**: ModelSelector 下拉框内直接展示"自定义供应商"选项
- [ ] **UI-02**: 点击"自定义供应商"选项后展开配置面板（内联或弹窗）
- [ ] **UI-03**: 配置面板支持填写 Base URL、API Key、选择供应商
- [ ] **UI-04**: 模型选择器下拉框同时展示静态预设模型和供应商动态模型
- [ ] **UI-05**: 供应商配置的增删改操作在 Settings 页面完成
- [ ] **UI-06**: Settings 页面新增"API 供应商"管理区域
- [ ] **UI-07**: AgentSelector 选择代理后，ModelSelector 自动更新为该代理的可用供应商+模型

### Hub Backend（Hub 后端）

- [ ] **HUB-01**: Hub 新增 providers 数据库表（id, name, base_url, api_key_encrypted, notes, created_at, updated_at）
- [ ] **HUB-02**: Hub 新增 provider_assignments 表（provider_id, agent_flavor, is_default）
- [ ] **HUB-03**: Hub 新增 REST API：GET/POST/PUT/DELETE /api/providers
- [ ] **HUB-04**: Hub 新增 REST API：POST /api/providers/:id/assign（分配给代理）
- [ ] **HUB-05**: Hub 新增 REST API：POST /api/providers/:id/discover-models（模型发现）
- [ ] **HUB-06**: Hub 新增 RPC 方法：provider/switch（供应商切换下发到 CLI）
- [ ] **HUB-07**: API Key 加密/解密使用 AES-256-GCM，密钥从环境变量读取
- [ ] **HUB-08**: /api/sessions/:id/model 端点扩展：支持指定供应商+模型组合

### CLI Integration（CLI 集成）

- [ ] **CLI-01**: CLI 新增 RPC 处理：接收供应商配置并更新运行时环境变量
- [ ] **CLI-02**: CLI 的 AgentBackend.setModel() 扩展：支持传入 base_url + api_key
- [ ] **CLI-03**: CLI 在会话 metadata 中记录当前使用的供应商信息

### Shared Protocol（共享协议）

- [ ] **SHARED-01**: shared/src 新增 Provider Schema（Zod）：id, name, baseUrl, apiKeyRef, notes
- [ ] **SHARED-02**: shared/src 新增 ProviderAssignment Schema：providerId, agentFlavor, isDefault
- [ ] **SHARED-03**: shared/src/apiTypes 扩展 SpawnSessionRequest：支持 providerId 字段
- [ ] **SHARED-04**: shared/src/rpcMethods 新增 RPC 方法常量：provider/switch

## v0.8 Requirements（规划，不在当前范围）

### Protocol Conversion（协议转换）

- **PC-01**: Hub 端实现 Anthropic ↔ OpenAI Chat Completions 双向转换
- **PC-02**: Hub 端实现 Anthropic ↔ OpenAI Responses API 转换（Codex）
- **PC-03**: Hub 端实现 Anthropic ↔ Gemini Native 格式转换
- **PC-04**: 熔断器 + 故障转移队列
- **PC-05**: 流式响应透传（SSE）
- **PC-06**: 供应商健康检查（流式 API 调用检测）
- **PC-07**: 用量统计（Token 计数 + 费用估算）

## Out of Scope

| Feature | Reason |
|---------|--------|
| 供应商预设模板 | 用户自定义足够，避免维护负担 |
| 协议转换 | v0.8 实现，v0.7 用户可使用第三方中转服务 |
| 故障转移/熔断器 | 依赖协议转换，延后到 v0.8 |
| 用量统计/定价 | 依赖协议转换，延后到 v0.8 |
| MCP 服务器管理 | 已有上游功能，不在 v0.7 范围 |
| Skills/Prompts 管理 | 已有上游功能，不在 v0.7 范围 |
| WebDAV 同步 | 个人开发者自托管场景不需要 |
| 深链接导入 | 高级功能，延后 |
| Cursor/Kimi 代理 | v0.7 聚焦 Claude/Codex/Gemini/OpenCode |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 ~ PROV-08 | Phase 34 | Pending |
| MODEL-01 ~ MODEL-06 | Phase 35 | Pending |
| HUB-01 ~ HUB-08 | Phase 34 | Pending |
| SHARED-01 ~ SHARED-04 | Phase 34 | Pending |
| CLI-01 ~ CLI-03 | Phase 36 | Pending |
| ASSIGN-01 ~ ASSIGN-06 | Phase 36 | Pending |
| UI-01 ~ UI-07 | Phase 37 | Pending |

**Coverage:**
- v0.7 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-31*
*Last updated: 2026-05-31 after v0.7 planning*
