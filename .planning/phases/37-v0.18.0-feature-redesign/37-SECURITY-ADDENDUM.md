# Phase 37 — 安全与隐私补充门禁

> 本文是 Phase 37 深度评审后的安全补充。目的：把 Model Nexus、Session Loom、Git Atlas、Guide Beam 的安全要求从原则升级为实施门禁。

## 1. 总体安全原则

1. 默认不泄露：API key、Authorization、query key、Git credential、绝对路径、完整 tool output、供应商私有 host 默认不进入日志/导出/诊断。
2. 默认最小化：导出和提炼默认只包含完成任务所需内容。
3. 默认本地：Session Loom 的原始导出不调用外部模型；深度提炼调用外部模型必须显式确认。
4. 服务端强校验：危险操作不能只靠 UI 防护。
5. 可测试：每条安全要求必须有 route/unit/snapshot 测试。

## 2. Model Nexus / Provider 安全门禁

### 2.1 Namespace 隔离

Provider 数据必须归属 namespace：

- `providers.namespace` 必填。
- `provider_assignments.namespace` 或通过 provider join 限定。
- `/api/providers*` 所有读写按当前 namespace 过滤。
- 模型发现、health check、api-key reveal 也必须校验 namespace。

### 2.2 SSRF 防护

Base URL 校验不允许只做字符串检查。必须覆盖：

| 类别 | 必须拦截/处理 |
|---|---|
| Scheme | 只允许 `http:` / `https:`；禁止 `file:`, `ftp:`, `gopher:`, `data:`。 |
| Userinfo | 禁止 `https://user:pass@example.com`。 |
| Host literal | 禁止 localhost、IPv4 private、IPv6 loopback/link-local/ULA、metadata IP。 |
| IPv4 变体 | 拦截 decimal、octal、hex、IPv4-mapped IPv6。 |
| DNS | 请求前解析 DNS；解析到 private/link-local/metadata 则拒绝。 |
| Redirect | 每个 redirect hop 重新校验；跨 host redirect 不携带 API key。 |
| DNS rebinding | connect 前后或每次请求解析结果不一致时拒绝或重新校验。 |
| Port | 默认允许 80/443；其它端口需安全策略允许并记录 warning。 |
| Timeout | 总超时、连接超时、读取超时必须有限。 |
| Size | 诊断响应 body 有最大读取限制。 |

### 2.3 Provider 诊断脱敏

禁止返回或记录：

- Authorization / x-api-key / query `key=`。
- 完整 request headers。
- 完整 error body。
- Provider notes 中疑似 secret。
- URL userinfo。
- 私有供应商真实 host（除非用户显式选择显示）。

诊断结果使用 allowlist：

```ts
type SafeProviderDiagnostic = {
    hostLabel: string // redacted or domain label
    path: string
    statusCode: number | null
    latencyMs: number | null
    errorCode: string | null
    safeMessage: string | null
    capabilities: ProviderCapability
}
```

### 2.4 Key reveal

普通 `GET /api/providers/:id/api-key` 不应作为新 UI 主流程。

如确需 reveal：

- 二次确认。
- 一次性 token。
- TTL ≤ 60 秒。
- 同 namespace 校验。
- 审计记录 reveal event，不记录 key。
- 默认只显示 masked key，例如 `••••abcd`。

## 3. Session Loom / Export 隐私门禁

### 3.1 默认策略

| 项 | 默认 |
|---|---|
| `redactSecrets` | true |
| 外部 LLM 提炼 | false，需要显式确认 |
| 包含完整 tool result | false，仅摘要 |
| 包含系统提示 | false |
| 包含 provider host/key | false |
| 包含 Git remote credential | false，URL 脱敏 |
| 包含绝对路径 | 默认脱敏为 workspace-relative 或提示用户 |

### 3.2 导出权限与存储

- `exportId` 必须不可枚举。
- 下载时校验 session 权限和 namespace。
- 文件名必须 sanitize，禁止路径穿越。
- 本地文件权限建议 `0600`。
- metadata 记录 size/checksum/createdAt/expiresAt。
- 支持用户删除导出。
- 支持 TTL 清理。

### 3.3 Secret redaction snapshot

必须覆盖：

- API key / token / bearer。
- URL query secret。
- Git remote credential。
- SSH private key 片段。
- `.env` 样式变量。
- provider notes。
- tool output / stderr。
- SSE event / Web console。
- Markdown export。

### 3.4 外部模型提炼确认

调用外部模型前必须展示：

- 将发送哪些内容。
- 使用哪个 Provider / model。
- 是否已 redaction。
- 是否包含 tool summaries。
- 取消和仅本地导出选项。

## 4. Git Atlas 安全门禁

- Git 参数必须 schema 校验，不拼接 shell。
- Force push / delete branch / delete remote 必须服务端确认 token 或 phrase，不只靠 UI。
- Git remote URL、clone URL、stderr、progress event 必须脱敏 credential。
- Sync 操作应有 in-flight lock，避免重复点击触发并发 push/pull。
- Commit Basket 需要定义 staging 策略，避免误提交用户已有 staged 内容。

## 5. Guide Beam 安全门禁

- Guide 不得绕过 permission request。
- Guide 不得绕过 attachments/scheduled restrictions。
- Guide fallback 不得丢消息。
- Guide 重放不得造成 interrupt storm。
- `localId` / `messageId` 幂等必须测试。

## 6. 发布前安全检查

- [ ] Clean worktree 或明确隔离非本阶段改动。
- [ ] 分支与目标版本一致，例如实施 v0.18.0 时使用 `feat/v0.18.0`。
- [ ] 作者为 `zulinliu`。
- [ ] 无 `Co-Authored-By`。
- [ ] Commit message / release notes 无第三方工具署名或品牌残留。
- [ ] secret scan 覆盖 docs、logs、exports、diagnostics。
- [ ] SSRF 测试矩阵通过。
- [ ] i18n parity 通过。
