# 2026-06-08 — v0.18.0 特色功能重塑参考资料与实测

## 1. 外部参考

| 方向 | 来源 | 设计启发 |
|---|---|---|
| Git UI | VS Code Source Control — https://code.visualstudio.com/docs/sourcecontrol/overview | Git 操作应围绕变更、暂存/选择、提交、同步的连续流程组织。 |
| Git UI | GitHub Desktop — https://docs.github.com/en/desktop/overview/about-github-desktop | 图形化 Git 的核心价值是降低 branch/diff/history/sync 的认知负担。 |
| Secret/Provider | Postman Vault — https://learning.postman.com/docs/sending-requests/postman-vault/postman-vault-secrets/ | Secret 管理应强调不可泄露、可诊断、可替换，而不是普通文本字段。 |
| Provider governance | OpenAI Projects/API keys — https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects | API key 管理要考虑 project scope、service account、权限和默认路由。 |
| Usage 数据 | Anthropic Messages API — https://docs.anthropic.com/en/api/messages | 上下文监控依赖模型返回 usage，但 UI 必须显示数据来源与不可用原因。 |
| Agent 控制 | Claude Code Interactive Mode — https://docs.anthropic.com/en/docs/claude-code/interactive-mode | 中断、命令和交互模式必须让用户清楚当前状态与下一步。 |
| Conversation export | ChatGPT Data Export — https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data | 导出应生成结构化资产，而不是仅复制可视窗口。 |
| PWA | MDN PWA installable — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable | iOS/PWA 需要考虑 standalone、manifest、下载/share fallback。 |
| iOS UX | Apple Human Interface Guidelines — https://developer.apple.com/design/human-interface-guidelines/ | 触控、状态、反馈、动画克制是移动端质量底线。 |

## 2. tsintergy / GLM-5.1 usage smoke test

### 配置读取

- 文件：`~/.claude/settings.json`
- 非密字段：
  - `ANTHROPIC_BASE_URL=http://new-api.saas-vpp.tsintergy.com`
  - `ANTHROPIC_MODEL=glm-5.1`
- 密钥字段：`ANTHROPIC_AUTH_TOKEN` 存在，但未打印、未写入文档。

### 请求

- 时间：2026-06-08
- Endpoint：`POST {base}/v1/messages`
- Headers：Anthropic-compatible headers + Authorization bearer token
- Body：小 prompt，`model=glm-5.1`，`max_tokens=12`

### 结果

- HTTP 200
- 顶层 JSON keys：`content/id/model/role/stop_reason/stop_sequence/type/usage`
- Usage keys：`input_tokens/output_tokens/cache_read_input_tokens/server_tool_use/service_tier`
- 返回模型：`glm-5.1`

### 判断

1. direct Messages API 路径返回 usage。
2. 当前 UI 上下文不可用不应直接归因为 tsintergy/GLM-5.1 不返回 usage。
3. 后续应继续排查 Claude Code stream-json 路径是否丢 usage、normalizer 是否过严、context window 是否缺失、分页是否导致 latest usage 不在窗口。

## 3. 对设计的影响

- API 星桥必须把“usage 支持”作为 Provider 能力检测项。
- 上下文脉冲必须展示数据来源和不可用原因。
- Guide Beam 必须有能力探测：不是所有 agent 都能无损 interrupt。
- Session Loom 导出/提炼前必须提示敏感信息与外部模型调用风险。
