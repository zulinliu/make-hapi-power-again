# 安全策略

## 漏洞报告

如果你发现了安全漏洞，请**不要**在公开的 GitHub Issue 中报告。

请通过 [GitHub Security Advisories](https://github.com/zulinliu/make-hapi-power-again/security/advisories/new) 私密报告。

我们承诺在 48 小时内响应，7 天内确认漏洞，并在修复后公开致谢。

## 安全实践

### 认证与授权

- Hub 支持 Token 认证和 JWT 认证
- CLI 通过 `CLI_API_TOKEN` 连接到 Hub（`/cli` 命名空间）
- Web 终端通过 JWT 连接到 Hub（`/terminal` 命名空间）
- 所有 Socket.IO 连接必须通过认证中间件

### 输入验证

- 所有 API 输入使用 Zod Schema 验证（`shared/src/schemas.ts`）
- 路径安全中间件阻止路径遍历攻击（`../../../`、符号链接、URL 编码）
- 文件上传限制 100MB，二进制上传限制 50MB
- ZIP 压缩比超过 100:1 视为 ZIP bomb 拒绝

### Git 安全

- Clone URL 拒绝 `file://` 协议（SSRF 防护）
- Git 凭证使用 AES-256-GCM 加密存储
- GitInternalAPI 仅限 Hub 内部调用

### 终端安全

- 未授权用户无法连接到 PTY 命名空间
- 单个 PTY 内存上限 512MB，超限自动终止
- 全局 PTY 数量上限 256
- 进程销毁时子进程树全部清理

### 文件安全

- 路径遍历攻击防护
- 文件类型白名单验证
- MIME 类型严格检查
- 上传文件名净化处理

### 加密

- 中继通信使用 WireGuard + TLS 端到端加密
- Git 凭证 AES-256-GCM + auth_tag 加密
- Web Push 使用 VAPID 密钥

## 依赖安全

定期更新依赖，关注安全公告。使用 `bun audit` 检查已知漏洞。

## 许可证

This project is licensed under [AGPL-3.0](./LICENSE).
