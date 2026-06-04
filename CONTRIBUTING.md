# 贡献指南

> Part of [Hapi Power](./README.md) — AI Coding Agent Workbench

感谢你对 Hapi Power 的关注！欢迎提交 Bug 修复、功能建议和代码贡献。

## 行为准则

- 友善尊重，专业沟通
- 乐于助人，分享知识
- 就事论事，建设性反馈
- 保持耐心，尊重不同经验水平

## AI 生成代码

如果你使用 AI 工具生成代码，请在 PR 描述中声明使用的模型。代码以质量为准 — 无论代码如何编写，都需要通过同样的审查标准。

## 快速开始

### 环境要求

- [Bun](https://bun.sh) >= 1.0
- Node.js >= 18（node-pty 依赖）

### 安装与开发

```bash
# 克隆并安装
git clone <repo-url> && cd make-hapi-power-again
bun install

# 开发模式（Hub + Web 并发）
bun run dev

# 类型检查
bun run typecheck

# 运行测试
bun run test

# 构建
bun run build
```

### 项目结构

```
cli/      CLI 二进制，代理封装
hub/      Hono HTTP API + Socket.IO
web/      React PWA 前端
shared/   共享类型、Schema
```

详见 [AGENTS.md](AGENTS.md)。

## 代码规范

### TypeScript

- strict 模式，禁止 `any`（使用 `unknown` + 类型收窄）
- Zod 做运行时验证
- 路径别名 `@/*` 映射到 `./src/*`
- 4 空格缩进

### 文件组织

- 按功能/领域组织，不按文件类型
- 文件 < 800 行，函数 < 50 行
- 嵌套 < 4 层，优先提前返回

### 不可变数据

始终创建新对象，不直接修改现有对象。

### 错误处理

- 每一层显式处理错误
- 面向用户的错误信息要友好
- 服务器端记录详细上下文
- 永远不静默吞掉错误

### 测试

- 新功能必须有测试
- 测试文件 `*.test.ts` 紧邻源码
- 使用 Vitest 框架
- 目标覆盖率 80%+

## Pull Request 流程

### 不接受巨型 PR

不要在一个 PR 中引入大量功能。大型 PR 难以审查、容易引入 Bug、难以回滚。

**如果要添加重要功能，请先开 Issue 讨论方案。** 我们可以帮你拆分成可审查的小块。

### PR 规范

- 一个 PR 聚焦一个关注点
- 清晰的 commit 消息，使用约定式提交格式：

```
<type>: <描述>

类型: feat, fix, refactor, docs, test, chore, perf, ci
```

- 包含相关测试
- 更新相关文档
- PR 描述中引用相关 Issue
- 确保 `bun run typecheck` 通过

### 审查标准

| 级别 | 含义 | 处理 |
|------|------|------|
| CRITICAL | 安全漏洞或数据丢失风险 | 必须修复后合并 |
| HIGH | Bug 或重大质量问题 | 应该修复后合并 |
| MEDIUM | 可维护性问题 | 建议修复 |
| LOW | 风格或小建议 | 可选 |

## Bug 报告

提交 Bug 报告时请包含：

- 问题描述
- 复现步骤
- 期望行为 vs 实际行为
- 运行环境（OS、Bun 版本等）
- 相关日志或截图

## 功能建议

提交功能建议时请包含：

- 功能描述
- 解决的问题
- 实现思路（如有）

## 许可证

By contributing, you agree that:

1. Your code will be licensed under [AGPL-3.0](./LICENSE)
2. You have the right to submit this code under that license
3. You certify the [Developer Certificate of Origin](https://developercertificate.org/)
