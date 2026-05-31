# Phase 9: 全功能审计

**Phase**: 9
**Goal**: 启动 dev server，实际操作测试全部 9 个模块，系统化记录并修复所有功能和体验问题
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05
**Mode**: Sequential（需逐模块操作，每模块审计完立即修复）
**参考**: .planning/research/AUDIT.md（766 行详细测试用例）

## Context

v0.1 全部功能已完成，v0.2 的 iOS PWA 三个紧急 bug 已修复（P0-P2）。现在需要对 v0.1 所有功能模块进行系统性审计，发现并修复问题，为后续 Phase 10-13 打下稳定基础。

审计使用浏览器自动化（Chrome DevTools MCP），通过实际操作验证每个功能。

## 执行策略

分 5 个 Plan 执行，每完成一个 Plan 就 commit + push：

### Plan 09-01: 环境准备 + Lighthouse 基线
**任务**:
1. 启动 dev server（port 3210）
2. 浏览器打开应用，验证基本可访问性
3. 运行 Lighthouse 审计获取性能/可访问性/最佳实践基线
4. 记录基线数据

**质量门禁**: dev server 正常运行，Lighthouse 报告已保存

### Plan 09-02: Module A+B 审计（Git 管理 + PTY 终端）
**任务**:
1. Module A: Git 状态/历史/分支/diff 全功能测试（22 用例）
2. Module B: 终端创建/输入/关闭/分屏测试（19 用例）
3. 记录所有发现的问题
4. 修复 P0/P1 问题

**质量门禁**: typecheck + vitest + code review → commit + push

### Plan 09-03: Module C+D 审计（文件管理 + 扩展系统）
**任务**:
1. Module C: 文件树/CRUD/Monaco 编辑/预览（25 用例）
2. Module D: 插件/Skill/Claude Plugin（12 用例）
3. 记录并修复问题

**质量门禁**: typecheck + vitest + code review → commit + push

### Plan 09-04: Module E+F+G 审计（AI 工作流 + 代理体验 + 上下文）
**任务**:
1. Module E: 变更审查/时间线/撤销/上下文（18 用例）
2. Module F: 语音/白板/Skill 编排（9 用例）
3. Module G: 用量显示/压缩通知（5 用例）
4. 记录并修复问题

**质量门禁**: typecheck + vitest + code review → commit + push

### Plan 09-05: 移动端审计 + 安全审计 + 汇总
**任务**:
1. 移动端专项审计（触摸目标/键盘适配/手势）
2. 安全审计（OWASP Top 10 检查清单）
3. 汇总所有发现，生成审计报告
4. 更新 STATE.md

**质量门禁**: 最终 typecheck + 全量测试 → commit + push

## Success Criteria

1. Git 管理：状态/历史/分支/diff 全部功能正常（22 个测试用例通过）
2. PTY 终端：创建/输入/关闭/分屏正常（19 个测试用例通过）
3. 文件管理 + Monaco：文件树/CRUD/编辑/预览正常（25 个测试用例通过）
4. 扩展系统：插件/Skill/Claude Plugin 加载正常（12 个测试用例通过）
5. AI 工作流：变更审查/时间线/撤销/上下文正常（18 个测试用例通过）
6. 代理体验：语音/白板/Skill 编排正常（9 个测试用例通过）
7. 上下文管理：用量显示/压缩通知正常（5 个测试用例通过）
8. Lighthouse 核心指标：LCP < 2.5s / INP < 200ms / CLS < 0.1
9. 所有 P0/P1 问题已修复，P2 问题有跟踪计划

## 暂存问题跟踪

审计发现的问题实时记录在此表：

| ID | 模块 | 严重度 | 描述 | 状态 |
|----|------|--------|------|------|
| （审计中填写） | | | | |

---
*Plan created: 2026-05-31*
