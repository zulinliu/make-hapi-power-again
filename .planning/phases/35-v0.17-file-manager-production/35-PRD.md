---
phase: 35-v0.17-file-manager-production
document: PRD
version: v0.17.0
created: 2026-06-06
status: completed
---
# PRD: v0.17.0 全功能文件管理器

## 1. 目标

打造一个生产稳定使用的全功能文件管理器模块，使用户可以在浏览器中直接管理远程机器 workspace roots 内的项目文件。文件管理器必须支持无会话全局管理，也必须在会话内复用同一套能力并增强 Git 和 AI 开发上下文。

## 2. 用户与场景

| 用户 | 场景 | 关键诉求 |
|---|---|---|
| 移动端开发者 | iPhone 上查看远程项目结构，轻量修改文件 | 操作入口清晰，点击即达，不依赖右键 |
| 桌面端开发者 | 在浏览器中完成文件增删改查和项目整理 | 多选、移动、复制、搜索、编辑稳定 |
| AI 代理使用者 | 启动会话前先整理项目目录，或从目录直接发起会话 | 无会话也能管理文件 |
| 会话内用户 | 查看 Agent 修改、打开文件、编辑并保存 | 文件管理和 Git 状态联动 |

## 3. 范围

### P0 必须交付

| ID | 需求 | 验收标准 |
|---|---|---|
| FM-ARCH-01 | 统一 FileManager core | `/browse` 和 `/sessions/:id/files` 复用同一核心或同一数据源接口 |
| FM-MACH-01 | machine 级文件 API | 无 sessionId 时可 list/read/write/delete/rename/copy/move/mkdir |
| FM-NAV-01 | 显性返回上一级 | 工具栏或路径栏有上一级按钮，根目录下禁用或隐藏 |
| FM-HIDDEN-01 | 显示隐藏文件真实可用 | machine API 支持 `showHidden`，dotfile 可显示和隐藏 |
| FM-OPEN-01 | 点击文件打开 | 全局和会话模式点击文件均打开预览/编辑，不允许静默无动作 |
| FM-CREATE-01 | 创建入口收敛 | 新建文件和新建文件夹行为一致，不因入口不同产生能力差异 |
| FM-CRUD-01 | 基础 CRUD | 新建、重命名、删除、移动、复制全部真实执行 |
| FM-FEEDBACK-01 | 状态反馈 | 每个操作有 loading、success、error，失败说明具体原因 |
| FM-I18N-01 | 双语文案 | 新增文案全部进入 en 和 zh-CN，parity 通过 |
| FM-A11Y-01 | 可访问性 | 键盘、焦点、aria、触控目标达到 WCAG AA 基础要求 |

### P1 应交付

| ID | 需求 | 验收标准 |
|---|---|---|
| FM-EDIT-01 | 预览编辑生产化 | 文本、Markdown、图片、二进制、大文件都有明确状态 |
| FM-EDIT-02 | 保存冲突检测 | read 返回 hash/size/mtime，save 使用 expectedHash |
| FM-EDIT-03 | Monaco 懒加载 | 文本/代码编辑优先使用路由级懒加载 Monaco，失败可降级 textarea |
| FM-UPLOAD-01 | 上传文件 | 当前目录上传真实落盘，有进度和错误反馈 |
| FM-DOWNLOAD-01 | 下载文件 | 单文件下载可用，目录下载进入 P2 或明确降级 |
| FM-SEARCH-01 | 文件搜索 | 至少支持文件名搜索，内容搜索可复用 ripgrep |
| FM-TEST-01 | 测试覆盖 | 新增 machine file handler、API、核心 UI 测试 |

### P2 可延后但要预留

| ID | 需求 | 备注 |
|---|---|---|
| FM-DIR-DOWNLOAD-01 | 目录 zip 下载 | 需要压缩流和大小保护 |
| FM-BULK-01 | 批量上传/下载 | 基于 P1 传输能力扩展 |
| FM-PROPS-01 | 属性面板 | 权限、大小、mtime、路径、Git 状态 |
| FM-DRAG-01 | 拖放移动 | iOS 体验复杂，优先用移动到对话框 |
| FM-ARCHIVE-01 | 压缩/解压 | 需 ZIP bomb 防护 |

## 4. 非目标

1. 不做 workspaceRoots 外的任意文件系统管理。
2. 不做实时多人协同编辑。
3. 不做完整 IDE 替代，文件编辑服务于快速查看和轻量修改。
4. 不引入第二套 UI 框架或第二套文件管理组件库。
5. 不保留不可用按钮或“下一阶段提供”的占位入口。

## 5. 用户流程

### 全局模式

1. 用户进入 `/browse`。
2. 选择机器和 workspace root。
3. 浏览目录，使用上一级、面包屑、隐藏文件开关。
4. 点击文件打开预览或编辑。
5. 执行新建、重命名、删除、移动、复制、上传、下载。
6. 从当前目录启动 AI 会话。

### 会话模式

1. 用户进入 `/sessions/:id/files`。
2. 文件管理器显示 session cwd。
3. 用户查看文件和 Git 变更状态。
4. 点击文件打开预览/编辑。
5. 保存后 Git 状态刷新。

## 6. 错误与边界

| 场景 | 处理 |
|---|---|
| Machine 离线 | 显示离线状态和重试，不显示可执行操作 |
| workspaceRoots 未配置 | 引导 runner 使用 `--workspace-root` 启动 |
| 路径越界 | 后端拒绝并提示路径不在 workspace root 内 |
| 文件已存在 | 显示覆盖、重命名或取消选项 |
| 外部修改冲突 | 显示冲突状态，允许重新加载、另存、强制覆盖 |
| 大文件 | 默认只读预览或提示下载，不直接打开 Monaco |
| 二进制文件 | 不尝试文本编辑，提供下载和复制路径 |
| 上传失败 | 保留进度和错误，允许重试 |

## 7. 质量门禁

每个实现阶段至少运行：

```bash
bun run typecheck
bun run test:web
bun run test:hub
bun run test:cli
```

发布前运行：

```bash
bun run test
bun run build
git diff --check
```

## 8. 发布判定

v0.17.0 可以发布的最低条件：P0 全部完成，P1 中编辑冲突安全、上传单文件、下载单文件完成，剩余 P1/P2 明确记录为后续版本且没有空壳按钮暴露给用户。

