# Roadmap: Hapi Power v0.1

## Overview

从 hapi 上游代码基线出发，分 8 个阶段构建 AI 编码代理全栈开发者工作台。Phase 0.5 验证关键技术风险（node-pty + Bun 兼容性），Phase 1 打好架构基础（EventBus、设计系统、安全中间件、代码分割），Phase 2~5 逐模块构建核心功能（Git→PTY→Files→Extensions），Phase 6~8 构建 AI 工作流增强和代理体验。

## Phases

- [x] **Phase 0.5: 技术验证** — PoC 验证关键技术风险
- [x] **Phase 1: 架构基础** — EventBus、设计系统、安全中间件、代码分割、统一导航
- [x] **Phase 2: Git 管理** — Git 可视化管理 + GitInternalAPI
- [x] **Phase 3: PTY 终端** — xterm.js 终端 + Socket.IO 认证 + 资源限制
- [x] **Phase 4: 文件管理 + 代码编辑** — 文件树 + Monaco Editor
- [x] **Phase 5: 扩展系统** — 插件 + Skill + Claude Plugin 管理
- [x] **Phase 6: AI 工作流核心** — 变更审查 + 时间线 + 撤销 + 上下文管理
- [x] **Phase 7: 移动端 + 会话分享** — 移动速览 + 分享 + 推送通知
- [x] **Phase 8: 代理体验** — 二进制帧 + 语音 + Skill 编排 + 白板

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
- [x] 00.5-01: 关键技术 PoC 验证（node-pty + Bun、isomorphic-git、Socket.IO binary）

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
- [x] 01-01: EventBus 事件总线 + 统一错误格式 + 数据库迁移
- [x] 01-02: 设计系统实现（设计令牌 + Inter 字体 + 响应式断点 + 焦点环修正）
- [x] 01-03: 安全中间件 + Socket.IO 认证 + 日志脱敏
- [x] 01-04: 统一导航架构 + 代码分割配置

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
- [x] 02-01: Git 后端 API（状态/历史/分支/差异/凭证）
- [x] 02-02: GitInternalAPI + SSRF 防护 + 路径安全
- [x] 02-03: Git 前端界面（状态面板 + 历史记录 + 分支管理 + DiffView）

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
- [x] 03-01: PTY 后端（node-pty 集成 + Socket.IO 命名空间 + 认证中间件）
- [x] 03-02: PTY 资源限制 + 进程组清理 + CWD 校验
- [x] 03-03: PTY 前端（xterm.js + 多会话 + 分屏 + 二进制帧）

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
- [x] 04-01: 文件后端 API（CRUD + 搜索 + 上传/下载 + 剪贴板）
- [x] 04-02: 文件安全中间件 + 上传限制 + ZIP bomb 检测
- [x] 04-03: 文件树前端（react-complex-tree + 右键菜单 + 拖放 + 搜索）
- [x] 04-04: Monaco Editor 集成（懒加载 + 语言检测 + 自动保存 + 预览面板）

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
- [x] 05-01: 插件系统后端（加载/卸载/激活/停用 + 存储 API）
- [x] 05-02: 插件前端（PluginLoader + ErrorBoundary + 权限网关）
- [x] 05-03: Skill 管理 + Claude Plugin 管理（搜索/安装/卸载/更新）

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
- [x] 06-01: 变更审查后端（FileChange 数据模型 + 审查 API + 批量操作）
- [x] 06-02: 变更审查前端（分组列表 + DiffView + 三态徽章 + 快速审查）
- [x] 06-03: 时间线 + 摘要 + 检查点（TimelineEntry 提取 + 增量摘要 + 检查点自动创建）
- [x] 06-04: 撤销变更 + 上下文管理（Git 回滚 + 文件快照 + 用量可视化 + 压缩通知）

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
- [x] 07-01: 移动端路由 + 布局 + 变更审查
- [x] 07-02: 移动端终端只读 + 推送通知（Web Push API）
- [x] 07-03: 会话分享（后端 API + 分享页面 + 范围/时效控制）

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
- [x] 08-01: 二进制帧传输 + 图片上传组件
- [x] 08-02: 语音对话界面（Web Speech API + Whisper API 集成）
- [x] 08-03: Skill 编排系统 + 白板工具

## Progress

**Execution Order:**
Phases execute in numeric order: 0.5 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
（Phase 2 和 3 可并行；Phase 4 和 5 可并行）

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0.5. 技术验证 | 1/1 | Done | 2026-05-30 |
| 1. 架构基础 | 4/4 | Done | 2026-05-30 |
| 2. Git 管理 | 3/3 | Done | 2026-05-30 |
| 3. PTY 终端 | 1/3 | Done | 2026-05-30 |
| 4. 文件管理 + 代码编辑 | 1/4 | Done | 2026-05-30 |
| 5. 扩展系统 | 2/3 | Done | 2026-05-30 |
| 6. AI 工作流核心 | 4/4 | Done | 2026-05-30 |
| 7. 移动端 + 会话分享 | 3/3 | Done | 2026-05-30 |
| 8. 代理体验 | 3/3 | Done | 2026-05-30 |

---
*Roadmap created: 2026-05-30*
*Last updated: 2026-05-31 — v0.5 Phases 26~30 已规划*

## v0.3 Phases — 品牌独立 ✅

- [x] **Phase 14: 核心基础设施改名** — shared/ 包名 + import + 数据目录
- [x] **Phase 15: CLI + Hub 后端改名** — 二进制名 + 配置 + 数据库文件
- [x] **Phase 16: 前端 + PWA 品牌升级** — manifest + HTML + i18n + localStorage
- [x] **Phase 17: Website + 文档 + CI 全量升级** — 文档 + Actions + Issue 模板
- [x] **Phase 18: 验证 + 发布** — 全量构建 + v0.3.0 tag + Release

## v0.4 Phases — PWA 深度优化 ✅

- [x] **Phase 19: SW 更新机制修复** — 修复 PWA 更新不生效的核心问题
- [x] **Phase 20: 安装引导 + Manifest 完善** — 增强安装引导体验和 PWA 完整性
- [x] **Phase 21: 通知与 Badge API** — 实现角标通知和推送优化
- [x] **Phase 22: 质量门禁 + 发布** — 构建、测试、发布 v0.4

### Phase 19: SW 更新机制修复
**Goal**: 修复 PWA 模式下更新不生效的核心问题，确保用户无需重装即可获取新版本
**Depends on**: v0.3 (main)
**Requirements**: SWU-01~06
**Success Criteria**:
  1. registerType 改为 'prompt'，onNeedRefresh 正常触发
  2. sw.ts 包含 skipWaiting + clients.claim
  3. 自定义更新横幅 UI 替代 confirm()，显示版本号
  4. iOS 上每 30 分钟轮询 SW 更新
  5. navigator.storage.persist() 在安装后自动调用
**Plans**: 2 plans

Plans:
- [x] 19-01: SW 更新机制修复（registerType + skipWaiting + clients.claim + 轮询优化）
- [x] 19-02: 自定义更新 UI + storage persist + 质量门禁

### Phase 20: 安装引导 + Manifest 完善
**Goal**: 增强 Safari 安装引导体验，完善 PWA manifest 配置
**Depends on**: Phase 19
**Requirements**: INST-01~04, MNF-01~04
**Success Criteria**:
  1. 安装引导支持"稍后提醒"（7 天后重新显示）
  2. 引导时机延迟到有会话后
  3. iOS 引导文本全部 i18n 化
  4. theme-color 初始值与 manifest 一致
  5. offline.html 支持中/英文
**Plans**: 2 plans

Plans:
- [x] 20-01: 安装引导增强（稍后提醒 + 时机 + i18n + 醒目设计）
- [x] 20-02: Manifest 完善（theme-color + screenshots + share_target + offline i18n）

### Phase 21: 通知与 Badge API
**Goal**: 实现应用图标角标通知，优化推送通知交互
**Depends on**: Phase 19
**Requirements**: NTF-01~04
**Success Criteria**:
  1. 会话状态变更时 setAppBadge 显示未读角标
  2. 推送通知包含 actions 按钮
  3. 通知权限请求延迟到适当时机
  4. iOS standalone 模式推送正常工作
**Plans**: 2 plans

Plans:
- [x] 21-01: Badge API 实现（角标管理 + 会话状态联动）
- [x] 21-02: 推送通知优化（actions + 权限时机 + iOS 兼容验证）

### Phase 22: 质量门禁 + 发布
**Goal**: 全量质量检查 + 构建 + 发布 v0.4
**Depends on**: Phase 19, 20, 21
**Requirements**: 全部 v0.4 requirements
**Success Criteria**:
  1. typecheck 通过
  2. vitest 全部通过
  3. 真机 iOS Safari PWA 验证通过
  4. v0.4 tag + GitHub Release 发布
**Plans**: 1 plan

Plans:
- [x] 22-01: 质量门禁 + 构建发布 v0.4

## v0.4+ Phase — 品牌残留全面清理 ✅

- [x] **Phase 23: 品牌残留全面清理** — 清除约 88 处 hapi 旧品牌残留

### Phase 23: 品牌残留全面清理 ✅
**Goal**: 全量清除 v0.3 品牌升级遗漏的 ~88 处旧 hapi/HAPI 品牌引用
**Depends on**: v0.4 (main)
**Status**: ✅ 完成 (commit 0df40a2, 38 文件 +219/-87)
**Success Criteria**: (全部通过)
  1. ✅ 设置页面显示正确的官方网站 URL（非 hapi.run）
  2. ✅ APP_VERSION 与实际版本一致（非 0.18.4）
  3. ✅ Hub banner 显示 "HapiPower Hub"（非 HAPI Hub）
  4. ✅ 登录页 footer 显示 "Hapi Power"（非 HAPI）
  5. ✅ 所有 i18n 翻译中无独立 "HAPI" 品牌名
  6. ✅ localStorage keys 统一使用 hapi-power- 前缀（含迁移逻辑）
  7. ✅ CLI 系统提示词中品牌名正确
  8. ✅ grep 全量扫描零残留（独立 \bHAPI\b）
  9. ✅ typecheck + vitest 通过

Plans:
- [x] 23-01: P0 核心品牌替换（UI 可见文本 + 版本号 + Hub banner + i18n）
- [x] 23-02: P1 代码替换（CLI 提示词 + 注释 + localStorage 迁移 + 测试）
- [x] 23-03: P2 文档替换 + 质量门禁（grep 零残留 + typecheck + 测试）

**品牌防护**: scripts/brand-check.sh — 每次 commit 前运行
**完整报告**: .planning/research/BRAND-RESIDUE.md

## v0.4+ Phase — 功能导航入口修复 ✅

- [x] **Phase 24: 功能导航入口修复** — 补全 Git/扩展/Skill编排的导航入口

### Phase 24: 功能导航入口修复 ✅
**Goal**: 排查所有已规划功能的实际实现状态，修复缺失的导航入口
**Depends on**: Phase 23
**Status**: ✅ 完成 (commit c92ea03, 6 文件 +56/-120)
**Success Criteria**: (全部通过)
  1. ✅ 深度排查确认 15+ 功能全部已实现（Git/PTY/文件/扩展/AI工作流/分享等）
  2. ✅ SessionHeader 新增 Git 管理和扩展按钮（路由到 /sessions/$id/git 和 /sessions/$id/extensions）
  3. ✅ 会话列表页头新增 Skill 编排全局导航（路由到 /orchestration）
  4. ✅ 删除未使用的 Sidebar 组件（代码死代码清理）
  5. ✅ 补充 en/zh-CN 国际化条目
  6. ✅ typecheck + vitest 676/676 通过

Plans:
- [x] 24A: SessionHeader 添加 Git + Extensions 导航按钮
- [x] 24B: 清理 Sidebar + 添加 Orchestration 入口 + i18n
- [x] 24C: 质量门禁 + 提交推送

- [x] **Phase 25: 环境变量全量改名** — 17 个 HAPI_* → HAPI_POWER_* 含兼容回退

## 待规划 Phase

### Phase 25: 环境变量全量改名 ✅
**Goal**: 将 CLI 代码中残留的 17 个 HAPI_* 环境变量统一为 HAPI_POWER_*，含运行时回退兼容
**Depends on**: Phase 24
**Status**: ✅ 完成 (commit b193757, 17 文件 +95/-75)
**Success Criteria**: (全部通过)
  1. ✅ A 类（用户配置）使用 envCompat.ts 兼容读取（先 HAPI_POWER_* 后 HAPI_*）
  2. ✅ B 类（内部变量）直接改名（WORKTREE_*, INVOKED_CWD, OPENCODE_*）
  3. ✅ C 类（开发脚本）直接改名（HAPI_DEV_*）
  4. ✅ 所有测试文件同步更新
  5. ✅ typecheck + vitest 676/676 通过

Plans:
- [x] 25A: 全量排查和分类（17 个变量 + 1 个脚本）
- [x] 25B: 实现改名 + 兼容回退
- [x] 25C: 文档更新 + 质量门禁

## v0.5 Phases — 核心开发者工作流

- [ ] **Phase 26: Git Clone + Remote 管理** — 项目初始化核心能力
- [ ] **Phase 27: Git Push/Pull + 分支协作** — 代码推送和远程同步
- [ ] **Phase 28: Monaco Editor 正式接入 + 代码评审增强** — 编辑器和 Diff 增强
- [ ] **Phase 29: 工作流集成 + 首页引导** — 端到端开发者体验
- [ ] **Phase 30: 质量门禁 + 发布 v0.5** — 全量测试和发布

### Phase 26: Git Clone + Remote 管理
**Goal**: 实现从 Web UI 直接克隆 Git 仓库到远程机器，管理远程仓库和凭证
**Depends on**: v0.4 (main)
**Requirements**: INIT-01~05
**Success Criteria**:
  1. 用户可在 Web UI 输入 Git URL，选择目标目录和机器，执行 git clone
  2. Clone 进度实时反馈（对象计数、网络速度）
  3. Clone 完成后可一键创建会话
  4. 可查看/添加/删除 remote
  5. 可管理 Git 凭证（Token、SSH Key）
**Plans**: 3 plans

Plans:
- [ ] 26-01: Git Clone 后端（CLI RPC handler + Hub API + Socket.IO 进度推送）
- [ ] 26-02: Git Clone 前端（CloneDialog + 进度显示 + 完成后续流程）
- [ ] 26-03: Remote 管理 + 凭证管理 UI

### Phase 27: Git Push/Pull + 分支协作
**Goal**: 实现代码推送、拉取、合并等远程协作操作
**Depends on**: Phase 26
**Requirements**: BRANCH-01~05
**Success Criteria**:
  1. 用户可在 Git 管理面板推送当前分支到远程
  2. 支持 force push 确认、upstream 设置
  3. 可从远程拉取更新，显示 fetch 结果
  4. 可执行 merge/rebase 操作，冲突时提示
  5. 可从推送的分支创建 GitHub PR
**Plans**: 3 plans

Plans:
- [ ] 27-01: Push/Pull 后端（CLI RPC + Hub API + 凭证自动注入）
- [ ] 27-02: Push/Pull 前端（PushDialog + PullDialog + 状态显示）
- [ ] 27-03: 分支协作（Merge/Rebase UI + PR 创建 + 分支对比）

### Phase 28: Monaco Editor 正式接入 + 代码评审增强
**Goal**: 将 Monaco Editor 正式接入文件路由，增强 Diff 查看和代码评审体验
**Depends on**: v0.4 (main)
**Requirements**: EDITOR-01~04, REVIEW-01~04
**Success Criteria**:
  1. 文件路由使用 Monaco Editor 替代简单文本编辑器
  2. 自动保存（可配置延迟）+ 保存状态指示器
  3. 多标签编辑，可同时打开多个文件
  4. Side-by-side Diff 模式（左旧右新）
  5. 变更统计摘要（文件数、代码行数增减）
**Plans**: 3 plans

Plans:
- [ ] 28-01: Monaco Editor 接入文件路由 + 自动保存 + 多标签
- [ ] 28-02: Side-by-side Diff 组件 + 变更统计
- [ ] 28-03: 质量门禁 + typecheck + 测试

### Phase 29: 工作流集成 + 首页引导
**Goal**: 打通从克隆到推送的端到端流程，优化首页引导体验
**Depends on**: Phase 26, 27, 28
**Requirements**: FLOW-01~03
**Success Criteria**:
  1. 首页显示"克隆项目 → 初始化 → 开始开发"引导流程
  2. 首页显示最近项目目录，一键进入
  3. 显示当前项目状态（未初始化/已克隆/开发中/有未提交变更）
**Plans**: 2 plans

Plans:
- [ ] 29-01: 首页重设计（工作流引导 + 最近项目 + 状态指示）
- [ ] 29-02: 质量门禁 + 体验验证

### Phase 30: 质量门禁 + 发布 v0.5
**Goal**: 全量质量检查 + 构建 + 发布 v0.5
**Depends on**: Phase 26, 27, 28, 29
**Requirements**: 全部 v0.5 requirements
**Success Criteria**:
  1. typecheck 通过
  2. vitest 全部通过
  3. 端到端工作流验证（克隆 → 编辑 → 提交 → 推送 → PR）
  4. v0.5 tag + GitHub Release 发布
**Plans**: 1 plan

Plans:
- [ ] 30-01: 质量门禁 + 构建发布 v0.5

## v0.6 Phases — 核心功能迭代优化

- [ ] **Phase 31: Git 管理优化** — i18n + bug 修复 + commit UI + fetch UI
- [ ] **Phase 32: 文件管理全栈 CRUD** — 文件操作 + 预览增强 + iOS 适配
- [ ] **Phase 33: Skill/Plugin 管理增强** — 多平台搜索 + 真实安装 + 市场
- [x] **Phase 34: 文件预览 / 编辑闭环** — FileManager 打开文件、预览、编辑、保存、失败恢复、Dirty 离开保护

### Phase 31: Git 管理优化
**Goal**: 修复 Git 管理的核心体验问题：i18n 缺失、已知 bug、补齐 commit/fetch UI
**Depends on**: v0.5 (main)
**Requirements**: GIT-I18N-01~03, GIT-BUG-01~02, GIT-FEAT-01~02
**Success Criteria**:
  1. 7 个 Git 组件 40+ 处英文硬编码全部接入 i18n t() 函数
  2. GitPushDialog upstream 变量修复，勾选 "Set upstream" 实际生效
  3. 重复解析器合并（GitStatusPanel 简化版 → gitParsers.ts 统一版）
  4. Commit UI 双模式：Status 面板嵌入快捷提交 + 详细提交弹窗（选文件+消息+签名选项）
  5. Fetch 按钮（与 Pull 并列），执行 git fetch 并显示结果
  6. typecheck + vitest 全部通过
**Plans**: 4 plans

Plans:
- [ ] 31-01: Git 组件全面 i18n 国际化（7 组件 40+ 处硬编码 → t()）
- [ ] 31-02: Git Bug 修复（upstream 无效 + 重复解析器合并）
- [ ] 31-03: Commit UI（Status 面板嵌入快捷提交 + 详细提交弹窗）
- [ ] 31-04: Fetch UI + 质量门禁

### Phase 32: 文件管理全栈 CRUD
**Goal**: 补齐文件管理完整 CRUD 能力，增强预览体验，适配 iOS 端
**Depends on**: Phase 31
**Requirements**: FILE-CRUD-01~06, FILE-PREVIEW-01~02, FILE-IOS-01~02
**Success Criteria**:
  1. 文件 CRUD 完整：创建文件/文件夹、删除、重命名、移动、复制、复制路径
  2. 交互入口：右键/长按菜单 + 选中后工具栏（PC + iOS 通用）
  3. MD 文件默认渲染预览，点击切换编辑模式
  4. 文件快速预览模式（先预览再编辑，避免每次加载 Monaco）
  5. WriteFile 缺陷修复（无 hash 时也能覆盖已有文件）
  6. iOS 端触摸友好交互（长按 500ms 触发菜单，拖放支持触摸）
  7. typecheck + vitest 全部通过
**Plans**: 4 plans

Plans:
- [ ] 32-01: 文件操作后端（RPC + API + CLI handler: 创建/删除/重命名/移动/复制/创建目录）
- [ ] 32-02: 文件树交互（右键/长按菜单 + 工具栏 + 拖放 + iOS 适配）
- [ ] 32-03: 文件预览增强（MD 预览/编辑切换 + 快速预览模式）
- [ ] 32-04: WriteFile 修复 + 质量门禁

### Phase 33: Skill/Plugin 管理增强
**Goal**: 增强 Skill 多平台搜索安装能力，实现 Plugin 真实安装和市场浏览
**Depends on**: Phase 32
**Requirements**: SKILL-01~03, PLUGIN-01~04
**Success Criteria**:
  1. Extensions 页面 i18n 修复，所有 t() key 在 en/zh-CN locale 中存在
  2. Skill 多平台搜索：skills.sh + GitHub Topics 同时查询并聚合结果
  3. Skill 来源扩展：支持非 GitHub 平台（GitLab、自托管 Git）
  4. Plugin 真实安装：从 registry/URL 下载实际代码，不再只创建骨架
  5. Plugin 启用/禁用切换：列表中添加开关，动态加载/卸载
  6. Plugin 市场浏览：同时支持 Claude 官方市场 + GitHub 开源插件
  7. typecheck + vitest 全部通过
**Plans**: 4 plans

Plans:
- [ ] 33-01: Skill/Plugin 页面 i18n + 多平台搜索（skills.sh + GitHub）
- [ ] 33-02: Plugin 实质化安装 + 启用/禁用切换
- [ ] 33-03: Plugin 市场（Claude 官方 + GitHub）
- [ ] 33-04: 质量门禁


### Phase 34: 文件预览 / 编辑闭环
**Goal**: 在 FileManager 基础上建立文件内容查看与轻量编辑闭环，覆盖文本、代码、Markdown、图片、二进制、大文件、保存失败、未保存离开确认。
**Depends on**: Phase 32
**Requirements**: FPV-01~10
**Success Criteria**:
  1. 从 FileManager 点击文件可打开统一 Viewer
  2. 文本/代码文件可预览、编辑、保存
  3. 保存失败时本地改动不丢失，可重试或复制内容
  4. Dirty 状态离开会确认
  5. Markdown 默认预览，可切换编辑
  6. 图片文件使用图片预览，二进制文件显示不可预览状态
  7. 大文件触发保护状态，不直接进入可编辑区域
  8. 中英 i18n、a11y、移动端触控目标达标
  9. typecheck + tests + build 质量门禁通过
**Planning Artifacts**:
  - `.planning/phases/34-file-preview-editing/34-PRD.md`
  - `.planning/phases/34-file-preview-editing/34-UX-SHAPE.md`
  - `.planning/phases/34-file-preview-editing/34-PLAN.md`
**Plans**: 1 vertical MVP plan

Plans:
- [x] 34-01: 文件预览 / 编辑垂直闭环（打开→预览→编辑→保存→失败恢复→Dirty 离开保护）

---

*Roadmap created: 2026-05-30*
*Last updated: 2026-06-06 — Phase 34 文件预览 / 编辑闭环已完成，audit 18/20*
