# 项目上下文: v0.1 收尾

## 目标
Phase 0.5~8 开发完成、文档重写完成后，进行功能验证、测试补全、UI 打磨、构建发布，为 v0.1 tag 做准备。

## 背景
- Hapi Power v0.1 已完成全部 9 个开发阶段（Phase 0.5~8）和文档重写（D1~D4）
- 代码通过 typecheck + code review 质量门禁，但未做端到端功能验证
- 测试覆盖率远低于 80% 目标
- 前端功能页面 UI 细节未对齐 Cursor + Linear 融合设计规格
- 尚未验证全量构建

## 约束
- 遵循 AGPL-3.0 许可证
- 每阶段完成后 commit + push
- 质量门禁：typecheck + 功能验证
- 开发服务器端口 3210，公网 https://test.example.com

## 阶段清单

| # | 阶段 | 目标 |
|---|------|------|
| T1 | 功能冒烟测试 | 启动 dev server，端到端验证核心流程，修运行时问题 |
| T2 | 补测试 | 核心模块测试覆盖率提升到 80% |
| T3 | 前端 UI 打磨 | 功能页面对齐 Cursor + Linear 融合设计风格 |
| T4 | 构建发布 | build:single-exe 验证，v0.1 tag |
