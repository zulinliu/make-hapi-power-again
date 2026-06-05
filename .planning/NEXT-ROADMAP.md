# Roadmap: v0.1 收尾

## Overview

Phase 0.5~8 开发完成、文档重写完成后，分 4 个阶段进行功能验证、测试补全、UI 打磨、构建发布，为 v0.1 tag 做准备。

## Phases

- [x] **Phase T1: 功能冒烟测试** — 启动 dev server，端到端验证核心流程
- [x] **Phase T2: 补测试** — 核心模块测试覆盖率提升到 80%
- [x] **Phase T3: 前端 UI 打磨** — 功能页面对齐设计规格
- [x] **Phase T4: 构建发布** — 全量构建验证 + v0.1 tag

## Phase Details

### Phase T1: 功能冒烟测试
**Goal**: 启动 dev server，端到端验证核心流程，发现并修复运行时问题
**Depends on**: Phase 0.5~8 + D1~D4 全部完成
**Success Criteria**:
  1. Hub + Web dev server 成功启动在端口 3210
  2. CLI 能成功连接到 Hub
  3. 会话列表、聊天、消息收发正常
  4. 文件浏览器 + Monaco Editor 正常工作
  5. 终端（PTY）创建/输入/关闭正常
  6. Git 状态/历史/diff 查看正常
  7. 扩展管理页面加载正常
  8. ~~变更审查面板加载正常~~ → v0.12.0 已删除
  9. ~~移动端路由可访问~~ → v0.12.0 已删除
  10. 所有发现的运行时 Bug 已修复

### Phase T2: 补测试
**Goal**: 核心模块测试覆盖率提升到 80%+
**Depends on**: Phase T1
**Success Criteria**:
  1. Hub 核心路由（sessions/messages/git/plugins/skills）有集成测试（~~changes/undo/timeline/share 已在 v0.12.0 删除~~）
  2. SyncEngine 关键方法有单元测试
  3. Shared schemas/types 有单元测试
  4. CLI 关键命令有单元测试
  5. `bun run test` 全部通过
  6. 核心模块覆盖率 >= 80%

### Phase T3: 前端 UI 打磨
**Goal**: 功能页面对齐 Cursor + Linear 融合设计风格
**Depends on**: Phase T1
**Success Criteria**:
  1. ~~变更审查面板视觉对齐设计规格~~ → v0.12.0 已删除
  2. ~~时间线页面视觉对齐设计规格~~ → v0.12.0 已删除
  3. ~~编排 Skill 页面视觉对齐设计规格~~ → v0.12.0 已删除
  4. ~~白板工具交互流畅~~ → v0.12.0 已删除
  5. ~~移动端布局适配~~ → v0.12.0 已删除
  6. 统一导航侧边栏视觉一致

### Phase T4: 构建发布
**Goal**: 全量构建验证，准备 v0.1 tag
**Depends on**: Phase T2, Phase T3
**Success Criteria**:
  1. `bun run build` 全量构建成功 ✅
  2. `bun run build:single-exe` 单文件可执行程序构建成功 ✅ (136MB, hapi --version 可运行)
  3. 构建产物可运行 ✅
  4. 打 v0.1 tag ✅
  5. Push tag 到远程 ✅

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| T1. 冒烟测试 | Done | 2026-05-30 |
| T2. 补测试 | Done | 2026-05-30 |
| T3. UI 打磨 | Done | 2026-05-30 |
| T4. 构建发布 | Done | 2026-05-30 |

---
*Roadmap created: 2026-05-30*
