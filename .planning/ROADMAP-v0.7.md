# Roadmap: Hapi Power v0.7 — 自定义模型 API 配置与切换

## Overview

v0.7 新增自定义模型 API 配置与切换功能，允许用户为 Claude/Codex/Gemini/OpenCode 配置第三方 API 供应商（自定义 Base URL + API Key），并自动发现可用模型。功能完全融入现有 AgentSelector + ModelSelector 体验。

**参考研究**: .planning/research/V07-CC-SWITCH-RESEARCH.md

**设计决策**:
- 全局供应商池（非按应用独立管理）
- 无供应商预设模板（用户自定义）
- SQLite + AES-256-GCM 加密存储 API Key
- Hub→CLI RPC 配置下发（不修改 CLI 配置文件）
- ModelSelector 下拉框内完全融合
- 协议转换延后到 v0.8

## Phases

- [ ] **Phase 34: 数据模型与后端 API** — 数据库表、加密存储、Provider CRUD API
- [ ] **Phase 35: 模型发现引擎** — /v1/models 探测、候选 URL 构建、多协议认证
- [ ] **Phase 36: CLI 集成与配置下发** — RPC 扩展、运行时环境变量更新
- [ ] **Phase 37: 前端 UI 融合** — Settings 供应商管理 + ModelSelector 下拉框融合
- [ ] **Phase 38: 集成测试与优化** — 端到端测试、边界情况处理、性能优化

## Phase Details

### Phase 34: 数据模型与后端 API
**Goal**: 建立 Provider 数据模型，实现加密存储和 CRUD API
**Depends on**: Nothing（基于现有 Hub 基础设施）
**Requirements**: PROV-01~08, HUB-01~04, HUB-07, SHARED-01~04
**Success Criteria**:
  1. providers 和 provider_assignments 表创建成功，Schema 迁移脚本执行无错
  2. API Key 使用 AES-256-GCM 加密存储，解密后可正确还原
  3. Provider CRUD API（GET/POST/PUT/DELETE /api/providers）全部可用
  4. 供应商分配 API（POST /api/providers/:id/assign）可用
  5. Base URL 经过 SSRF 防护校验（仅允许 http/https，禁止内网地址）
  6. shared/src 新增 Provider/ProviderAssignment Zod Schema
  7. 所有 API 返回统一 ApiResponse<T> 格式

**Tasks**:
1. shared/src：新增 Provider Schema（Zod）、ProviderAssignment Schema、扩展 SpawnSessionRequest、新增 RPC 方法常量
2. hub/src：新增数据库迁移脚本（providers + provider_assignments 表）
3. hub/src：实现 AES-256-GCM 加密/解密工具（密钥从环境变量读取）
4. hub/src：新增 /api/providers CRUD 路由（createSessionsRoutes 同级）
5. hub/src：新增 /api/providers/:id/assign 路由
6. hub/src：Base URL SSRF 校验中间件
7. 测试：Provider CRUD API 端到端测试

### Phase 35: 模型发现引擎
**Goal**: 实现从第三方 API 供应商自动拉取可用模型列表
**Depends on**: Phase 34
**Requirements**: MODEL-01~06, HUB-05
**Success Criteria**:
  1. POST /api/providers/:id/discover-models 返回模型列表
  2. 多候选 URL 自动降级：主 URL 404/405 时尝试剥离后缀的候选
  3. 兼容子路径剥离：自动识别并尝试 /anthropic、/claudecode 等 10 种后缀
  4. 多协议认证：Anthropic（x-api-key）、Google（URL query key）、OpenAI（Bearer）
  5. 模型发现失败时返回明确错误信息（超时、认证失败、端点不可达）
  6. 超时控制：单次请求 15 秒，总超时 30 秒

**Tasks**:
1. hub/src/services：新增 ModelDiscoveryService
2. hub/src/services：实现候选 URL 构建逻辑（buildModelsUrlCandidates）
3. hub/src/services：实现多协议认证适配（AuthAdapter per provider）
4. hub/src：新增 /api/providers/:id/discover-models 路由
5. hub/src：实现模型发现缓存（TTL 5 分钟）
6. 测试：模型发现服务单元测试 + Mock API 集成测试

### Phase 36: CLI 集成与配置下发
**Goal**: Hub 通过 RPC 将供应商配置下发到 CLI，CLI 更新运行时环境变量
**Depends on**: Phase 34
**Requirements**: ASSIGN-01~06, HUB-06, HUB-08, CLI-01~03
**Success Criteria**:
  1. Hub 新增 RPC 方法 provider/switch，包含 base_url + api_key + model
  2. CLI 接收到 RPC 后更新 AgentBackend 的运行时环境变量
  3. 供应商切换对正在进行的会话即时生效（模型变更已验证可行）
  4. /api/sessions/:id/model 扩展支持 providerId 参数
  5. 会话 metadata 记录当前供应商信息
  6. 新建会话时 spawn 命令支持 providerId 参数

**Tasks**:
1. shared/src：新增 RPC 方法常量 provider/switch
2. hub/src：扩展 sessionConfigRpc，新增 provider/switch handler
3. hub/src：扩展 /api/sessions/:id/model 端点，支持 providerId
4. hub/src：扩展 spawnSession，支持 providerId 参数
5. cli/src：扩展 AgentBackend.setModel()，支持 base_url + api_key
6. cli/src：扩展 sessionConfigRpc 处理 provider/switch
7. 测试：RPC 端到端测试（Hub→CLI 配置下发）

### Phase 37: 前端 UI 融合
**Goal**: 供应商管理 UI 完全融入现有 ModelSelector 和 Settings 页面
**Depends on**: Phase 35, Phase 36
**Requirements**: UI-01~07
**Success Criteria**:
  1. ModelSelector 下拉框展示"自定义供应商"选项
  2. 点击"自定义供应商"展开配置面板（Base URL + API Key + 模型选择）
  3. 下拉框同时展示静态预设模型和供应商动态模型
  4. Settings 页面新增"API 供应商"管理区域（列表 + 添加/编辑/删除）
  5. AgentSelector 切换代理后，ModelSelector 自动更新
  6. 供应商配置保存后立即可用（无需刷新）
  7. API Key 输入框使用密码遮罩

**Tasks**:
1. web/src/api：新增 Provider API hooks（useProviders, useCreateProvider 等）
2. web/src：Settings 页面新增"API 供应商"区域
3. web/src：新增 ProviderForm 组件（Base URL + API Key + 代理分配）
4. web/src：扩展 ModelSelector，融合自定义供应商选项
5. web/src：新增 ProviderModelSelector 组件（从供应商拉取模型并选择）
6. web/src：AgentSelector 与 ModelSelector 联动更新
7. 测试：前端组件单元测试 + 交互测试

### Phase 38: 集成测试与优化
**Goal**: 端到端测试覆盖全部 v0.7 功能，处理边界情况
**Depends on**: Phase 37
**Requirements**: All v0.7 requirements
**Success Criteria**:
  1. 完整流程测试：创建供应商 → 分配代理 → 发现模型 → 切换供应商 → 会话生效
  2. 边界情况：无效 URL、过期 API Key、网络超时、空模型列表
  3. 安全测试：API Key 加密验证、SSRF 防护验证
  4. 性能测试：模型发现响应时间 < 5s（正常网络）
  5. 兼容性测试：与现有静态模型选择器共存无冲突

**Tasks**:
1. 端到端测试：完整供应商管理流程
2. 边界测试：错误处理和降级策略
3. 安全测试：加密和 SSRF 验证
4. 性能优化：模型发现缓存、前端状态优化
5. 文档更新：CLAUDE.md / README 更新

## Dependency Graph

```
Phase 34 (数据模型 + 后端 API)
    ├── Phase 35 (模型发现引擎)
    └── Phase 36 (CLI 集成)
           └── Phase 37 (前端 UI)
                  └── Phase 38 (集成测试)
```

Phase 35 和 Phase 36 可并行开发（都只依赖 Phase 34）。

## Estimated Effort

| Phase | 描述 | 预估复杂度 |
|-------|------|-----------|
| Phase 34 | 数据模型 + API | 中等（数据库+加密+CRUD） |
| Phase 35 | 模型发现 | 中等（HTTP 探测+容错） |
| Phase 36 | CLI 集成 | 低（RPC 扩展） |
| Phase 37 | 前端 UI | 中等（融合现有组件） |
| Phase 38 | 集成测试 | 低（测试+优化） |

---
*Roadmap defined: 2026-05-31*
*Last updated: 2026-05-31 after v0.7 planning*
