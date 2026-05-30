# Hapi Power — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30)

**Core value:** 让 AI 编码代理拥有完整的开发者环境 — 代码编辑、终端操作、版本控制、插件扩展，全部在浏览器中完成。
**Current focus:** Phase 0.5 完成，准备进入 Phase 1

## Current State

- **Branch**: feat/v1 (from dev)
- **Remote**: https://github.com/zulinliu/make-hapi-power-again.git
- **Codebase**: hapi 上游全量拷贝（995 文件，151,570 行），作为 hapi-power 初始基线
- **Design Docs**: 9 份设计文档已完成（主设计 + 7 模块 + 评审报告），三轮评审通过
- **Phase**: Phase 0.5 技术验证完成（32/38 通过，84%）

## What's Done

- ✓ 项目设计文档体系完成（v0.1-design.md + Module A~G + 评审报告）
- ✓ 三轮专业评审完成（UI/UX + 前端架构 + 系统架构 + 安全）
- ✓ 11 项架构决策（ADR-001~011）已穿透到所有模块
- ✓ 8 项安全发现（N-1~N-8）已修复并穿透
- ✓ hapi 上游源码全量拷贝到 feat/v1 分支
- ✓ GSD 项目规划文档创建（PROJECT.md + REQUIREMENTS.md + ROADMAP.md）
- ✓ Phase 0.5 技术验证完成：
  - Bun Terminal API: 5/6 通过（核心 PTY 功能正常）
  - Socket.IO Binary: 4/4 通过（发现 string 比 binary 快 6x）
  - Resource Limits: 4/4 通过（进程组清理有效）
  - isomorphic-git: 4/6 通过（核心 Git 操作可用）
  - Blob URL Import: 7/7 通过（插件系统方案验证）
  - Path Security: 8/11 通过（3 个漏洞待修复）

## What's Next

1. 修复 Path Security 3 个攻击向量（SEC-01）
2. Phase 1: 架构基础（EventBus、设计系统、安全中间件、代码分割）

## Key Findings (Phase 0.5)

1. **Bun Terminal API**: `data(terminal, data)` 双参数回调，stdin/stdout/stderr 返回 null
2. **Socket.IO**: String 编码比 Binary 快 6x，终端数据继续用 string
3. **Blob Import**: Bun 完美支持，插件系统可行
4. **isomorphic-git**: 服务端可用 node:fs，浏览器端需 LightningFS
5. **Path Security**: 双重 URL 编码、null byte、多重点号路径需额外处理

## Key Files

| File | Purpose |
|------|---------|
| docs/v0.1-design.md | 主设计文档（架构、设计系统、技术栈、ADR） |
| docs/v0.1-module-a-git.md | Module A：Git 管理 |
| docs/v0.1-module-b-pty.md | Module B：PTY 终端 |
| docs/v0.1-module-c-files.md | Module C：文件管理 + 代码编辑 |
| docs/v0.1-module-d-extensions.md | Module D：扩展系统 |
| docs/v0.1-module-e-ai-workflow.md | Module E：AI 工作流 |
| docs/v0.1-module-f-agent-experience.md | Module F：代理体验 |
| docs/v0.1-module-g-context-provider.md | Module G：上下文管理 |
| docs/v0.1-review-report.md | 评审报告（三轮） |
| .planning/PROJECT.md | 项目上下文 |
| .planning/REQUIREMENTS.md | 需求追踪 |
| .planning/ROADMAP.md | 实施路线图 |
| .planning/phases/00.5-tech-validation/ | Phase 0.5 验证文档 |
| scripts/poc/ | 技术验证 PoC 脚本 |

## Architecture Summary

```
CLI (cli/)          → AI 代理包装器 + 运行守护进程
Hub (hub/)          → HTTP 服务 + EventBus + Socket.IO + SQLite
Web (web/)          → React 19 SPA + TanStack Router/Query + Tailwind CSS 4
Shared (shared/)    → 跨包共享类型、schemas、工具函数
```

**Modules:**
- Module A: Git 管理（isomorphic-git + react-diff-view + Mermaid）
- Module B: PTY 终端（Bun Terminal API + xterm.js + Socket.IO string）
- Module C: 文件管理 + 代码编辑（react-complex-tree + Monaco Editor）
- Module D: 扩展系统（Blob URL 插件 + Skill + Claude Plugin）
- Module E: AI 工作流（变更审查 + 时间线 + 撤销 + 移动 + 分享）
- Module F: 代理体验（语音 + Skill 编排 + 白板）
- Module G: 上下文管理（用量可视化 + 压缩通知）

---
*State updated: 2026-05-30 (Phase 0.5 complete)*
