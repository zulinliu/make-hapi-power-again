# v0.7 研究综合报告：自定义模型 API 配置与切换

**研究日期**: 2026-05-31
**研究范围**: cc-switch 及其 3 个衍生项目（共 4 个代码库）

## 1. 研究对象

| 项目 | 维护者 | 技术栈 | 定位 |
|------|--------|--------|------|
| cc-switch | farion1231 | Tauri 2 + Rust + React 18 | 核心桌面版，功能最全 |
| cc-switch-web | zuoliangyu | Rust (Axum) + React 18 | 纯 Web 版，最接近 Hapi Power 架构 |
| cc-switch-cli | SaladDay | Rust CLI | 命令行版，最简实现 |
| laliet-cc-switch-web | Laliet | Tauri 2 + Axum + React 18 | 双模版（桌面+Web），安全设计最完善 |

## 2. 核心发现

### 2.1 协议转换架构（cc-switch 最复杂的部分）

cc-switch 实现了完整的双向 API 协议转换，支持 4 种格式：

| 转换方向 | 核心文件 | 行数 |
|----------|---------|------|
| Anthropic ↔ OpenAI Chat | `transform.rs` | 1600+ |
| Anthropic ↔ OpenAI Responses | `transform_responses.rs` | ~800 |
| Codex Chat → Chat Completions | `transform_codex_chat.rs` | ~400 |
| Anthropic ↔ Gemini Native | `transform_gemini.rs` | ~600 |

**关键设计模式**：`ProviderAdapter` trait — 每种协议一个适配器，统一接口处理认证、URL 构建、格式转换。

**格式检测优先级**：`meta.apiFormat → settings_config.api_format → openrouter_compat_mode → default "anthropic"`

**v0.7 决策**：协议转换延后到 v0.8，v0.7 仅做配置下发 + 模型发现。对于需要协议转换的场景，用户可使用第三方中转服务（中转服务本身已处理协议兼容）。

### 2.2 供应商配置模型

**cc-switch 的 Provider 模型**：

```typescript
interface Provider {
  id: string;
  name: string;
  settingsConfig: Record<string, any>;  // 应用配置对象
  category?: ProviderCategory;          // 7种分类
  meta?: ProviderMeta;                  // 元数据（不写入 live 配置）
  icon?: string;
  sortIndex?: number;
  inFailoverQueue?: boolean;
}
```

**关键设计**：
- `settingsConfig.env` 直接映射环境变量（ANTHROPIC_BASE_URL、ANTHROPIC_API_KEY 等）
- `meta` 字段仅存储于 SSOT，写入 CLI 配置时被剔除
- 支持 UniversalProvider：一个配置同步到 Claude/Codex/Gemini 三端

**v0.7 决策**：采用全局供应商池模型。用户创建供应商（名称+Base URL+API Key），分配给 Claude/Codex/Gemini/OpenCode。无预设模板。

### 2.3 模型发现机制

cc-switch 的智能模型发现策略（两个 Web 版实现基本一致）：

1. **候选 URL 构建**：
   - 主 URL：`baseURL + /v1/models`
   - 兼容剥离：若 baseURL 以 `/anthropic`、`/claudecode` 等 10 种已知后缀结尾，自动剥离后再尝试
   - 最多 3 个候选 URL，按优先级排序

2. **多协议认证适配**：
   - Anthropic：`x-api-key` 头 + `anthropic-version` 头
   - Google：URL query 参数 `key`
   - OpenAI：`Bearer` token

3. **容错**：404/405 自动跳到下一个候选

**v0.7 决策**：采用此策略，在 Hub 后端实现模型发现 API。

### 2.4 Web 版的运行时适配器模式（zuoliangyu/laliet 共有）

```
前端调用 invoke("switch_provider", {app, id})
    ↓
adapter.ts 判断运行环境
    ├── Tauri 环境 → tauriInvoke("switch_provider", args)  // IPC
    └── Web 环境 → commandToEndpoint("switch_provider", args)
                    → { method: "POST", url: "/api/providers/{app}/{id}/switch" }
```

**v0.7 应用**：Hapi Power 已有 REST API + Socket.IO 通信层，不需要此适配器模式。直接在 Hub 后端新增 REST 路由。

### 2.5 安全设计（laliet 版最完善）

- API Key 明文存于 SQLite（cc-switch 共同特点）
- Web 安全：Basic Auth + CSRF Token + HSTS + 速率限制
- 原子写入：temp file → rename，避免半写状态
- Unix 文件权限 0o600

**v0.7 决策**：SQLite + AES-256-GCM 加密存储 API Key，优于 cc-switch 的明文方案。

### 2.6 SSOT 投影模式（cc-switch 核心设计）

```
SSOT (SQLite/config.json)
    ↓ sync_current_to_live()
    ├── ~/.claude/settings.json     (Claude 投影)
    ├── ~/.codex/config.toml        (Codex 投影)
    ├── ~/.gemini/.env              (Gemini 投影)
    └── ~/.config/opencode/*.json   (OpenCode 投影)
```

**v0.7 应用**：Hapi Power 不直接修改 CLI 配置文件，而是通过 Hub→CLI RPC 下发配置。SSOT 存储在 Hub 的 SQLite 数据库中。

## 3. 可借鉴的代码模块

### 优先级 P0（直接参考）

| 模块 | 来源 | 价值 |
|------|------|------|
| `transform.rs` | cc-switch 核心 | Anthropic ↔ OpenAI 转换算法（v0.8 参考） |
| `model_fetch.rs` | laliet / zuoliangyu | 智能 URL 候选构建 + 模型发现 |
| `web_server.rs` | zuoliangyu | REST API 路由设计（Provider CRUD） |
| `adapter.ts` | laliet | Tauri/Web 双模适配器模式参考 |

### 优先级 P1（设计参考）

| 模块 | 来源 | 价值 |
|------|------|------|
| `provider.rs` | cc-switch | Provider 数据模型设计 |
| `schema.rs` | laliet | SQLite 表结构设计 |
| `claude_plugin.rs` | zuoliangyu | Claude Code 配置注入机制 |
| `ProviderCard.tsx` | zuoliangyu | 供应商卡片 UI 组件 |

### 优先级 P2（远景参考）

| 模块 | 来源 | 价值 |
|------|------|------|
| `forwarder.rs` (82KB) | zuoliangyu | 完整代理转发引擎（v0.8 参考） |
| `circuit_breaker.rs` | cc-switch | 熔断器实现 |
| `model_pricing` | 各版本 | 130+ 模型定价数据 |

## 4. 架构差异总结

| 维度 | cc-switch | Hapi Power v0.7 |
|------|-----------|-----------------|
| 运行环境 | Tauri 桌面 / 本地 Web 服务 | 纯 Web（Bun + Hono） |
| 通信方式 | Tauri IPC / HTTP REST | HTTP REST + Socket.IO |
| 协议转换 | Rust 实现（hyper 代理） | v0.7 不做；v0.8 TS 重写 |
| 存储方式 | SQLite 明文 | SQLite + AES-256-GCM 加密 |
| 配置生效 | 直接修改 CLI 配置文件 | Hub→CLI RPC 下发 |
| 供应商预设 | 40+ 预置模板 | 无预设，用户自定义 |
| 供应商模型 | 按应用独立管理 | 全局供应商池 |
| 模型选择 | App Switcher + Provider Card | 下拉框内完全融合 |

---
*研究完成：2026-05-31*
