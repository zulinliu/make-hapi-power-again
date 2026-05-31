# Requirements: Hapi Power

**Defined:** 2026-05-30
**Core Value:** 让 AI 编码代理拥有完整的开发者环境 — 代码编辑、终端操作、版本控制、插件扩展，全部在浏览器中完成。

## v0.1 Requirements

### Architecture（架构基础）

- [x] **ARCH-01**: Hub EventBus 事件总线运行，跨模块事件可发布/订阅
- [x] **ARCH-02**: 所有新增 API 路由统一到 /api/sessions/:id/* 前缀
- [x] **ARCH-03**: 统一错误响应格式 ApiResponse<T>（{ success, error?, data? }）
- [x] **ARCH-04**: 统一导航侧边栏，整合所有功能模块入口
- [x] **ARCH-05**: Socket.IO 作为唯一实时传输层（替代 ws）
- [x] **ARCH-06**: V10 数据库迁移脚本覆盖所有新增表（git_repos、git_credentials 等）

### Design System（设计系统）

- [x] **DS-01**: Cursor + Linear 融合风格设计令牌（Canvas #0A0A0B、5 色语义系统）
- [x] **DS-02**: Inter Variable 字体系统配置
- [x] **DS-03**: 焦点环颜色修正为 accent 绿色，对比度 ≥ 4.5:1
- [x] **DS-04**: 响应式断点体系（640 / 1024 / 1440px）

### Git Management（Git 管理 — Module A）

- [x] **GIT-01**: Git 状态面板显示当前分支、暂存区、未跟踪文件
- [x] **GIT-02**: Git 历史记录浏览（提交列表 + 差异查看）
- [x] **GIT-03**: 分支管理（创建、切换、合并、删除）
- [x] **GIT-04**: 文件级 diff 查看（统一模式 + 并排模式）
- [x] **GIT-05**: GitInternalAPI 内部接口（autoCommit、resetToCommit、getHeadCommit）
- [x] **GIT-06**: Git 凭证加密存储（AES-256-GCM + auth_tag 字段）
- [x] **GIT-07**: Clone URL 白名单（仅 https:// 和 ssh://，拒绝 file://）
- [x] **GIT-08**: 路径规范化安全中间件

### PTY Terminal（终端 — Module B）

- [x] **PTY-01**: xterm.js 终端组件（多会话创建/销毁、自适应尺寸）
- [x] **PTY-02**: 终端分屏（水平/垂直分割，可调整大小）
- [x] **PTY-03**: Socket.IO /pty 命名空间 + JWT 认证中间件
- [x] **PTY-04**: PTY 资源限制（每会话内存 512MB、CPU 3600s、FD 256）
- [x] **PTY-05**: 全局 PTY 数量上限（256）
- [x] **PTY-06**: 进程销毁时 kill 整个进程组
- [x] **PTY-07**: CWD 路径校验（不允许 / 作为工作目录）
- [x] **PTY-08**: 二进制帧传输集成（图片/截图通过 Socket.IO binary event）

### File Management（文件管理 — Module C）

- [x] **FILE-01**: react-complex-tree 文件树（懒加载、虚拟化、拖放）
- [x] **FILE-02**: 文件 CRUD 操作（创建、重命名、移动、复制、删除）
- [x] **FILE-03**: 文件搜索（按名称，300ms 防抖，最大 1000 结果）
- [x] **FILE-04**: 文件上传（multipart，单文件 100MB 上限，类型白名单）
- [x] **FILE-05**: 文件/目录下载（单文件直下、目录 zip 打包）
- [x] **FILE-06**: 剪贴板操作（复制/剪切/粘贴，跨目录）
- [x] **FILE-07**: 路径安全中间件（URL 解码 + NFC 正规化 + realpathSync）
- [x] **FILE-08**: ZIP bomb 检测（压缩比 > 100:1 拒绝）

### Code Editor（代码编辑器 — Module C 扩展）

- [x] **EDIT-01**: Monaco Editor 集成（路由级懒加载 ~800KB）
- [x] **EDIT-02**: 语言自动检测（根据文件扩展名）
- [x] **EDIT-03**: 自动保存（可配置延迟，默认 2s）
- [x] **EDIT-04**: 文件内容读写 API（GET/PUT /sessions/:id/file-content）
- [x] **EDIT-05**: 大文件保护（>1MB 切换为只读 Shiki 预览）
- [x] **EDIT-06**: 文件预览面板（代码高亮、图片、Markdown、PDF）

### Extensions（扩展系统 — Module D）

- [x] **EXT-01**: 插件系统 Blob URL 动态加载（import(blobUrl)）
- [x] **EXT-02**: 插件 ErrorBoundary 隔离（每个插件面板独立错误边界）
- [x] **EXT-03**: 运行时权限检查网关（PluginContext API 调用验证权限）
- [x] **EXT-04**: Skill 管理界面（已安装列表 + 搜索 + 安装/卸载）
- [x] **EXT-05**: skills.sh 集成（搜索 API + git sparse-checkout 安装）
- [x] **EXT-06**: Claude Plugin 管理（市场仓库浏览、安装、更新）
- [x] **EXT-07**: 统一 Skill 存储路径（~/.claude/skills/orchestration/）

### AI Workflow（AI 工作流 — Module E）

- [x] **AIWF-01**: 变更审查面板（按对话分组的文件变更列表 + diff 查看）
- [x] **AIWF-02**: 三态审查模型（pending/approved/rejected）
- [x] **AIWF-03**: 批量审查操作（全部批准需确认、全部拒绝需理由）
- [x] **AIWF-04**: 代理操作时间线（按类型过滤：文件/命令/权限/LLM 调用）
- [x] **AIWF-05**: 会话摘要（增量摘要 + 手动/自动触发）
- [x] **AIWF-06**: 撤销变更（Git 优先 + 文件快照兜底 + 会话/步骤/文件三粒度）
- [x] **AIWF-07**: 撤销预览 + 确认（显示影响文件列表，创建备份检查点）
- [x] **AIWF-08**: 移动端速览路由（/m/* 专用路由）
- [x] **AIWF-09**: 移动端变更审查（文件列表 + diff + swipe 操作）
- [x] **AIWF-10**: 移动端终端只读（最近 200 行输出）
- [x] **AIWF-11**: PWA 推送通知（Web Push API + 审批通知）
- [x] **AIWF-12**: 会话分享（只读快照 + 范围/时效控制 + 匿名访问）

### Agent Experience（代理体验 — Module F）

- [x] **AGXP-01**: 二进制帧传输（图片/截图 → 代理）
- [x] **AGXP-02**: 语音对话界面（浏览器麦克风 → Whisper API → 代理）
- [x] **AGXP-03**: Skill 编排系统（Loop、Handoff、Advisor、Committee、Epic）
- [x] **AGXP-04**: 简易白板工具（Canvas 绘图 → base64 → 代理）

### Context Management（上下文管理 — Module G）

- [x] **CTX-01**: 上下文用量进度条（正常/警告/临界三态）
- [x] **CTX-02**: 压缩事件通知（什么时候压缩、压缩了什么）
- [x] **CTX-03**: 手动触发压缩

### Security（安全）

- [x] **SEC-01**: PTY Socket.IO 认证（JWT + userId 归属校验）
- [x] **SEC-02**: 路径遍历防护（URL 解码 + NFC + realpathSync + startsWith）
- [x] **SEC-03**: 文件上传安全（大小/类型/ZIP bomb）
- [x] **SEC-04**: Git Clone SSRF 防护（URL 白名单）
- [x] **SEC-05**: 多用户数据隔离（session 归属校验）
- [x] **SEC-06**: 日志脱敏（密码遮蔽、凭据脱敏、JWT 不入日志）

### Performance（性能）

- [x] **PERF-01**: Monaco Editor 路由级懒加载（React.lazy + Suspense）
- [x] **PERF-02**: Mermaid.js 路由级懒加载
- [x] **PERF-03**: xterm.js 路由级懒加载
- [x] **PERF-04**: react-pdf 路由级懒加载

### Accessibility（可访问性）

- [x] **A11Y-01**: 焦点环颜色修正（对比度 ≥ 4.5:1）
- [x] **A11Y-02**: ARIA 属性基础覆盖（上下文菜单、标签栏、列表分组）
- [x] **A11Y-03**: 键盘导航支持（Tab 序列、快捷键）

## v0.2 Requirements — 体验优化版

> **v0.2 主题**: 全功能审计调优 + iOS PWA 深度优化 + 移动端体验 + i18n 中英双语

### iOS PWA 优化（PWA）

- **PWA-01**: iOS Safari manifest 完整配置（display: standalone、apple-mobile-web-app-capable、icons 全尺寸）
- **PWA-02**: 安全区域适配（viewport-fit=cover + env(safe-area-inset-*) + Tailwind 工具类）
- **PWA-03**: iOS 启动画面（apple-touch-startup-image 覆盖 iPhone SE/14/14 Pro/16 Pro/16 Pro Max，含暗/亮变体）
- **PWA-04**: 状态栏融合（black-translucent 沉浸式 + theme-color 动态切换暗/亮模式）
- **PWA-05**: iOS 推送通知集成（iOS 16.4+ Web Push API + Badge API + standalone 模式检测）
- **PWA-06**: 离线回退页面（Service Worker offline fallback page）
- **PWA-07**: Home Indicator 底部避让 + overscroll-behavior 控制

### 移动端 UX 增强（MOB）

- **MOB-01**: 终端触摸优化（虚拟键盘工具栏 + Ctrl/Esc/Tab 方向键 + 修饰键锁定）
- **MOB-02**: 分享密码保护（加密安全 token + 密码哈希 bcrypt）
- **MOB-03**: 分享访问次数限制（可配置上限 + 计数器 + 过期自动清理）
- **MOB-04**: 移动端 AI 聊天布局优化（语音输入按钮、消息气泡适配、快速操作栏）
- **MOB-05**: 移动端变更审查手势（swipe approve/reject + 紧凑 diff 视图）
- **MOB-06**: 响应式断点全面验证（320px / 375px / 768px / 1024px 四档覆盖所有模块）

### 国际化（I18N）

- **I18N-01**: 统一 i18n 架构（自研轻量方案提升到 shared/src/i18n/，废弃 website/ 的 react-i18next）
- **I18N-02**: 中文翻译完善（web/ 所有页面 100% 中文覆盖，补充遗漏的 key）
- **I18N-03**: 英文翻译（web/ 所有页面英文翻译，翻译完整性测试）
- **I18N-04**: 语言动态切换（运行时切换 + localStorage 持久化 + 浏览器语言检测）
- **I18N-05**: 日期/数字本地化（Intl API 格式化 + 相对时间 + 文件大小显示）

### 全功能审计调优（AUDIT）

- **AUDIT-01**: 全模块功能审计（9 模块 117+ 测试用例，启动 dev server 实际操作测试）
- **AUDIT-02**: 性能审计（Lighthouse LCP < 2.5s / INP < 200ms / CLS < 0.1 + Bundle 分析）
- **AUDIT-03**: 可访问性审计（axe-core 扫描 + 键盘导航 + 焦点管理 + 对比度检查）
- **AUDIT-04**: 移动端专项审计（触摸目标 ≥ 44px / 虚拟键盘适配 / 手势冲突检测）
- **AUDIT-05**: 安全审计（OWASP Top 10 检查 + 路径遍历测试 + XSS 测试矩阵）

### 设计打磨（DS2）

- **DS2-01**: 全页面视觉一致性检查（设计系统 token 遵从度 + 组件间距统一）
- **DS2-02**: 动画流畅度优化（transition 时效统一 + reduced-motion 支持 + compositor-only 属性）
- **DS2-03**: 暗/亮模式一致性验证（所有页面双模式视觉走查）

## v0.4 Requirements — PWA 深度优化版

> **v0.4 主题**: PWA 模式从底层到设计层面的深度优化，解决更新机制、安装引导、通知角标三大核心体验问题

### Service Worker 更新机制（SWU）

- **SWU-01**: 修复 registerType 配置矛盾（'autoUpdate' → 'prompt'，配合自定义更新提示 UI）
- **SWU-02**: sw.ts 添加 skipWaiting + clients.claim，确保新版本即时激活
- **SWU-03**: 自定义更新提示 UI（替代原生 confirm()，使用应用内 Toast/横幅组件）
- **SWU-04**: 更新提示展示版本号（结合 __APP_VERSION__）
- **SWU-05**: 客户端定期轮询 SW 更新（iOS 补偿：每 30 分钟 registration.update()）
- **SWU-06**: navigator.storage.persist() 持久化存储调用，防止缓存被系统清理

### PWA 安装引导增强（INST）

- **INST-01**: Safari 安装引导增加"稍后提醒"选项（关闭后 7 天再显示，而非永久关闭）
- **INST-02**: 安装引导时机优化（延迟到用户有会话后再提示，避免首次访问就弹出）
- **INST-03**: 安装引导 i18n 完善（iOS 分步引导文本全部使用 t() 翻译键）
- **INST-04**: Safari 中更醒目的安装提示（考虑顶部横幅替代底部浮动卡片）

### 通知与 Badge API（NTF）

- **NTF-01**: 实现 Badge API（navigator.setAppBadge / clearAppBadge），会话状态变更时更新角标
- **NTF-02**: 推送通知增加 actions 按钮（Open / Dismiss），提升通知交互性
- **NTF-03**: 推送通知权限请求时机优化（延迟到用户理解应用价值后再请求）
- **NTF-04**: iOS standalone 模式推送通知兼容性验证（iOS 16.4+ Web Push）

### Manifest 完善（MNF）

- **MNF-01**: theme-color 初始值与 manifest 一致（#0A0A0B 暗色 / #ffffff 亮色）
- **MNF-02**: 添加 screenshots 字段（至少 3 张：宽屏 + 窄屏 + 暗色）
- **MNF-03**: 添加 share_target 字段（支持接收文本/文件分享）
- **MNF-04**: 离线页面 offline.html i18n 化（根据浏览器语言显示中/英文）

## v0.3 Requirements（延后）

### Isolation（隔离增强）

- **ISO-01**: 插件 iframe sandbox 隔离方案
- **ISO-02**: 插件 Web Worker 隔离评估

### Scalability（扩展性）

- **SCAL-01**: PTY 会话跨 Hub 重启持久化
- **SCAL-02**: Git 操作委托独立 Worker 服务

## Out of Scope

| Feature | Reason |
|---------|--------|
| 实时协作编辑 | 非核心开发场景，复杂度高 |
| OAuth 第三方登录 | hapi 上游认证体系足够 |
| 视频通话/屏幕共享 | 超出开发工具台范围 |
| 原生桌面应用（Tauri/Electron） | 浏览器优先 |
| 离线模式 | 需要实时通信，离线无意义 |
| 多语言服务端 | TypeScript monorepo 统一 |
| 代码补全/IntelliSense | 代理负责代码生成，IDE 级补全非核心 |
| 完全可交互移动终端 | v0.2 仅优化只读终端体验，交互式终端延后 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01~06 | Phase 1 | Done |
| DS-01~04 | Phase 1 | Done |
| PERF-01~04 | Phase 1 | Done |
| SEC-01~06 | Phase 1 | Done |
| A11Y-01~03 | Phase 1 | Done |
| GIT-01~08 | Phase 2 | Done |
| PTY-01~08 | Phase 3 | Done |
| FILE-01~08 | Phase 4 | Done |
| EDIT-01~06 | Phase 4 | Done |
| EXT-01~07 | Phase 5 | Done |
| AIWF-01~07 | Phase 6 | Done |
| AIWF-08~12 | Phase 7 | Done |
| AGXP-01~04 | Phase 8 | Done |
| CTX-01~03 | Phase 6 | Done |

**Coverage:**
- v0.1 requirements: 60 total → 60 Done ✓
- v0.2 requirements: 26 total (PWA:7 + MOB:6 + I18N:5 + AUDIT:5 + DS2:3)
- v0.4 requirements: 18 total (SWU:6 + INST:4 + NTF:4 + MNF:4)
- v0.3 deferred: ISO-01~02 + SCAL-01~02

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-31 — v0.4 requirements added*
