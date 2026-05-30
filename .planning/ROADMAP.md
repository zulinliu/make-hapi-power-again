# Roadmap: Hapi Power v0.1

## Overview

从 hapi 上游代码基线出发，分 8 个阶段构建 AI 编码代理全栈开发者工作台。Phase 0.5 验证关键技术风险（node-pty + Bun 兼容性），Phase 1 打好架构基础（EventBus、设计系统、安全中间件、代码分割），Phase 2~5 逐模块构建核心功能（Git→PTY→Files→Extensions），Phase 6~8 构建 AI 工作流增强和代理体验。

## Phases

- [x] **Phase 0.5: 技术验证** — PoC 验证关键技术风险
- [x] **Phase 1: 架构基础** — EventBus、设计系统、安全中间件、代码分割、统一导航
- [x] **Phase 2: Git 管理** — Git 可视化管理 + GitInternalAPI
- [ ] **Phase 3: PTY 终端** — xterm.js 终端 + Socket.IO 认证 + 资源限制
- [ ] **Phase 4: 文件管理 + 代码编辑** — 文件树 + Monaco Editor
- [ ] **Phase 5: 扩展系统** — 插件 + Skill + Claude Plugin 管理
- [ ] **Phase 6: AI 工作流核心** — 变更审查 + 时间线 + 撤销 + 上下文管理
- [ ] **Phase 7: 移动端 + 会话分享** — 移动速览 + 分享 + 推送通知
- [ ] **Phase 8: 代理体验** — 二进制帧 + 语音 + Skill 编排 + 白板

## Phase Details

### Phase 0.5: 技术验证
**Goal**: 验证关键技术风险，避免后续阶段遇到不可逾越的障碍
**Depends on**: Nothing
**Requirements**: ARCH-05
**Success Criteria**:
  1. node-pty 在 Bun 环境中可正常创建/销毁 PTY 会话
  2. 如果 node-pty 不兼容，备选方案 Bun.spawn + Unix PTY 可工作
  3. isomorphic-git 在浏览器和服务器端均可执行 clone/status/diff
  4. Socket.IO binary event 可传输图片二进制数据
**Plans**: 1 plan

Plans:
- [ ] 00.5-01: 关键技术 PoC 验证（node-pty + Bun、isomorphic-git、Socket.IO binary）

### Phase 1: 架构基础
**Goal**: 建立所有模块共享的基础设施：EventBus、设计系统、安全中间件、代码分割、统一导航
**Depends on**: Phase 0.5
**Requirements**: ARCH-01~06, DS-01~04, PERF-01~04, SEC-01~06, A11Y-01~03
**Success Criteria**:
  1. Hub EventBus 可发布/订阅跨模块事件
  2. Cursor + Linear 设计令牌生效（Canvas 背景、5 色语义、Inter 字体）
  3. 路径安全中间件可用于所有文件操作路由
  4. Monaco/Mermaid/xterm/react-pdf 均为路由级懒加载
  5. 统一侧边栏导航可跳转到所有功能模块入口
  6. ApiResponse<T> 统一错误响应格式生效
  7. V10 数据库迁移脚本可运行
**Plans**: 4 plans

Plans:
- [ ] 01-01: EventBus 事件总线 + 统一错误格式 + 数据库迁移
- [ ] 01-02: 设计系统实现（设计令牌 + Inter 字体 + 响应式断点 + 焦点环修正）
- [ ] 01-03: 安全中间件 + Socket.IO 认证 + 日志脱敏
- [ ] 01-04: 统一导航架构 + 代码分割配置

### Phase 2: Git 管理
**Goal**: 浏览器内完整的 Git 可视化管理能力，含 GitInternalAPI 供其他模块调用
**Depends on**: Phase 1
**Requirements**: GIT-01~08
**Success Criteria**:
  1. 用户可在浏览器中查看 Git 状态（分支、暂存区、未跟踪文件）
  2. 用户可浏览提交历史并查看每次提交的 diff
  3. 用户可创建/切换/合并/删除分支
  4. GitInternalAPI 可被其他模块调用（autoCommit 返回 commit hash）
  5. Clone URL 拒绝 file:// 协议
  6. 凭证加密存储使用 AES-256-GCM + auth_tag
**Plans**: 3 plans

Plans:
- [ ] 02-01: Git 后端 API（状态/历史/分支/差异/凭证）
- [ ] 02-02: GitInternalAPI + SSRF 防护 + 路径安全
- [ ] 02-03: Git 前端界面（状态面板 + 历史记录 + 分支管理 + DiffView）

### Phase 3: PTY 终端
**Goal**: 浏览器内完整终端体验，含多会话、分屏、安全认证、资源限制
**Depends on**: Phase 1
**Requirements**: PTY-01~08
**Success Criteria**:
  1. 用户可创建/销毁多个 PTY 会话，xterm.js 正确渲染
  2. 终端支持水平/垂直分屏，可调整大小
  3. 未授权用户无法连接到 /pty 命名空间
  4. 单个 PTY 内存不超过 512MB，超限自动终止
  5. 全局 PTY 数量不超过 256
  6. 进程销毁时子进程树全部清理
  7. 二进制数据可通过 Socket.IO binary event 传输
**Plans**: 3 plans

Plans:
- [ ] 03-01: PTY 后端（node-pty 集成 + Socket.IO 命名空间 + 认证中间件）
- [ ] 03-02: PTY 资源限制 + 进程组清理 + CWD 校验
- [ ] 03-03: PTY 前端（xterm.js + 多会话 + 分屏 + 二进制帧）

### Phase 4: 文件管理 + 代码编辑
**Goal**: 完整的文件管理 + 代码编辑能力，文件树浏览和 Monaco 编辑器协同工作
**Depends on**: Phase 1, Phase 2（GitInternalAPI）
**Requirements**: FILE-01~08, EDIT-01~06
**Success Criteria**:
  1. 文件树支持懒加载、拖放移动、内联重命名
  2. 文件 CRUD 操作完整（创建/重命名/移动/复制/删除/搜索）
  3. 文件上传支持 multipart，100MB 上限
  4. Monaco Editor 正确加载，支持语言检测和自动保存
  5. 大文件（>1MB）自动切换为只读 Shiki 预览
  6. 路径遍历攻击被阻止（../../../、符号链接、URL 编码）
  7. ZIP 文件压缩比 > 100:1 被拒绝
**Plans**: 4 plans

Plans:
- [ ] 04-01: 文件后端 API（CRUD + 搜索 + 上传/下载 + 剪贴板）
- [ ] 04-02: 文件安全中间件 + 上传限制 + ZIP bomb 检测
- [ ] 04-03: 文件树前端（react-complex-tree + 右键菜单 + 拖放 + 搜索）
- [ ] 04-04: Monaco Editor 集成（懒加载 + 语言检测 + 自动保存 + 预览面板）

### Phase 5: 扩展系统
**Goal**: 三层扩展架构（插件 + Skill + Claude Plugin），含安全隔离和权限控制
**Depends on**: Phase 1
**Requirements**: EXT-01~07
**Success Criteria**:
  1. 插件可通过 Blob URL 动态加载，崩溃不影响主界面
  2. 插件 API 调用经过权限校验，未声明权限被拒绝
  3. Skill 可从 skills.sh 搜索、安装、卸载
  4. Claude Plugin 可从市场仓库浏览、安装、更新
  5. 编排 Skill 和普通 Skill 共享 ~/.claude/skills/ 路径
**Plans**: 3 plans

Plans:
- [ ] 05-01: 插件系统后端（加载/卸载/激活/停用 + 存储 API）
- [ ] 05-02: 插件前端（PluginLoader + ErrorBoundary + 权限网关）
- [ ] 05-03: Skill 管理 + Claude Plugin 管理（搜索/安装/卸载/更新）

### Phase 6: AI 工作流核心
**Goal**: 变更审查 + 时间线 + 撤销 + 上下文管理，为 AI 代理操作提供完整审计链
**Depends on**: Phase 1, Phase 2（GitInternalAPI）, Phase 4（文件 API）
**Requirements**: AIWF-01~07, CTX-01~03
**Success Criteria**:
  1. 代理文件变更按对话分组展示，支持逐文件 approve/reject
  2. 操作时间线可按类型/结果过滤
  3. 会话摘要可自动/手动生成
  4. 撤销变更支持会话/步骤/文件三种粒度
  5. 撤销前显示影响预览，回滚后可重做
  6. 上下文用量进度条实时更新
  7. 压缩事件可查看详情
**Plans**: 4 plans

Plans:
- [ ] 06-01: 变更审查后端（FileChange 数据模型 + 审查 API + 批量操作）
- [ ] 06-02: 变更审查前端（分组列表 + DiffView + 三态徽章 + 快速审查）
- [ ] 06-03: 时间线 + 摘要 + 检查点（TimelineEntry 提取 + 增量摘要 + 检查点自动创建）
- [ ] 06-04: 撤销变更 + 上下文管理（Git 回滚 + 文件快照 + 用量可视化 + 压缩通知）

### Phase 7: 移动端 + 会话分享
**Goal**: 移动端速览 + 会话分享，让开发者在手机上也能审查变更和查看终端
**Depends on**: Phase 6
**Requirements**: AIWF-08~12
**Success Criteria**:
  1. /m/* 路由提供移动端专用界面
  2. 移动端变更审查支持 swipe 手势 approve/reject
  3. 移动端终端只读显示最近 200 行
  4. PWA 推送通知在代理请求审批时触发
  5. 会话分享链接匿名可访问，支持范围/时效控制
  6. 分享内容为创建时快照，后续变更不自动同步
**Plans**: 3 plans

Plans:
- [ ] 07-01: 移动端路由 + 布局 + 变更审查
- [ ] 07-02: 移动端终端只读 + 推送通知（Web Push API）
- [ ] 07-03: 会话分享（后端 API + 分享页面 + 范围/时效控制）

### Phase 8: 代理体验
**Goal**: 二进制帧 + 语音 + Skill 编排 + 白板，增强代理与用户的交互维度
**Depends on**: Phase 1, Phase 3（Socket.IO binary）
**Requirements**: AGXP-01~04
**Success Criteria**:
  1. 用户可粘贴/拖拽图片通过 Socket.IO binary event 发送给代理
  2. 语音对话界面可录音并通过 Whisper API 转文字发送给代理
  3. 5 种编排 Skill（Loop、Handoff、Advisor、Committee、Epic）可安装使用
  4. 白板工具可绘制简单图形并发送给代理
**Plans**: 3 plans

Plans:
- [ ] 08-01: 二进制帧传输 + 图片上传组件
- [ ] 08-02: 语音对话界面（Web Speech API + Whisper API 集成）
- [ ] 08-03: Skill 编排系统 + 白板工具

## Progress

**Execution Order:**
Phases execute in numeric order: 0.5 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
（Phase 2 和 3 可并行；Phase 4 和 5 可并行）

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0.5. 技术验证 | 1/1 | Done | 2026-05-30 |
| 1. 架构基础 | 4/4 | Done | 2026-05-30 |
| 2. Git 管理 | 3/3 | Done | 2026-05-30 |
| 3. PTY 终端 | 0/3 | Not started | - |
| 4. 文件管理 + 代码编辑 | 0/4 | Not started | - |
| 5. 扩展系统 | 0/3 | Not started | - |
| 6. AI 工作流核心 | 0/4 | Not started | - |
| 7. 移动端 + 会话分享 | 0/3 | Not started | - |
| 8. 代理体验 | 0/3 | Not started | - |

---
*Roadmap created: 2026-05-30*
