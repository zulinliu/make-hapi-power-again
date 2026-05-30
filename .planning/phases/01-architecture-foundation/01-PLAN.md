# Phase 1: 架构基础 — 实施计划

**前置**: Phase 0.5 完成（32/38 PoC 通过）
**目标**: 建立所有模块共享的基础设施

## 现有代码库分析

| 领域 | 现有 | 需要新增/修改 |
|------|------|--------------|
| 事件系统 | SyncEventSchema + EventPublisher + SSE | 泛化 EventBus 支持模块间通信 |
| 错误格式 | ApiError 类 + JSON error 响应 | 统一 ApiResponse<T> 信封格式 |
| 数据库 | SQLite V9，5 张表 | V10 迁移：新增插件、工作流、文件追踪表 |
| 设计系统 | CSS 变量 + Tailwind + 暗色主题 | Cursor + Linear 融合风格设计令牌 |
| 认证 | JWT + CLI token + namespace 隔离 | 路径安全中间件 + 日志脱敏 |
| 导航 | TanStack Router 路由 | 统一侧边栏 + 模块入口 |
| 代码分割 | 无 | 路由级懒加载 Monaco/xterm/Mermaid |

## 执行计划

### Plan 01-01: EventBus + 统一错误格式 + 数据库迁移

**文件变更**:
1. `shared/src/eventBus.ts` — 泛型 EventBus，typed pub/sub
2. `shared/src/apiResponse.ts` — ApiResponse<T> 统一信封类型 + Zod schema
3. `hub/src/store/index.ts` — V10 迁移：新增 `plugins`, `workflows`, `file_snapshots` 表
4. `hub/src/web/server.ts` — 全局错误处理中间件，统一 ApiResponse 格式

### Plan 01-02: 设计系统实现

**文件变更**:
1. `web/src/styles/tokens.css` — 设计令牌（颜色、间距、圆角、阴影、字体）
2. `web/src/styles/typography.css` — Inter 字体 + 代码字体 + 响应式排版
3. `web/src/styles/global.css` — 全局样式重写
4. `web/src/index.css` — 替换为 import tokens/typography/global
5. `web/tailwind.config.ts` — 扩展设计令牌引用

### Plan 01-03: 安全中间件 + 日志脱敏

**文件变更**:
1. `hub/src/middleware/pathSecurity.ts` — 增强 sanitizePath（修复 PoC 发现的 3 个漏洞）
2. `hub/src/middleware/logSanitizer.ts` — 日志脱敏（token、路径、IP）
3. `hub/src/web/server.ts` — 集成路径安全中间件到文件/Git 路由

### Plan 01-04: 统一导航 + 代码分割

**文件变更**:
1. `web/src/components/Sidebar.tsx` — 统一侧边栏导航
2. `web/src/components/SidebarItem.tsx` — 导航项组件
3. `web/src/App.tsx` — 集成 Sidebar 布局
4. `web/src/router.tsx` — 路由重构 + 懒加载配置
5. `web/vite.config.ts` — 手动 chunk 分割策略

## 验证标准

1. EventBus 可发布/订阅跨模块事件 ✓
2. 所有 API 返回 ApiResponse<T> 格式 ✓
3. V10 迁移脚本可运行 ✓
4. 设计令牌在 Tailwind 中可用 ✓
5. sanitizePath 阻止 Phase 0.5 发现的 3 个攻击向量 ✓
6. 侧边栏导航可跳转到所有模块入口 ✓
7. Monaco/xterm 为路由级懒加载 ✓
