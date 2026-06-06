# Hapi Power -- 项目状态

## 项目参考

参见: .planning/PROJECT.md (更新于 2026-05-30)

**核心价值:** 让 AI 编码代理拥有完整的开发者环境 -- 代码编辑、终端操作、版本控制、插件扩展，全部在浏览器中完成。
**当前状态:** v0.5 规划中

## 当前状态

- **版本**: v0.5 规划中 (核心开发者工作流)
- **分支**: feat/v5
- **远程仓库**: https://github.com/zulinliu/make-hapi-power-again.git
- **v0.5 主题**: Clone → 编辑 → 评审 → Push → PR 全流程打通

## v0.1 已完成

### 开发阶段 (Phase 0.5 ~ 8)
- [x] Phase 0.5: 技术验证 (84% PoC 通过)
- [x] Phase 1: 架构基础 (EventBus + ApiResponse + 设计系统 + 安全 + 导航)
- [x] Phase 2: Git 管理 (GitInternalAPI + 凭证 + SSRF 防护)
- [x] Phase 3: PTY 终端 (xterm.js + Socket.IO + 资源限制)
- [x] Phase 4: 文件管理 + Monaco Editor
- [x] Phase 5: 扩展系统 (插件 + Skill + Claude Plugin)
- [x] Phase 6: AI 工作流 (变更审查 + 时间线 + 撤销 + 上下文)
- [x] Phase 7: 移动端 + 会话分享
- [x] Phase 8: 代理体验 (语音 + Skill 编排 + 白板)
- [x] 文档重写 D1~D4
- [x] 收尾 T1~T4

## v0.2 已完成

### Phase 9: 全功能审计 ✅ (2026-05-31)
- [x] 4 并行代码审计 agent (Module A+B, C+D, E+F+G, Security)
- [x] Lighthouse 基线审计 (A11y 90, BP 96, SEO 91, Agentic 67)
- [x] 浏览器 UI 验证 (登录/列表/详情/Git/Terminal)
- [x] OWASP Top 10 安全审计 (7 PASS, 3 WARN)

### Phase 10~13: iOS PWA + 移动端 + i18n + 收尾 ✅ (2026-05-31)
- [x] iOS PWA 深度优化 (manifest + 图标 + 启动画面 + 离线)
- [x] 移动端体验增强 (虚拟键盘 + 分享安全)
- [x] i18n 中英双语 (397 键完整覆盖)
- [x] 设计打磨 + v0.2.0 发布

## v0.3 已完成 — 品牌独立

### Phase 14: 核心基础设施改名 ✅
- [x] shared/ 包名 @hapi/protocol → @hapipower/protocol
- [x] 所有 import 路径 @hapi/ → @hapipower/
- [x] 数据目录 ~/.hapi → ~/.hapi-power
- [x] CLI 二进制 hapi → hapi-power

### Phase 15: CLI + Hub 后端改名 ✅
- [x] Hub 包名 + 配置属性名更新
- [x] 后端字符串引用全量替换
- [x] 数据库文件名 hapi.db → hapi-power.db

### Phase 16: 前端 + PWA 品牌升级 ✅
- [x] PWA manifest name → Hapi Power
- [x] HTML title/meta 更新
- [x] UI 文本品牌展示更新

### Phase 17: Website + 文档 + CI 全量升级 ✅
- [x] website/ 目录全量品牌升级
- [x] README + 文档更新
- [x] GitHub Actions + Issue 模板更新

### Phase 18: 验证 + 发布 ✅
- [x] 全量构建 + typecheck + 测试
- [x] v0.3.0 tag + GitHub Release

**⚠️ v0.3 遗留问题**: 代码标识符改名完成但用户可见文本(~88处)未清理，Phase 23 补充完成。

## v0.4 已完成 — PWA 深度优化 + 品牌清理

### Phase 19~22: PWA 深度优化 ✅ (2026-05-31)
- [x] Phase 19: SW 更新机制修复 (registerType + skipWaiting + 自定义更新 UI)
- [x] Phase 20: 安装引导增强 (稍后提醒 + 时机 + i18n + Manifest 完善)
- [x] Phase 21: 通知与 Badge API (角标 + 推送优化)
- [x] Phase 22: 质量门禁 + v0.4 发布

### Phase 23: 品牌残留全面清理 ✅ (2026-05-31)
- [x] 23-01: P0 核心品牌替换 (UI 可见文本 + 版本号 + Hub banner + i18n)
- [x] 23-02: P1 代码替换 (CLI 提示词 + 注释 + localStorage 迁移 + 测试)
- [x] 23-03: P2 文档替换 + 质量门禁 (grep 零残留)
- **Commit**: 0df40a2 (38 文件, +219/-87)
- **验证**: scripts/brand-check.sh 全量扫描

### Phase 24: 功能导航入口修复 ✅ (2026-05-31)
- [x] 深度排查所有规划功能的实际实现状态（15+ 功能全部已实现）
- [x] 24A: SessionHeader 添加 Git 管理 + 扩展按钮
- [x] 24B: 清理未使用 Sidebar 组件 + 添加 Skill 编排全局入口
- [x] 24C: 质量门禁通过（typecheck + 676/676 tests）+ 提交推送
- **Commit**: c92ea03 (6 文件, +56/-120)
- **修复内容**: Git 管理、扩展系统、Skill 编排三个功能之前无导航入口

### Phase 25+: 环境变量全量改名 ✅ (2026-05-31)
- [x] 25A: 排查分类（17 个变量 + 1 个脚本）
- [x] 25B: 实现改名 + 兼容回退（A 类用 envCompat.ts，B/C 类直接改名）
- [x] 25C: 文档更新 + 质量门禁（typecheck + 676/676 tests）
- **Commit**: b193757 (17 文件, +95/-75)
- **新增工具**: cli/src/utils/envCompat.ts — getEnv/getEnvNumber 兼容读取

## 品牌升级经验总结

### 完整历程

品牌升级分两轮完成：

**第一轮 (v0.3, Phase 14~18)**: 代码标识符层改名
- npm 包名 @hapi → @hapipower
- 环境变量前缀 HAPI_ → HAPI_POWER_（部分完成）
- 数据目录 ~/.hapi → ~/.hapi-power
- CLI 二进制名 hapi → hapi-power

**第二轮 (v0.4, Phase 23)**: 用户可见文本全面清理
- UI 文本、i18n 翻译、HTML 模板
- Hub 启动 banner、CLI 系统提示词
- 注释、文档、测试描述
- localStorage key 迁移逻辑
- 共 38 文件 219 处插入 87 处删除

### 遗留待处理

| 类别 | 数量 | 说明 |
|------|------|------|
| 环境变量 HAPI_* → HAPI_POWER_* | ✅ 已完成 | Phase 25, 17 个变量, 含兼容回退 |

### 品牌防护规则（必须遵守）

1. **零容忍** — 独立的 `\bHAPI\b` 不允许出现在任何新增文件中（代码标识符如 @hapipower 除外）
2. **每次 commit 前检查** — 运行 `scripts/brand-check.sh`
3. **新代码必须使用 Hapi Power 品牌** — 所有 UI 文本、注释、日志、文档
4. **发现残留立即修复** — 不允许推后到下个版本

### 品牌规范速查

| 上下文 | 正确用法 | 错误用法 |
|--------|----------|----------|
| 品牌名 | Hapi Power | HAPI, hapi, HapiPower |
| 产品全名 | HapiPower Hub | HAPI Hub |
| npm 包名 | @hapipower/protocol | @hapi/protocol |
| 环境变量 | HAPI_POWER_* | HAPI_* |
| 数据目录 | ~/.hapi-power | ~/.hapi |
| 官方仓库 | github.com/zulinliu/make-hapi-power-again | hapi.run |

## v0.4 运维踩坑记录

### 2026-05-31: http_proxy + 机器注册连环问题

三个连锁问题: 创建会话报错 workspace roots / 机器名显示 UUID / 目录浏览缺失

**根因**:
1. `http_proxy` 环境变量导致 axios 把 localhost 请求转发到代理，代理返回 502 → **修复: `NO_PROXY=localhost,127.0.0.1`**
2. 测试时用 curl 预创建了空 metadata 的机器记录，hub 的 `getOrCreateMachine` 是 get-OR-create 不更新已有记录 → **修复: 清理 DB + 重启**
3. `--workspace-root` 设置过窄（只包含项目目录）→ **修复: 改为 `/home/liuzl`**

**完整记录**: .planning/research/OPS-LESSONS.md
**启动脚本**: scripts/start-runner.sh

## 研究文档

| 文件 | 用途 |
|------|------|
| .planning/research/IOS-PWA.md | iOS PWA 最佳实践研究 (1457 行) |
| .planning/research/IOS-PWA-DEEP.md | iOS PWA 深度研究 (1119 行) |
| .planning/research/IOS-PWA-BUGS.md | iOS PWA 三个真实体验问题分析 |
| .planning/research/MOBILE-UX.md | 移动端 UX 研究参考 (756 行) |
| .planning/research/I18N.md | i18n 实现方案研究 |
| .planning/research/AUDIT.md | 全功能审计方法论 (766 行) |
| .planning/research/OPS-LESSONS.md | 运维踩坑记录: proxy+机器注册 |
| .planning/research/BRAND-RESIDUE.md | **品牌升级完整报告** (含执行记录+防护规则) |

## 关键发现

### v0.1 发现
1. **Bun Terminal API**: `data(terminal, data)` 双参数回调
2. **Socket.IO**: String 编码比 Binary 快 6x
3. **Blob Import**: Bun 完美支持，插件系统可行
4. **isomorphic-git**: 服务端可用 node:fs，浏览器端需 LightningFS
5. **路径安全**: 双重 URL 编码、null byte、多重点号需额外处理
6. **单文件构建**: `build:single-exe` 可生成 136MB 独立可执行程序

### v0.2 研究发现
1. **iOS PWA 限制**: 不支持 SVG 图标、maskable、Background Sync、Periodic Background Sync
2. **iOS 7 天清理**: PWA 缓存 7 天不用会被系统清理，需存储持久化检查
3. **i18n 双轨**: web/ 自研轻量方案 (54 文件 125 调用点) vs website/ react-i18next (6 文件)
4. **审计工作量**: 9 模块 ~33 小时预估

### v0.3~v0.4 品牌升级教训
1. **分层替换不够** — 必须覆盖 7 个层次：UI 文本、i18n、HTML、日志、提示词、注释、配置
2. **grep 验证是唯一可靠标准** — 不能用"我改过了"作为完成标准
3. **环境变量改名需兼容迁移** — HAPI_* → HAPI_POWER_* 需要运行时回退逻辑
4. **新增代码也必须用新品牌** — 品牌升级是持续性约束，不是一次性工作

---
*状态更新: 2026-05-31 (Phase 25 环境变量全量改名完成 — 全部规划任务已完成)*

## v0.5 规划中 — 核心开发者工作流

### 核心用户场景
用户打开 Hapi Power → 克隆一个 Git 项目 → 通过文件管理初始化目录 → 新建会话用 Claude Code 开发 → 对比评审代码 → 新建分支推送代码

### Phase 26~30 已规划
- [ ] Phase 26: Git Clone + Remote 管理（INIT-01~05）
- [ ] Phase 27: Git Push/Pull + 分支协作（BRANCH-01~05）
- [ ] Phase 28: Monaco Editor 正式接入 + 代码评审增强（EDITOR-01~04, REVIEW-01~04）
- [ ] Phase 29: 工作流集成 + 首页引导（FLOW-01~03）
- [ ] Phase 30: 质量门禁 + 发布 v0.5

### 功能缺口审计结果（v0.4）

基于 REQUIREMENTS.md 104 项需求的全量审计：
- DONE: 32 项 (31%)
- PARTIAL: 16 项 (15%)
- MISSING: 10 项 (10%)
- 基础设施类（已标记完成）: 46 项 (44%)

TOP 10 缺口：EDIT-01, FILE-01, FILE-02, FILE-05, PTY-02, GIT-04, FILE-12, EDIT-03, AGXP-03, FILE-06

---
*状态更新: 2026-05-31 (v0.5 规划完成，待执行)*

## v0.6 规划中 — 核心功能迭代优化

### 核心用户场景
日常使用中最频繁的操作：Git 管理（提交代码）、文件管理（增删改查）、Skill/Plugin 管理

### 讨论决策已完成 (2026-05-31)

**Phase 31: Git 管理优化**
- i18n：7 个组件 40+ 处英文硬编码全部接入 t()
- Bug：upstream 无效修复 + 重复解析器合并
- Commit UI：Status 面板嵌入快捷提交 + 详细提交弹窗
- Fetch UI：简单按钮与 Pull 并列
- 暂不做：stash/tag/rebase/reset/cherry-pick/blame

**Phase 32: 文件管理全栈 CRUD**
- 完整 CRUD：创建文件/文件夹、删除、重命名、移动、复制、复制路径
- 交互：右键/长按菜单 + 选中后工具栏（PC + iOS 通用）
- MD 预览：默认渲染预览，点击切换编辑
- 快速预览模式（先预览再编辑）
- iOS 触摸适配（长按 500ms + 拖放触摸支持）
- WriteFile 缺陷修复

**Phase 33: Skill/Plugin 管理增强**
- Skill i18n + 多平台搜索（skills.sh + GitHub，逐步扩展）
- Plugin 真实安装（从 registry/URL 下载实际代码）
- Plugin 启用/禁用切换
- Plugin 市场（Claude 官方 + GitHub 开源）

**暂缓**
- 插件系统底层架构（沙箱加载、扩展点系统）

---
*状态更新: 2026-05-31 (v0.6 Phase 31~33 规划完成，讨论决策已记录)*

## v0.7 已完成 — 自定义模型 API 配置与切换

### 核心用户场景
用户配置第三方 API 供应商（如中转服务）→ 自动发现可用模型 → 在新建会话时直接选择供应商+模型 → 供应商配置对会话即时生效

### 讨论决策已完成 (2026-05-31)

| 决策 | 选择 |
|------|------|
| 协议转换策略 | 分阶段，v0.7 先做配置+发现，v0.8 实现协议转换 |
| 存储方式 | SQLite + AES-256-GCM 加密 |
| 供应商模型 | 全局供应商池 |
| 预设模板 | 无预设，用户自定义 |
| UI 融合 | ModelSelector 下拉框内完全融合 |
| 配置下发 | Hub→CLI RPC |
| 代理范围 | Claude / Codex / Gemini / OpenCode |

### Phase 34~38 已完成 ✅
- [x] Phase 34: 数据模型与后端 API — providers + provider_assignments 表, AES-256-GCM 加密, CRUD API (828b090)
- [x] Phase 35: 模型发现引擎 — 多协议探测, 候选 URL 构建, 缓存, 25 测试 (a0bc5c3)
- [x] Phase 36: CLI 集成与配置下发 — Hub→CLI RPC, 运行时环境变量 (b3b892c)
- [x] Phase 37: 前端 UI 融合 — Settings 供应商管理, API hooks, i18n (6cdccea)
- [x] Phase 38: 安全加固 + 测试 — API Key 泄露修复, 缓存键安全, 32 测试 (e4b11ff)

### 安全审查修复
- CRITICAL-1: 从所有 providers API 响应中剥离 apiKeyEncrypted 字段
- HIGH-2: discoverModels 缓存键改用 providerId 替代密文片段

### 研究基础
- 深度分析了 cc-switch 及 3 个衍生项目（共 4 个代码库）
- 研究报告：.planning/research/V07-CC-SWITCH-RESEARCH.md
- 需求文档：.planning/REQUIREMENTS-v0.7.md
- 路线图：.planning/ROADMAP-v0.7.md

### v0.7 补丁修复 (2026-06-02)

**全流程测试修复** — 使用 tsintergy 真实 API 供应商进行端到端验证，发现并修复以下问题：

| 修复 | 问题 | 解决方案 |
|------|------|---------|
| spawn providerId 传递 | machines.ts 解析了 providerId 但未传递给 engine | spawn 成功后自动查找供应商并 applySessionConfig |
| ModelSelector 合并 | 供应商模型替换了标准模型，用户无法选择官方模型 | 标准 + 供应商模型合并显示（⇄ 前缀区分） |
| AES 密钥持久化 | 加密密钥仅在内存中，hub 重启后 API Key 无法解密 | 持久化到 ~/.hapi-power/provider-encryption.key |
| iOS 弹窗键盘 | Dialog 容器使用固定高度，键盘弹出后内容飘出 | 改用 overflow-y:auto + dvh 适配 |
| SessionChat 同步 | 会话内模型切换同样存在替换而非合并的问题 | 统一使用合并逻辑 |
| 错误消息修正 | providers API 说 "Only https" 但实际允许 http | 修正为 "public http(s)" |

**E2E 测试结果（真实 API 供应商 tsintergy）：**
- 创建供应商 → ✅
- 分配给 Claude → ✅
- 发现模型（21 个）→ ✅
- 新建会话模型选择器显示 5 标准 + 21 供应商 → ✅
- 删除供应商 → ✅
- 重新创建供应商 → ✅
- 再次验证模型选择器 → ✅

**Commit**: a8f7e43 (9 files, +104/-41)

---
*状态更新: 2026-06-02 (v0.7 补丁修复 + 全流程 E2E 验证通过)*

## v9 规划中 — UI 统一优化 (feat/v9)

### 核心用户场景
用户在桌面端浏览器中使用 Hapi Power → SessionHeader 直接看到所有功能入口（Files/Git/Extensions/Outline）→ 进入任何子页面体验一致的布局和交互 → 文件列表支持右键操作 → Git 状态页可直接预览变更文件

### Phase v9.1~v9.4 已规划
- [ ] Phase v9.1: SessionHeader 响应式工具栏（桌面端直显图标，移动端"..."菜单）
- [ ] Phase v9.2: 全局子页面布局统一（SubPageLayout + CSS 变量 + max-w-content + Tab 样式）
- [ ] Phase v9.3: 右键菜单全局适配（useContextMenu hook + 桌面右键 + 移动端"..."）
- [ ] Phase v9.4: Git 状态文件预览（点击变更文件预览内容 + 代码高亮 + 跳转）

### 关键问题（代码探索发现）

| 页面 | CSS 变量 | max-w-content | 安全区域 | 返回按钮 | Tab 指示器 | Header padding |
|------|----------|---------------|---------|---------|-----------|----------------|
| 文件页(参考) | `--app-*` ✓ | ✓ | ✓ 外层div | ✓ 圆形图标 | ✓ 绝对定位 | `p-3` ✓ |
| Git页 | `--hp-*` ✗ | ✗ | ✗ 缺失 | ✗ 文字"←" | ✗ border-b-2 | `px-4 h-12` |
| 扩展页 | `--app-*` ✓ | ✗ | ⚠ 内联计算 | ✓ | ⚠ border-b-2 | `px-3 py-2` |
| 变更/时间线/撤销 | `--app-*` ✓ | ✗ | ⚠ 内联计算 | ✓ | N/A | `px-3 py-2` |

### 需求文档
- 需求：.planning/REQUIREMENTS-v9.md（22 项需求，4 个分类）
- 路线图：.planning/ROADMAP-v9.md（4 个 Phase，6 个 Plan）
- 配置：.planning/config-v9.json（YOLO + 粗粒度 + 并行）

---

## v0.12.0 已完成 — 功能精简与焦点聚焦

### 核心目的
删除已屏蔽/禁用的非核心功能代码，保持代码库整洁，聚焦核心实用功能（会话管理、聊天、文件管理、Git、终端、扩展系统、供应商配置），形成生产可用的稳定版本。

### 当前活跃功能清单

> **重要：后续迭代请以本清单为准，不要从早期文档推断功能范围。**

| # | 功能 | 代码位置 | 备注 |
|---|------|---------|------|
| 1 | 会话管理 | web/src/routes/sessions/ | 创建/列表/详情/删除 |
| 2 | AI 多代理聊天 | web/src/components/SessionChat.tsx | Claude/Codex/Gemini/OpenCode |
| 3 | 文件管理 + Monaco Editor | web/src/routes/sessions/files.tsx | 文件树 + 代码编辑 |
| 4 | Git 管理 | web/src/routes/sessions/git.tsx | 状态/历史/分支/diff/commit/push |
| 5 | PTY 终端 | web/src/routes/sessions/terminal.tsx | xterm.js + Socket.IO |
| 6 | 扩展系统 | web/src/routes/sessions/extensions.tsx | 插件 + Skill + Claude Plugin |
| 7 | 供应商配置 | web/src/routes/settings/ | 自定义 API + 模型发现 |
| 8 | 图片上传 | web/src/components/ImagePasteDrop.tsx | Socket.IO binary event |
| 9 | 推送通知 | hub/src/notifications/ | Web Push + Badge + ServerChan + Telegram |
| 10 | PWA | web/src/sw.ts + web/src/main.tsx | Service Worker + 离线 + 安装引导 |
| 11 | i18n | web/src/lib/locales/ | 中英双语 |

### 已删除功能 (9 项)

| # | 功能 | 删除范围 | 原因 |
|---|------|---------|------|
| 1 | 白板 (Whiteboard) | 组件 + SessionChat 引用 + i18n | 完全隐藏，从未渲染 |
| 2 | Skill编排 (Orchestration) | 前端页面 + 后端路由(假数据) + 测试 | 纯假数据，无真实后端 |
| 3 | 移动端路由 (/m/*) | 2 个页面 + 路由注册 | 无导航入口，硬编码中文 |
| 4 | 变更审查页 (Changes) | 前端页面 + 后端路由 + API方法 + i18n | 导航隐藏，后端独立 |
| 5 | 撤销页 (Undo) | 前端页面 + 后端路由 + API方法 + i18n | 导航隐藏，后端独立 |
| 6 | 操作时间线 (Timeline) | 前端页面 + 后端路由 + API方法 + i18n | 导航隐藏，reducerTimeline保留(聊天核心) |
| 7 | 会话分享 (Share) | 前端页面 + 后端路由(含DB) + API方法 + i18n | 后端完整但无创建UI |
| 8 | 语音录制 STT (Whisper) | VoiceRecorder + 后端转录路由 | 外部API依赖，非核心 |
| 9 | 实时语音 (ElevenLabs) | realtime/ 目录 + VoiceProvider + 语音设置 + 后端路由 + 共享协议 | onVoiceToggle=undefined 禁用 |

### 代码变更统计

- **删除文件**: ~40 个
- **修改文件**: ~25 个
- **删除 i18n 键**: 103 个 (en + zh-CN)
- **移除 npm 依赖**: @elevenlabs/react
- **预估净删减**: ~4000+ 行

### 保留的基础设施

- `reducerTimeline.ts` + `reducerTimeline.test.ts` — 聊天消息核心渲染器，非时间线功能
- `FileSnapshotStore` + `file_snapshots` 表 — DB Schema 基础设施，保留兼容
- Push Notifications + App Badge API — 活跃 PWA 基础设施
- ServerChan / Telegram Bot — 活跃通知渠道

### 质量门禁

- typecheck: 通过
- vitest: 77 文件 651 测试全部通过
- build: 成功

### 规划文档
- 方案：.planning/phases/code-cleanup/PLAN.md
- **完整 GSD 记录**：.planning/phases/code-cleanup/RECORD.md（流程沉淀 + 删减结果 + 活跃功能清单 + 经验教训）

## v0.12.1 进行中 — Tab 切换自动刷新修复

### 根因分析

Phase 19 (PWA 更新机制修复) 引入了三个叠加问题：

| # | 问题 | 文件 | 行号 | 根因 |
|---|------|------|------|------|
| 1 | visibilitychange 每次切回触发 SW 更新检查 | `main.tsx` | 71-75 | 切标签页即触发 `registration.update()` |
| 2 | sw.ts SKIP_WAITING 监听器累积 | `sw.ts` | 36-39 | 每次 postMessage 新增一个 activate listener |
| 3 | workbox-window controlling 事件可能触发 reload | `main.tsx` (registerSW) | 55-91 | SW 激活后客户端自动重载 |

**原版代码** (commit 85560c1): `setInterval(update, 60min)` + 直接 `skipWaiting()`，无 visibilitychange，无监听器累积。

### 修复方案

| # | 修复 | 做法 |
|---|------|------|
| 1 | visibilitychange 节流 | 仅当离开超过 5 分钟后切回才检查更新 |
| 2 | sw.ts 监听器修复 | activate listener 提到全局，只注册一次 |
| 3 | 确认无 auto-reload | 检查 registerSW 配置，确保无自动 reload |

### 质量门禁

- [x] typecheck 通过
- [x] vitest 全部通过 (77 文件 651 测试)
- [x] build 成功
- [ ] 手动验证：切换标签页不再触发全局刷新

### 实际修复

| # | 文件 | 修改 |
|---|------|------|
| 1 | `web/src/main.tsx` | visibilitychange 节流：仅离开 >5 分钟后切回才 `registration.update()` |
| 2 | `web/src/sw.ts` | 移除 SKIP_WAITING 内的 activate listener 累积 |
| 3 | `web/vite.config.ts` | 确认 registerType:'prompt' + UpdateBanner 仅用户点击触发，无 auto-reload |

---
*状态更新: 2026-06-05 (v0.12.1 Tab切换自动刷新修复 — 实施完成，待手动验证)*
*状态更新: 2026-06-04 (v0.12.0 功能精简完成 — 9 项非核心功能已删除)*
*状态更新: 2026-06-03 (v9 UI统一优化规划完成)*

## v0.17.0 进行中 — 全功能文件管理器生产化

### 启动原因

用户审查确认文件管理器仍存在多个生产阻断问题：没有显性返回上一级，新建文件和新建文件夹入口冗余，显示隐藏文件不可用，除目录浏览和从目录新建会话外大量文件操作不可用，文件编辑入口不清晰且全局浏览点击文件无反应。

### 本轮核心决策

| 决策 | 结果 |
|---|---|
| `$gsd-new-project` | 项目已初始化，不重建 `.planning/PROJECT.md`，改为既有项目 v0.17 专项规划 |
| 文件管理器定位 | machine scoped 全局文件系统工作台，session 是增强上下文 |
| UI 方向 | 统一 FileManager core，去除 `/browse` 和 session files 的行为割裂 |
| API 方向 | 新增 machine 文件 CRUD API，限制在 workspaceRoots 内 |
| 自审 | 每阶段更新 `35-SELF-REVIEW.md` 并提交 Git |

### 规划文档

- `.planning/phases/35-v0.17-file-manager-production/35-CONTEXT.md`
- `.planning/phases/35-v0.17-file-manager-production/35-PRD.md`
- `.planning/phases/35-v0.17-file-manager-production/35-UX-SHAPE.md`
- `.planning/phases/35-v0.17-file-manager-production/35-PLAN.md`
- `.planning/phases/35-v0.17-file-manager-production/35-SELF-REVIEW.md`

### 当前状态

- [x] 35-00: 方案文档、UX Shape、阶段计划和自审机制
- [x] 35-01: 统一数据源接口、上一级、隐藏文件、文件打开基础
- [x] 35-02: Machine 文件 CRUD API 和 workspaceRoots 安全边界
- [x] 35-03: UI 行为收敛，去除重复入口和空壳按钮
- [x] 35-04: 预览编辑生产化，hash 冲突检测，轻编辑兜底
- [x] 35-05: 上传下载和搜索
- [ ] 35-06: 测试、自审、发布准备

### 35.2 完成记录

- CLI machine client 已覆盖 machine 级 `ReadFile`、`WriteFile`、`DeleteFile`、`RenameFile`、`CopyFile`、`MoveFile`、`CreateDirectory` RPC handler。
- Hub `machines` 路由新增 machine 文件 REST API：读、写、删、重命名、复制、移动、建目录。
- Web API client 和 FileManager 基础 create/delete/rename 已支持无 `sessionId` 的 machine 模式。
- workspaceRoots 安全边界覆盖绝对路径要求、越界路径、null byte、符号链接逃逸、已有文件冲突和 hash/force 覆盖策略。
- 已新增 CLI machine file operation 测试和 Hub machine file route 测试。

---
*状态更新: 2026-06-07 (v0.17 Phase 35.2 Machine 文件 CRUD API 完成 — 进入 35.3 UI 行为收敛)*

### 35.3 完成记录

- 全局 FileManager 新建入口收敛为单一“新建”动作，弹窗内选择文件或文件夹。
- 右键菜单移除与当前项无关的重复新建入口。
- FileManager 移动、复制、批量移动、批量复制已接入真实 API，不再显示 unavailable toast。
- 上传、下载占位入口已从全局 FileManager 可见操作中移除，后续 35.5 以真实能力重新接入。
- `/sessions/:id/files` 的“目录”Tab 改为复用统一 FileManager，保留“变更”Tab 的 Git 增强视图。
- 新增 `file-manager-api` 测试覆盖 move/copy 目标路径拼接和 create failure 冒泡。

---
*状态更新: 2026-06-07 (v0.17 Phase 35.3 UI 行为收敛完成 — 进入 35.4 预览编辑生产化)*

### 35.4 完成记录

- session `ReadFile` RPC 已返回 `hash`、`size`、`modified` 元数据，为保存冲突检测提供服务器版本基线。
- session 文件页保存不再默认强制覆盖，改为传 `expectedHash`，冲突时保留本地内容并提供重试、重新加载、强制覆盖、复制内容四种恢复动作。
- 新增 machine scoped `/browse/file` 路由，`/browse` 点击文件直接打开全局预览/编辑，不再要求活动会话。
- 全局文件页支持文本/Markdown/图片/二进制/大文件状态，文本保存使用 expectedHash，失败后不丢本地修改。
- `/browse/file` 返回时携带父目录回到 `/browse?path=...`，避免从深层文件返回后丢失空间上下文。
- 统一修正轻编辑工具栏的只读提示，仅预览态显示只读，不在编辑态误导用户。
- 新增 session file handler 测试覆盖读取元数据和 stale expectedHash 拒绝。

---
*状态更新: 2026-06-07 (v0.17 Phase 35.4 预览编辑生产化完成 — 进入 35.5 上传下载和搜索)*

### 35.5 完成记录

- FileManager 顶部和移动端底部栏重新接入真实“上传”入口，使用当前目录写入文件，不再显示上传占位 toast。
- 上传支持多文件、5MB 单文件限制、FileReader 进度条、失败提示和重试按钮；保存走 session/machine `writeFile`，默认不覆盖已有文件。
- 文件右键菜单和桌面批量栏接入真实下载，读取文件内容后以浏览器 blob 下载；目录选择会被过滤并给出明确提示。
- `/browse` 增加名称过滤和深度搜索条：名称搜索递归扫描当前子树，内容搜索读取 1MB 内文件并匹配内容。
- Hub 新增 machine 文件搜索路由 `GET /api/machines/:id/files`，搜索仍通过 machine 文件 API 的 workspaceRoots 边界约束。
- 新增 Hub route 测试覆盖 machine 文件名称搜索和内容搜索。

---
*状态更新: 2026-06-07 (v0.17 Phase 35.5 上传下载和搜索完成 — 进入 35.6 测试、自审、发布准备)*
