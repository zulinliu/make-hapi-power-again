# 项目上下文: 文档重写

## 目标
铲掉 hapi 原始文档，为 Hapi Power v0.1 编写全新的项目文档。

## 背景
- Hapi Power 是基于 hapi (AGPL-3.0) 上游的 AI 编码代理全栈开发者工作台
- 已完成 Phase 0.5 ~ 8 全部 9 个阶段的开发
- 现有 hapi 原始文档 7 个文件共 ~858 行，内容已不匹配 Hapi Power 的功能范围
- 已有 Hapi Power 设计文档 9 个文件共 ~3,762 行（docs/v0.1-*.md），保留不变

## 约束
- 遵循 AGPL-3.0 许可证，保留上游致谢
- 文档使用中文
- 每阶段完成后 commit + push
- 质量门禁：内容审查

## 待重写文档清单

| # | 文件 | 类型 | 说明 |
|---|------|------|------|
| 1 | README.md | 项目主页 | 完整重写 |
| 2 | AGENTS.md | AI Agent 指南 | 完整重写 |
| 3 | CONTRIBUTING.md | 贡献指南 | 完整重写 |
| 4 | SECURITY.md | 安全策略 | 扩充重写 |
| 5 | hub/README.md | Hub 模块文档 | 完整重写 |
| 6 | web/README.md | Web 模块文档 | 完整重写 |
| 7 | cli/README.md | CLI 模块文档 | 适度更新 |
