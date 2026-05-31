# Hapi Power v0.2 全功能审计方法论

**定义日期**: 2026-05-30
**适用版本**: v0.1 功能全量审计，为 v0.2 质量调优提供基线
**项目规模**: Web 53,734 行 + Hub 25,153 行 + CLI + Shared，9 个功能模块，60 个需求项

---

## 1. 审计总览

### 1.1 审计目标

对 Hapi Power v0.1 已完成的全部功能进行系统化审计，产出：

1. 每个模块的功能完整性报告（正常流 + 边界 + 错误处理）
2. UI/UX 质量量化评分（Lighthouse + axe + 主观评估）
3. 前端性能基线数据（Core Web Vitals + Bundle 分析）
4. 安全漏洞扫描结果（OWASP Top 10 + 路径遍历 + XSS）
5. 移动端专项评估
6. 分级问题清单和修复优先级

### 1.2 审计范围

| 模块 | 代码位置 | 需求项 | 前端路由 | 后端路由 |
|------|---------|--------|---------|---------|
| Module A: Git 管理 | web/src/components/git/, hub/src/git/ | GIT-01~08 | /sessions/:id/git | git.ts |
| Module B: PTY 终端 | web/src/components/Terminal/, hub/src/socket/handlers/ | PTY-01~08 | /sessions/:id/terminal | socket/pty |
| Module C: 文件管理 | web/src/components/SessionFiles/, web/src/components/Editor/ | FILE-01~08, EDIT-01~06 | /sessions/:id/files, /sessions/:id/file | (hub/web/routes 内) |
| Module D: 扩展系统 | web/src/routes/sessions/extensions.tsx | EXT-01~07 | /sessions/:id/extensions | plugins.ts, skillManagement.ts |
| Module E: AI 工作流 | web/src/routes/sessions/changes.tsx, timeline.tsx, undo.tsx | AIWF-01~12 | changes, timeline, undo | changeTracking.ts, timeline.ts, undo.ts, share.ts |
| Module F: 代理体验 | web/src/components/VoiceRecorder.tsx, Whiteboard.tsx | AGXP-01~04 | orchestration.tsx | voice.ts, voiceTranscription.ts, orchestration.ts |
| Module G: 上下文管理 | web/src/chat/ (内嵌组件) | CTX-01~03 | (聊天面板内) | — |
| 移动端 | web/src/routes/mobile/ | AIWF-08~10 | /m/* | — |
| 跨模块 | web/src/components/Sidebar.tsx, hub/src/middleware/ | ARCH, DS, PERF, SEC, A11Y | 全局 | middleware/ |

### 1.3 审计阶段和时间估算

| 阶段 | 内容 | 预估时间 | 执行者 |
|------|------|---------|--------|
| A0: 准备 | 环境搭建、工具安装、基线脚本 | 0.5 天 | 开发者 |
| A1: 功能审计 | 9 个模块逐一测试 | 3-4 天 | 人工 + 自动化 |
| A2: UI/UX 审计 | 视觉、交互、可访问性 | 1-2 天 | 人工 + Lighthouse |
| A3: 性能审计 | CWV + Bundle + 内存 | 1 天 | 自动化 + 人工分析 |
| A4: 安全审计 | OWASP + 路径遍历 + XSS | 1-2 天 | 自动化扫描 + 人工验证 |
| A5: 移动端审计 | 触摸、手势、布局 | 1 天 | 设备测试 |
| A6: 汇总分级 | 问题分类、优先级排序、报告 | 0.5 天 | 开发者 |
| **总计** | | **8-11 天** | |

---

## 2. 功能审计方法论

### 2.1 审计矩阵模板

每个模块使用以下三维度矩阵进行测试：

| 测试类型 | 定义 | 占比 | 通过标准 |
|---------|------|------|---------|
| **正常流（Happy Path）** | 用户按预期路径使用功能 | 40% | 全部通过，无 JS 报错 |
| **边界情况（Edge Cases）** | 极端输入、大数据量、并发操作 | 35% | 优雅降级，无崩溃 |
| **错误处理（Error Handling）** | 网络断开、权限不足、无效输入 | 25% | 有明确错误提示，可恢复 |

### 2.2 Module A: Git 管理

#### 正常流测试

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| GIT-HP-01 | 打开 Git 状态面板 | 显示当前分支名、暂存区文件、未跟踪文件列表 |
| GIT-HP-02 | 浏览提交历史 | 分页加载提交记录，每条显示 hash/message/time |
| GIT-HP-03 | 查看单次提交 diff | 统一模式/并排模式切换正常，语法高亮正确 |
| GIT-HP-04 | 创建新分支 | 输入名称后切换成功，状态面板刷新 |
| GIT-HP-05 | 切换分支 | 工作区文件更新，未提交变更提示保留/丢弃 |
| GIT-HP-06 | 合并分支 | 冲突时显示冲突标记，无冲突自动合并 |
| GIT-HP-07 | 删除分支 | 非当前分支可删除，确认对话框出现 |
| GIT-HP-08 | 查看文件级 diff | 增/删/改行着色正确，行号对齐 |
| GIT-HP-09 | Git 凭证配置 | 添加凭证后 clone/push 可用 |

#### 边界情况

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| GIT-EC-01 | 空仓库（无提交历史） | 状态面板显示"初始提交"引导，历史为空 |
| GIT-EC-02 | 大型仓库（>10,000 提交） | 分页加载，不阻塞 UI |
| GIT-EC-03 | 超长 commit message | 不溢出容器，tooltip 显示全文 |
| GIT-EC-04 | 非 UTF-8 文件名 | 正确显示，操作不报错 |
| GIT-EC-05 | 二进制文件 diff | 显示"二进制文件"提示，不尝试文本 diff |
| GIT-EC-06 | 同时多个 Git 操作 | 操作排队或加锁，不产生竞态 |

#### 错误处理

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| GIT-ER-01 | Clone 使用 file:// 协议 | 拒绝并显示安全提示 |
| GIT-ER-02 | 无权限访问远程仓库 | 显示认证错误，引导配置凭证 |
| GIT-ER-03 | 磁盘空间不足 | 操作失败有明确错误提示 |
| GIT-ER-04 | 网络中断期间 clone | 进度暂停或失败，重试机制 |
| GIT-ER-05 | 合并冲突 | 冲突文件标记，手动解决入口 |

### 2.3 Module B: PTY 终端

#### 正常流测试

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| PTY-HP-01 | 创建新终端会话 | xterm.js 渲染，shell 提示符出现 |
| PTY-HP-02 | 终端输入命令 | 输入 `ls`、`pwd`、`echo` 等基本命令正常回显 |
| PTY-HP-03 | 终端自适应尺寸 | 拖动窗口/分屏时终端自动调整行列数 |
| PTY-HP-04 | 水平分屏 | 两个终端左右排列，独立运行 |
| PTY-HP-05 | 垂直分屏 | 两个终端上下排列，独立运行 |
| PTY-HP-06 | 调整分屏大小 | 拖动分隔条，两边终端同步调整 |
| PTY-HP-07 | 关闭终端会话 | 确认对话框（若有运行中进程），销毁 PTY 进程 |
| PTY-HP-08 | 二进制帧传输 | 粘贴图片通过 Socket.IO binary event 发送 |

#### 边界情况

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| PTY-EC-01 | 创建 256+ 终端 | 达到上限后拒绝并提示 |
| PTY-EC-02 | 长时间运行的进程 | `top`、`tail -f` 持续输出，不卡顿 |
| PTY-EC-03 | 大量输出（`cat /dev/urandom`） | 输出限流/缓冲，不阻塞 UI |
| PTY-EC-04 | 特殊字符输出（ANSI escape） | 颜色/光标控制正确渲染 |
| PTY-EC-05 | 中文/Unicode 输入输出 | 多字节字符正确显示 |
| PTY-EC-06 | / 作为工作目录 | 拒绝并使用 fallback 路径 |

#### 错误处理

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| PTY-ER-01 | 未认证连接 /pty 命名空间 | Socket.IO 拒绝连接 |
| PTY-ER-02 | PTY 内存超过 512MB | 自动终止进程，通知用户 |
| PTY-ER-03 | PTY CPU 超过 3600s | 自动终止，通知用户 |
| PTY-ER-04 | Hub 重启后终端状态 | 通知断开，提供重连入口 |
| PTY-ER-05 | 网络中断 | 终端显示断开标记，重连后恢复 |

### 2.4 Module C: 文件管理 + Monaco Editor

#### 正常流测试

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| FILE-HP-01 | 浏览文件树 | 懒加载展开目录，文件图标正确 |
| FILE-HP-02 | 创建新文件/目录 | 右键菜单 → 创建，输入名称，树刷新 |
| FILE-HP-03 | 重命名文件 | 内联编辑模式，回车确认，ESC 取消 |
| FILE-HP-04 | 拖放移动文件 | 拖到目标目录释放，文件移动成功 |
| FILE-HP-05 | 复制/剪切/粘贴 | 快捷键或菜单操作，跨目录粘贴 |
| FILE-HP-06 | 文件搜索 | 输入关键词，300ms 防抖，结果高亮 |
| FILE-HP-07 | 上传文件 | multipart 上传，进度条显示 |
| FILE-HP-08 | 下载文件/目录 | 单文件直下，目录 zip 打包 |
| FILE-HP-09 | 打开文件编辑 | Monaco 加载，语言检测正确，内容显示 |
| FILE-HP-10 | 编辑并自动保存 | 修改内容，2s 后自动保存 |
| FILE-HP-11 | 大文件预览 | >1MB 文件切换为只读 Shiki 高亮 |

#### 边界情况

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| FILE-EC-01 | 空目录 | 文件树显示"空目录"占位 |
| FILE-EC-02 | 深层嵌套目录（>20 层） | 懒加载不卡顿 |
| FILE-EC-03 | 文件名含特殊字符 | 空格、中文、emoji 正确处理 |
| FILE-EC-04 | 同名文件冲突 | 提示覆盖/跳过/重命名 |
| FILE-EC-05 | 上传 100MB 文件 | 进度条完整显示，不超时 |
| FILE-EC-06 | 搜索返回 >1000 结果 | 截断并提示结果过多 |
| FILE-EC-07 | 打开超大文件（>5MB） | 只读模式，不尝试 Monaco 加载 |
| FILE-EC-08 | 二进制文件预览 | 显示文件信息，不尝试文本渲染 |

#### 错误处理

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| FILE-ER-01 | 路径遍历攻击（../../../） | 中间件拦截，返回 403 |
| FILE-ER-02 | 符号链接逃逸 | realpathSync 解析后校验 |
| FILE-ER-03 | URL 编码绕过（双重编码） | URL 解码后校验 |
| FILE-ER-04 | ZIP bomb 上传 | 压缩比 >100:1 拒绝 |
| FILE-ER-05 | 文件类型不在白名单 | 拒绝并提示允许的类型 |
| FILE-ER-06 | 网络中断保存失败 | 显示错误提示，保留本地修改 |
| FILE-ER-07 | 并发编辑冲突 | 乐观锁或版本检查 |

### 2.5 Module D: 扩展系统

#### 正常流测试

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| EXT-HP-01 | 安装插件 | Blob URL 加载，面板渲染 |
| EXT-HP-02 | 卸载插件 | 清理 Blob URL，面板移除 |
| EXT-HP-03 | 插件 API 调用 | 声明的权限 API 可正常调用 |
| EXT-HP-04 | 插件崩溃隔离 | 插件报错不影响主界面，ErrorBoundary 显示错误 |
| EXT-HP-05 | 搜索 Skill | skills.sh API 搜索结果展示 |
| EXT-HP-06 | 安装 Skill | git sparse-checkout 下载，列表更新 |
| EXT-HP-07 | 浏览 Claude Plugin 市场 | 仓库列表、详情、版本信息 |

#### 边界情况

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| EXT-EC-01 | 插件代码含恶意调用 | 权限网关拦截未声明 API |
| EXT-EC-02 | 插件加载超时 | 超时提示，不阻塞 |
| EXT-EC-03 | 大量插件同时激活 | 不造成内存溢出 |
| EXT-EC-04 | Skill 安装中断 | 网络恢复后可重试 |

#### 错误处理

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| EXT-ER-01 | 无效 Blob URL | 加载失败有提示 |
| EXT-ER-02 | skills.sh API 不可用 | 降级提示，本地缓存可用 |
| EXT-ER-03 | 权限不足调用 | 拒绝并提示需要哪些权限 |

### 2.6 Module E: AI 工作流

#### 正常流测试

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| AIWF-HP-01 | 变更审查列表 | 按对话分组，文件变更列表显示 |
| AIWF-HP-02 | 逐文件审查 | approve/reject 三态徽章切换 |
| AIWF-HP-03 | 批量审查 | 全部批准需确认，全部拒绝需理由 |
| AIWF-HP-04 | Diff 查看变更 | 复用 DiffView，增删改行着色 |
| AIWF-HP-05 | 操作时间线 | 按类型过滤（文件/命令/权限/LLM） |
| AIWF-HP-06 | 生成会话摘要 | 自动/手动触发，增量更新 |
| AIWF-HP-07 | 撤销预览 | 显示影响文件列表 |
| AIWF-HP-08 | 执行撤销（三粒度） | 会话/步骤/文件粒度正确回滚 |
| AIWF-HP-09 | 会话分享 | 生成链接，匿名可访问，范围/时效控制 |
| AIWF-HP-10 | 移动端变更审查 | swipe approve/reject |

#### 边界情况

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| AIWF-EC-01 | 无变更记录 | 空状态占位 |
| AIWF-EC-02 | 撤销大量文件 | 预览列表可滚动，不卡顿 |
| AIWF-EC-03 | 分享链接过期 | 访问提示已过期 |
| AIWF-EC-04 | 移动端横屏 | 布局适配 |
| AIWF-EC-05 | 摘要内容超长 | 折叠/展开机制 |

#### 错误处理

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| AIWF-ER-01 | Git 回滚失败 | 文件快照兜底，提示降级方案 |
| AIWF-ER-02 | 分享创建失败 | 错误提示，可重试 |
| AIWF-ER-03 | 时间线数据加载失败 | 降级显示已有数据 |

### 2.7 Module F: 代理体验

#### 正常流测试

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| AGXP-HP-01 | 图片粘贴到聊天 | 通过 Socket.IO binary event 发送给代理 |
| AGXP-HP-02 | 拖拽图片上传 | 预览 + 发送 |
| AGXP-HP-03 | 语音录音 | 麦克风权限请求，录音进度指示 |
| AGXP-HP-04 | 语音转文字 | Whisper API 返回文本，自动发送 |
| AGXP-HP-05 | Skill 编排管理 | Loop/Handoff/Advisor/Committee/Epic 可安装 |
| AGXP-HP-06 | 白板绘图 | Canvas 绘图工具，base64 导出发送 |

#### 边界情况

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| AGXP-EC-01 | 大图片上传（>10MB） | 压缩或提示 |
| AGXP-EC-02 | 语音长录音（>5min） | 分段处理或限制 |
| AGXP-EC-03 | 白板复杂绘图 | 不卡顿 |

#### 错误处理

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| AGXP-ER-01 | 麦克风权限被拒 | 提示开启权限 |
| AGXP-ER-02 | Whisper API 不可用 | 降级提示，建议手动输入 |
| AGXP-ER-03 | Canvas API 不可用 | 白板功能隐藏 |

### 2.8 Module G: 上下文管理

#### 正常流测试

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| CTX-HP-01 | 上下文进度条 | 正常/警告/临界三态颜色正确 |
| CTX-HP-02 | 压缩通知 | 显示何时压缩、压缩了什么 |
| CTX-HP-03 | 手动触发压缩 | 按钮触发，进度指示 |

#### 边界/错误

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| CTX-EC-01 | 上下文已满 | 红色警告，强制压缩提示 |
| CTX-ER-01 | 压缩失败 | 错误提示，不丢失数据 |

### 2.9 跨模块测试

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| CROSS-01 | EventBus 事件传播 | 文件变更 → Git 状态更新 |
| CROSS-02 | 侧边栏导航 | 所有模块入口可点击跳转 |
| CROSS-03 | 模块间数据同步 | 文件编辑 → 变更审查记录 |
| CROSS-04 | 路由级懒加载 | Monaco/Mermaid/xterm 首次加载不阻塞 |
| CROSS-05 | ApiResponse<T> 统一格式 | 所有 API 返回 { success, error?, data? } |
| CROSS-06 | 暗色模式一致性 | 所有页面/组件颜色协调 |
| CROSS-07 | 亮色模式一致性 | 如果支持亮色模式 |

---

## 3. UI/UX 审计维度

### 3.1 Lighthouse 审计

在每个主要路由页面运行 Lighthouse，目标分数：

| 页面 | Performance | Accessibility | Best Practices | SEO |
|------|------------|---------------|----------------|-----|
| / (首页/会话列表) | >= 80 | >= 90 | >= 90 | >= 80 |
| /sessions/:id (聊天) | >= 70 | >= 90 | >= 90 | N/A |
| /sessions/:id/git | >= 75 | >= 90 | >= 90 | N/A |
| /sessions/:id/terminal | >= 75 | >= 85 | >= 90 | N/A |
| /sessions/:id/files | >= 75 | >= 90 | >= 90 | N/A |
| /sessions/:id/extensions | >= 75 | >= 90 | >= 90 | N/A |
| /sessions/:id/changes | >= 75 | >= 90 | >= 90 | N/A |
| /sessions/:id/timeline | >= 75 | >= 90 | >= 90 | N/A |
| /sessions/:id/undo | >= 75 | >= 90 | >= 90 | N/A |
| /m/* (移动端) | >= 70 | >= 90 | >= 90 | >= 70 |
| /share/:id (分享页) | >= 80 | >= 90 | >= 90 | >= 80 |

**执行命令:**
```bash
# 使用 Chrome DevTools MCP 的 lighthouse_audit 工具
# 或命令行:
npx lighthouse https://test.liuzl.asia --output json --output html --output-path ./audit-results/lighthouse/
```

### 3.2 可访问性（Accessibility）审计

#### axe-core 自动化扫描

```bash
# 使用 @axe-core/playwright
npx playwright test --project=accessibility
```

检查项：

| 检查维度 | 工具 | 通过标准 |
|---------|------|---------|
| WCAG 2.1 AA 对比度 | axe-core | 所有文本 >= 4.5:1，大文本 >= 3:1 |
| 焦点环可见性 | 人工 + axe | 所有交互元素有可见焦点环 |
| 键盘导航 | 人工 | Tab 序列合理，无焦点陷阱 |
| ARIA 属性 | axe-core | 无 ARIA 角色误用 |
| 图片 alt 文本 | axe-core | 所有有意义图片有 alt |
| 表单标签 | axe-core | 所有 input 有关联 label |
| 标题层级 | axe-core | h1~h6 层级不跳级 |
| 颜色对比度（暗色模式） | axe-core + 人工 | 暗色模式下对比度仍满足 |
| 屏幕阅读器 | 手动（VoiceOver/NVDA） | 关键流程可完成 |

#### 键盘导航专项

| 页面 | 测试场景 |
|------|---------|
| 侧边栏 | Tab 到各导航项，Enter 激活 |
| 聊天 | Tab 在输入框/发送按钮/消息间切换 |
| 文件树 | 上下箭头浏览，Enter 打开 |
| Monaco Editor | Tab 进入编辑区，Esc 退出 |
| 终端 | Tab 进入终端，Ctrl+C 中断 |
| 对话框 | Tab 在按钮间循环，Esc 关闭 |
| 下拉菜单 | 上下箭头选择，Enter 确认 |

### 3.3 视觉一致性审计

| 检查项 | 验证方法 | 通过标准 |
|--------|---------|---------|
| 设计令牌统一 | 抽查 CSS 变量使用 | Canvas #0A0A0B 背景，5 色语义系统 |
| 字体一致性 | 浏览器 DevTools | Inter Variable，无 fallback 到系统字体 |
| 间距节奏 | 像素对比 | 符合 Tailwind 间距体系 |
| 圆角统一 | 视觉检查 | 一致的 rounded 值 |
| 阴影层级 | 视觉检查 | 3 层阴影体系（sm/md/lg） |
| 过渡动画 | 60fps 录屏 | 过渡 >= 150ms，<= 300ms |
| 加载状态 | 慢速网络测试 | 所有异步操作有 loading 指示 |
| 空状态 | 功能测试 | 所有列表/面板有空状态占位 |
| 错误状态 | 模拟错误 | 有友好错误提示 |
| 暗色/亮色模式 | 切换测试 | 全部页面两模式都正确 |

### 3.4 交互反馈审计

| 交互类型 | 检查项 |
|---------|--------|
| 按钮点击 | 有 hover/active/focus/disabled 四态 |
| 链接 | 有 hover 下划线/颜色变化 |
| 输入框 | 有 focus 边框，错误状态红色边框 |
| 拖放 | 有拖动中的视觉反馈（ghost/高亮目标） |
| 异步操作 | 有 loading spinner/skeleton |
| Toast 通知 | 成功/失败/警告 三种样式 |
| 模态框 | 背景遮罩，ESC 关闭，点击外部关闭 |
| 右键菜单 | 正确位置弹出，点击外部关闭 |

---

## 4. 前端性能审计

### 4.1 Core Web Vitals 基线

| 指标 | 定义 | 目标 | 测量工具 |
|------|------|------|---------|
| LCP (Largest Contentful Paint) | 最大内容渲染时间 | < 2.5s | Lighthouse + web-vitals |
| INP (Interaction to Next Paint) | 交互延迟 | < 200ms | Lighthouse + web-vitals |
| CLS (Cumulative Layout Shift) | 累积布局偏移 | < 0.1 | Lighthouse + web-vitals |
| FCP (First Contentful Paint) | 首次内容渲染 | < 1.5s | Lighthouse |
| TBT (Total Blocking Time) | 总阻塞时间 | < 200ms | Lighthouse |

**测量方式:**
```bash
# 1. Lighthouse CI
npx lighthouse https://test.liuzl.asia --preset=desktop --output=json

# 2. Chrome DevTools Performance tab 手动录制

# 3. web-vitals 库内嵌（生产环境 RUM）
# 在 web/src/main.tsx 中注入：
# import { onLCP, onINP, onCLS } from 'web-vitals';
# onLCP(console.log); onINP(console.log); onCLS(console.log);
```

### 4.2 Bundle 分析

```bash
# Vite 构建分析
cd web && npx vite-bundle-visualizer

# 或使用 rollup-plugin-visualizer
npx vite build --mode analyze
```

**Bundle 预算（单页加载）:**

| 依赖类型 | gzipped 预算 | 实际测量 | 状态 |
|---------|-------------|---------|------|
| 总 JS（首屏） | < 200KB | _待测_ | — |
| 总 CSS | < 50KB | _待测_ | — |
| Monaco Editor（懒加载） | < 800KB | _待测_ | — |
| xterm.js（懒加载） | < 300KB | _待测_ | — |
| Mermaid（懒加载） | < 1MB | _待测_ | — |

### 4.3 懒加载验证

| 组件 | 加载方式 | 验证方法 |
|------|---------|---------|
| Monaco Editor | React.lazy + Suspense | Network tab 确认按需加载 |
| xterm.js | React.lazy + Suspense | 同上 |
| Mermaid.js | React.lazy + Suspense | 同上 |
| react-pdf | React.lazy + Suspense | 同上 |
| 语音组件 | 条件渲染 | 非聊天页不加载 |

### 4.4 内存泄漏检测

| 场景 | 检测方法 | 预期 |
|------|---------|------|
| 反复打开/关闭终端 | Chrome DevTools Memory → Heap Snapshot | 每次 close 后内存回收 |
| 反复打开/关闭文件 | 同上 | 同上 |
| 长时间聊天（>500条消息） | Performance Monitor | 不持续增长 |
| Socket.IO 重连 | 断网→恢复，观察内存 | 不累积监听器 |
| 插件加载/卸载循环 | Blob URL revoke 验证 | URL 被释放 |

### 4.5 网络性能

| 检查项 | 目标 | 工具 |
|--------|------|------|
| API 响应时间 P50 | < 200ms | Chrome Network tab |
| API 响应时间 P99 | < 2s | 同上 |
| Socket.IO 消息延迟 | < 100ms | 自定义埋点 |
| 资源缓存命中率 | > 80% | Network tab + Service Worker |
| Gzip/Brotli 压缩 | 全部文本资源 | Response Headers |

---

## 5. 移动端专项审计

### 5.1 触摸目标

| 检查项 | WCAG 标准 | 验证方法 |
|--------|----------|---------|
| 按钮最小尺寸 | >= 44x44px | DevTools 设备模拟 + 实机 |
| 链接间距 | >= 8px | 同上 |
| 手势不冲突 | — | 滑动/swipe 不触发浏览器导航 |
| 触摸反馈 | — | 按下有视觉反馈 |

### 5.2 虚拟键盘适配

| 场景 | 验证点 |
|------|--------|
| 聊天输入框聚焦 | 页面滚动使输入框可见 |
| 搜索框聚焦 | 搜索结果不被键盘遮挡 |
| 终端只读模式 | 虚拟键盘不弹出 |
| 模态框内输入 | 模态框随键盘上推 |

### 5.3 移动端布局

| 断点 | 检查项 |
|------|--------|
| 320px (iPhone SE) | 无水平溢出，内容可读 |
| 375px (iPhone 标准版) | 主功能可用 |
| 390px (iPhone 14/15) | 布局舒适 |
| 414px (iPhone Plus) | 充分利用宽度 |
| 768px (iPad Mini) | 可展示侧边栏 |

### 5.4 PWA 审计

| 检查项 | 验证方法 |
|--------|---------|
| manifest.json 存在且正确 | Lighthouse PWA 审计 |
| Service Worker 注册 | DevTools Application tab |
| 离线 fallback 页面 | DevTools Offline 模拟 |
| 推送通知权限请求 | 实际触发 |
| Add to Home Screen | Lighthouse 检查 |

---

## 6. 安全审计

### 6.1 OWASP Top 10 检查清单（2025）

| # | 风险 | 检查项 | Hapi Power 相关点 | 工具 |
|---|------|--------|-------------------|------|
| A01 | 权限控制失效 | session 归属校验、越权访问测试 | SEC-05: session 归属 | Burp Suite / 手动 |
| A02 | 加密失败 | TLS 配置、凭证存储 | Git 凭证 AES-256-GCM | 代码审查 |
| A03 | 注入 | SQL 注入（SQLite）、命令注入 | PTY 命令执行、文件路径 | sqlmap / 手动 |
| A04 | 不安全设计 | 认证绕过、权限模型 | JWT 认证、权限网关 | 手动 + 自动 |
| A05 | 安全配置错误 | CORS、调试端点、默认凭据 | Hub 服务器配置 | SSLyze / 手动 |
| A06 | 脆弱过时组件 | 依赖漏洞 | npm audit / bun audit | `bun audit` |
| A07 | 认证失败 | JWT 强度、会话管理 | Socket.IO JWT 认证 | JWT_tool |
| A08 | 数据完整性失败 | 反序列化、CI/CD 安全 | 插件 Blob URL 加载 | 代码审查 |
| A09 | 日志监控不足 | 敏感数据入日志 | SEC-06: 日志脱敏 | 代码审查 |
| A10 | SSRF | 服务器端请求伪造 | SEC-04: Clone URL 白名单 | Burp Suite |

### 6.2 路径遍历专项

| 攻击向量 | 测试用例 | 预期结果 |
|---------|---------|---------|
| 基本遍历 | `../../../etc/passwd` | 403 Forbidden |
| URL 编码 | `%2e%2e%2f%2e%2e%2f` | 403 |
| 双重 URL 编码 | `%252e%252e%252f` | 403 |
| Unicode 编码 | `..%c0%af` | 403 |
| Null byte | `file.txt%00.jpg` | 拒绝 |
| 符号链接 | 创建指向 /etc 的软链接 | realpathSync 解析后拒绝 |
| 多重点号 | `....//....//` | 403 |
| 反斜杠（Windows 兼容） | `..\..\` | 403 |

### 6.3 XSS 专项

| 攻击向量 | 测试位置 | 预期结果 |
|---------|---------|---------|
| 存储型 XSS | 聊天消息、文件名 | 内容转义 |
| 反射型 XSS | URL 参数、搜索框 | 输入净化 |
| DOM 型 XSS | 动态内容渲染 | React 自动转义 + 额外检查 |
| Markdown XSS | Markdown 渲染器 | remark-gfm 安全配置 |

### 6.4 自动化安全扫描

```bash
# 依赖漏洞扫描
cd /home/liuzl/agent/make-hapi-power-again/make-hapi-power-again
bun audit

# HTTP 安全头检查（通过 curl）
curl -sI https://test.liuzl.asia | grep -E "Strict-Transport|X-Content-Type|X-Frame|Content-Security|Referrer-Policy"

# Socket.IO 认证测试
# 未携带 JWT 尝试连接 /pty 命名空间

# 文件上传安全测试
# 上传 .exe、.php、.sh 文件
# 上传超过 100MB 文件
# 上传 ZIP bomb（压缩比 > 100:1）
```

### 6.5 认证/授权测试矩阵

| 测试场景 | 操作 | 预期结果 |
|---------|------|---------|
| 未认证访问 API | 不带 JWT 请求 /api/sessions | 401 |
| 过期 JWT | 使用过期 token | 401 |
| 伪造 JWT | 篡改 payload | 401 |
| 越权访问 | 用 A 的 token 访问 B 的 session | 403 |
| 未认证 Socket.IO | 无 token 连接 /pty | 连接被拒 |

---

## 7. 问题分级和修复优先级

### 7.1 严重级别定义

| 级别 | 定义 | 示例 | 修复时限 |
|------|------|------|---------|
| **P0 - Critical** | 安全漏洞、数据丢失风险、核心功能不可用 | 路径遍历成功、XSS 可利用、PTY 无限制 | 立即（24h 内） |
| **P1 - High** | 重要功能异常、性能严重劣化、用户体验阻断 | Git 操作失败、终端无法创建、LCP > 5s | 3 天内 |
| **P2 - Medium** | 功能不完整、UI 不一致、体验不佳 | 搜索结果截断无提示、动画卡顿、对比度不足 | 1 周内 |
| **P3 - Low** | 视觉细节、文案优化、代码质量 | 间距不统一、loading 文案不友好、冗余代码 | 排期处理 |

### 7.2 修复优先级矩阵

```
影响范围 ↑
         │  P1         P0
  全局   │  (High+广)   (Critical+广)
         │
  模块   │  P2         P1
         │  (Med+模块)  (High+模块)
         │
  局部   │  P3         P2
         │  (Low+局部)  (Med+局部)
         └────────────────────→ 严重程度
```

### 7.3 问题跟踪模板

```markdown
| ID | 模块 | 严重级别 | 类型 | 描述 | 复现步骤 | 负责人 | 状态 |
|----|------|---------|------|------|---------|--------|------|
| AUD-001 | Git | P1 | 功能 | 历史记录无法加载超过1000条 | 1. 打开大型仓库 2. 滚动到分页处 | — | Open |
```

---

## 8. 工具推荐

### 8.1 自动化审计工具

| 工具 | 用途 | 安装/使用 | 集成方式 |
|------|------|---------|---------|
| **Lighthouse** | Performance + A11y + BP + SEO | `npx lighthouse URL` | Chrome DevTools MCP / CI |
| **axe-core** | 可访问性自动化 | `@axe-core/playwright` | Playwright 测试 |
| **Playwright** | E2E 自动化测试 | 已安装 (v1.49.1) | `bunx playwright test` |
| **Vitest** | 单元/集成测试 | 已配置 | `bun run test:web` |
| **Chrome DevTools Protocol** | 性能分析、内存快照 | 通过 MCP 集成 | Chrome DevTools MCP |
| **bun audit** | 依赖漏洞扫描 | 内置 | `bun audit` |

### 8.2 手动审计工具

| 工具 | 用途 |
|------|------|
| **Chrome DevTools** | Network、Performance、Memory、Elements |
| **React DevTools** | 组件树、Props/State、Re-render 追踪 |
| ** axe DevTools (浏览器扩展)** | 页面级可访问性扫描 |
| **Colour Contrast Analyser** | 精确对比度测量 |
| **VoiceOver / NVDA** | 屏幕阅读器测试 |

### 8.3 推荐新增工具

| 工具 | 用途 | 安装命令 |
|------|------|---------|
| **vite-bundle-visualizer** | Bundle 分析可视化 | `bun add -d vite-bundle-visualizer` |
| **@axe-core/playwright** | Playwright 集成 axe 扫描 | `bun add -d @axe-core/playwright` |
| **web-vitals** | 生产环境 RUM 数据采集 | `bun add web-vitals` |
| **Playwright screenshots** | 视觉回归基线 | 已有 Playwright，无需额外安装 |

---

## 9. 审计执行工作流

### 9.1 审计流程

```
Phase A0: 准备
  ├── 安装审计工具（axe-core/playwright, vite-bundle-visualizer）
  ├── 启动 dev server（端口 3210）
  ├── 运行全量构建验证（bun run build）
  └── 运行全量测试（bun run test）

Phase A1: 功能审计（每个模块）
  ├── 执行正常流测试矩阵
  ├── 执行边界情况测试矩阵
  ├── 执行错误处理测试矩阵
  ├── 记录发现的问题到问题表
  └── 截图/录屏关键问题

Phase A2: UI/UX 审计
  ├── 每个页面运行 Lighthouse
  ├── 每个页面运行 axe-core 扫描
  ├── 键盘导航逐页测试
  ├── 暗色/亮色模式切换检查
  └── 视觉一致性人工检查

Phase A3: 性能审计
  ├── Core Web Vitals 测量
  ├── Bundle 分析
  ├── 懒加载验证
  ├── 内存泄漏检测
  └── 网络性能分析

Phase A4: 安全审计
  ├── OWASP Top 10 逐项检查
  ├── 路径遍历专项测试
  ├── XSS 专项测试
  ├── 认证/授权测试矩阵
  └── 依赖漏洞扫描

Phase A5: 移动端审计
  ├── 多设备测试（320/375/390/414/768px）
  ├── 触摸目标检查
  ├── 虚拟键盘适配
  └── PWA 功能验证

Phase A6: 汇总分级
  ├── 所有问题归类到 P0~P3
  ├── 修复优先级排序
  ├── 生成审计报告
  └── 输出到 .planning/research/AUDIT-RESULTS.md
```

### 9.2 每日审计节奏

```
09:00 - 10:30  自动化扫描（Lighthouse + axe + 依赖扫描）
10:30 - 12:00  功能审计（2-3 个模块）
14:00 - 15:30  功能审计（续）
15:30 - 16:30  UI/UX 人工检查
16:30 - 17:00  记录问题、更新问题表
17:00 - 17:30  回顾当天发现，调整次日计划
```

### 9.3 修复工作流

```
发现问题 → 记录到问题表
         → 分级（P0~P3）
         → P0/P1: 立即创建修复分支
         → P2/P3: 排入 v0.2 待办
         → 修复后回归测试
         → 关闭问题
```

---

## 10. 每模块预估审计时间

| 模块 | 正常流 | 边界情况 | 错误处理 | UI/UX | 安全 | 总计 |
|------|--------|---------|---------|-------|------|------|
| A: Git 管理 | 1.5h | 1h | 0.5h | 0.5h | 0.5h | **4h** |
| B: PTY 终端 | 1.5h | 1h | 1h | 0.5h | 0.5h | **4.5h** |
| C: 文件管理 | 2h | 1.5h | 1h | 0.5h | 1h | **6h** |
| D: 扩展系统 | 1h | 0.5h | 0.5h | 0.5h | 0.5h | **3h** |
| E: AI 工作流 | 2h | 1h | 0.5h | 0.5h | 0.5h | **4.5h** |
| F: 代理体验 | 1h | 0.5h | 0.5h | 0.5h | — | **2.5h** |
| G: 上下文管理 | 0.5h | 0.25h | 0.25h | 0.25h | — | **1.25h** |
| 移动端 | 1h | 0.5h | 0.5h | 1h | — | **3h** |
| 跨模块/全局 | 1h | 0.5h | 0.5h | 1h | 1h | **4h** |
| **总计** | **11.5h** | **6.75h** | **5.25h** | **5.25h** | **4h** | **~33h** |

按 4h/天有效审计时间计算：**约 8-9 个工作日**

---

## 11. 审计产出物

| 产出物 | 位置 | 格式 |
|--------|------|------|
| 审计方法论（本文档） | .planning/research/AUDIT.md | Markdown |
| 审计结果报告 | .planning/research/AUDIT-RESULTS.md | Markdown |
| Lighthouse 报告 | audit-results/lighthouse/*.html | HTML |
| Bundle 分析报告 | audit-results/bundle/*.html | HTML |
| 问题清单 | .planning/research/AUDIT-ISSUES.md | Markdown |
| 修复计划 | .planning/research/AUDIT-FIX-PLAN.md | Markdown |
| 截图/录屏证据 | audit-results/screenshots/ | PNG/MP4 |

---

*文档创建: 2026-05-30*
*方法论基于: OWASP Top 10 2025, WCAG 2.1 AA, Google Core Web Vitals 2025, axe-core 4.x, Lighthouse 12.x*
