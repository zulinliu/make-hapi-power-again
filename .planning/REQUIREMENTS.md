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

## v0.2 Requirements（延后）

### Isolation（隔离增强）

- **ISO-01**: 插件 iframe sandbox 隔离方案
- **ISO-02**: 插件 Web Worker 隔离评估

### Mobile（移动端增强）

- **MOB-01**: 终端触摸优化（专用工具栏、手势系统）
- **MOB-02**: 分享密码保护
- **MOB-03**: 分享访问次数限制

### Scalability（扩展性）

- **SCAL-01**: PTY 会话跨 Hub 重启持久化
- **SCAL-02**: Git 操作委托独立 Worker 服务
- **SCAL-03**: i18n 完整实现（当前仅架构预留）

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
- v0.1 requirements: 60 total
- Mapped to phases: 60
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-30 after v0.1 release*
