# ROADMAP: Git Portal (Git 传送门)

**Created:** 2026-06-07
**Branch:** feat/v0.17.3
**Design Spec:** docs/superpowers/specs/2026-06-07-git-portal-design.md (v1.1)
**Mode:** YOLO, 自主推进，每阶段自审

---

## Overview

基于评审修订后的设计文档 v1.1，实现完整的 Git Portal 功能。包含后端 API（机器级克隆、ASKPASS 认证、流式进度）、前端 9 个新组件 + 2 个工具库 + 1 个 CSS 文件、i18n ~90 个翻译键、FileManager 和新建会话入口集成。

---

## Phases

- [ ] **GP-1: 后端基础设施** — 机器级克隆路由 + ASKPASS 认证 + 流式进度修复 + SSRF 防护
- [ ] **GP-2: 前端基础层** — localStorage 存储 + API 封装 + useGitClone Hook + CSS 动画
- [ ] **GP-3: 前端输入组件** — GitPortal 主容器 + StepInput + Auth + History + EmptyState
- [ ] **GP-4: 前端进度结果** — Animation SVG + Progress + Result
- [ ] **GP-5: 集成与 i18n** — FileManager 工具栏 + 移动端 + 新建会话 + 翻译键 + 替换旧组件
- [ ] **GP-6: 质量门禁** — typecheck + 测试 + build + 品牌检查 + 自审文档

---

## Phase Details

### GP-1: 后端基础设施

**Goal:** 建立完整的后端克隆管线，支持机器级克隆、凭据注入、流式进度和安全防护。

**Success Criteria:**
1. Hub 新增 `POST /machines/:id/git-clone` 路由（含速率限制 + SSRF 防护）
2. CLI git handler 支持 ASKPASS 凭据注入（临时脚本 → clone 后删除）
3. CLI 支持 --depth、--branch 参数 + LANG=C 环境变量
4. clone:progress 事件 Hub→Web 转发通路修复
5. SyncEngine 新增 gitCloneMachine 方法
6. shared 新增 MachineGitClone RPC 方法
7. web/api/client.ts 新增 gitCloneMachine 方法

**Files:**
```
hub/src/web/routes/git.ts              — 机器级克隆路由 + 速率限制
hub/src/sync/syncEngine.ts             — gitCloneMachine + clone:progress 转发
hub/src/socket/handlers/cli/index.ts   — clone:progress SSE 转发
shared/src/rpcMethods.ts               — MachineGitClone RPC
cli/src/modules/common/handlers/git.ts — ASKPASS + --depth + --branch + LANG=C
web/src/api/client.ts                  — gitCloneMachine
web/src/hooks/useSSE.ts                — clone:progress 事件处理
```

**Depends on:** Nothing
**Requirements:** 设计文档 §4.6, §4.8, §6.1~6.6

---

### GP-2: 前端基础层

**Goal:** 建立前端基础设施——存储、API 封装、状态管理 Hook 和 CSS 动画系统。

**Success Criteria:**
1. git-portal-storage.ts 支持历史/收藏 CRUD，最多 20 条
2. git-portal-api.ts 封装机器级克隆 + 流式进度订阅
3. useGitClone Hook 完整状态机（input→connecting→transferring→unpacking→done/error）
4. git-portal.css 包含所有 keyframes + reduced-motion 降级 + 响应式断点
5. clone 完成后 auth 自动清除

**Files:**
```
web/src/lib/git-portal-storage.ts  — localStorage CRUD
web/src/lib/git-portal-api.ts      — API 封装
web/src/components/GitPortal/useGitClone.ts — 状态 Hook
web/src/styles/git-portal.css      — 动画 + 响应式
```

**Depends on:** GP-1
**Requirements:** 设计文档 §5, §7.4, §7.5

---

### GP-3: 前端输入组件

**Goal:** 实现 Step 1 所有 UI 组件——URL 输入、认证、历史/收藏、空状态。

**Success Criteria:**
1. GitPortal.tsx 主容器支持桌面面板/移动全屏两种模式
2. GitPortalStepInput 支持 URL 校验 + 智能平台识别 + 折叠高级选项
3. GitPortalAuth 支持密码/Token 切换 + 平台提示
4. GitPortalHistory 支持最近传送 + 收藏列表
5. GitPortalEmptyState 覆盖 4 种空状态
6. 焦点管理、焦点陷阱、键盘导航正常

**Files:**
```
web/src/components/GitPortal/GitPortal.tsx            — 主容器
web/src/components/GitPortal/GitPortalStepInput.tsx   — URL + 配置
web/src/components/GitPortal/GitPortalAuth.tsx        — 认证输入
web/src/components/GitPortal/GitPortalHistory.tsx     — 历史 + 收藏
web/src/components/GitPortal/GitPortalEmptyState.tsx  — 空状态
```

**Depends on:** GP-2
**Requirements:** 设计文档 §3.1~3.8, §4.2~4.5, §7.1~7.3

---

### GP-4: 前端进度结果

**Goal:** 实现传送动画、进度展示和完成引导。

**Success Criteria:**
1. GitPortalAnimation SVG 传送门动画（含 reduced-motion 降级 + 低端设备检测）
2. GitPortalProgress 支持连接/传输/解包三阶段进度展示
3. GitPortalResult 支持完成引导（开 AI 会话 / 打开目录 / 收藏）
4. 页面过渡动效流畅（面板滑入、全屏推入等）

**Files:**
```
web/src/components/GitPortal/GitPortalAnimation.tsx — SVG 动画
web/src/components/GitPortal/GitPortalProgress.tsx  — 进度展示
web/src/components/GitPortal/GitPortalResult.tsx    — 完成引导
```

**Depends on:** GP-2
**Requirements:** 设计文档 §5.1~5.7, §2.3, §2.4

---

### GP-5: 集成与 i18n

**Goal:** 将 Git Portal 集成到 FileManager、移动端工具栏、新建会话流程，完成全部 i18n 翻译。

**Success Criteria:**
1. FileManager 工具栏新增 "Git Portal" 按钮（桌面 icon+文字 / 移动端 icon）
2. 新建会话流程新增 "从 Git 导入" 卡片
3. 现有 GitCloneDialog.tsx 替换为 GitPortal 组件
4. en.ts 和 zh-CN.ts 新增 ~90 个 gitPortal.* 翻译键
5. 现有 git.clone.* 键标记 deprecated
6. 移动端全屏体验正常（safe-area + 100dvh + 手势）

**Files:**
```
web/src/components/FileManager/FileManager.tsx — 工具栏按钮集成
web/src/lib/locales/en.ts                     — ~90 EN 翻译键
web/src/lib/locales/zh-CN.ts                  — ~90 ZH 翻译键
web/src/components/git/GitCloneDialog.tsx     — 替换为 GitPortal 引用
```

**Depends on:** GP-3, GP-4
**Requirements:** 设计文档 §2.1, §2.2, §8.1~8.3

---

### GP-6: 质量门禁

**Goal:** 全面质量验证，确保生产就绪。

**Success Criteria:**
1. typecheck 通过
2. 所有新增/修改测试通过
3. build 成功
4. 品牌检查零残留（scripts/brand-check.sh）
5. 移动端交互验证
6. 无障碍基线检查（键盘导航、ARIA、焦点管理）
7. 自审文档完成并提交

**Depends on:** GP-5
**Requirements:** 全文档

---

## Execution Order

```
GP-1 (Backend) ──→ GP-2 (Frontend Base) ──→ GP-3 (Input Components)
                                              GP-4 (Progress/Result) ──┘
                                                          │
                                                    GP-5 (Integration)
                                                          │
                                                    GP-6 (Quality Gate)
```

GP-3 和 GP-4 可并行开发（都只依赖 GP-2）。
