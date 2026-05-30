# 文档重写 ROADMAP

## Overview

铲掉 hapi 原始文档，分 4 个阶段为 Hapi Power v0.1 编写全新项目文档。阶段按文档类型分批：核心文档 → 模块文档 → 收尾检查。

## Phases

- [x] **Phase D1: 核心文档重写** — README.md + AGENTS.md
- [x] **Phase D2: 安全与贡献指南** — SECURITY.md + CONTRIBUTING.md
- [x] **Phase D3: 模块文档重写** — hub/README.md + web/README.md + cli/README.md
- [ ] **Phase D4: 最终审查与推送** — 全文档一致性检查 + 最终 commit

## Phase Details

### Phase D1: 核心文档重写
**Goal**: 重写项目主页和 AI Agent 工作指南，确立 Hapi Power 的项目定位和技术文档基调
**Depends on**: Nothing
**Success Criteria**:
  1. README.md 完整描述 Hapi Power 的定位、架构、功能列表、技术栈、快速上手
  2. README.md 包含上游 hapi 致谢和 AGPL-3.0 许可证说明
  3. AGENTS.md 包含完整的项目结构、架构说明、开发命令、常用模式
  4. 文档内容与实际代码实现一致

### Phase D2: 安全与贡献指南
**Goal**: 编写安全策略和贡献指南
**Depends on**: Phase D1
**Success Criteria**:
  1. SECURITY.md 包含完整的漏洞报告流程和安全实践
  2. CONTRIBUTING.md 包含开发环境搭建、代码规范、PR 流程

### Phase D3: 模块文档重写
**Goal**: 重写三个子包（Hub/Web/CLI）的模块文档
**Depends on**: Phase D1
**Success Criteria**:
  1. hub/README.md 包含所有 API 端点、Socket.IO 事件、配置项
  2. web/README.md 包含路由列表、组件架构、技术栈说明
  3. cli/README.md 包含命令列表、配置项、与 Hub 的交互方式
  4. 文档中的 API 路由和事件名与代码实现一致

### Phase D4: 最终审查与推送
**Goal**: 全文档一致性检查，确保无遗漏
**Depends on**: Phase D2, Phase D3
**Success Criteria**:
  1. 所有文档之间的交叉引用一致
  2. 代码中的路由、事件名与文档描述匹配
  3. 无残留的 hapi 原始内容

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| D1. 核心文档 | Done | 2026-05-30 |
| D2. 安全与贡献 | Done | 2026-05-30 |
| D3. 模块文档 | Done | 2026-05-30 |
| D4. 最终审查 | Not started | - |

---
*Roadmap created: 2026-05-30*
