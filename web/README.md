# Web

Hapi Power 前端 — React PWA，提供完整的浏览器内 AI 代理开发体验。

## 功能

- 会话列表、聊天界面、消息流式更新
- Git 状态查看、Diff 对比、分支管理
- 文件浏览器 + Monaco Editor 代码编辑
- xterm.js 全功能终端（多会话、分屏）
- 插件管理、Skill 安装/卸载
- 变更审查面板（按对话分组、逐文件审批）
- 操作时间线、会话摘要
- 撤销变更（会话/步骤/文件粒度）
- 移动端专用界面 `/m/*`
- 会话分享
- PWA 推送通知
- 图片粘贴/拖拽上传
- 语音录制转文字
- 白板绘图工具
- 编排 Skill 页面

## 技术栈

React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS + Monaco Editor + xterm.js + Socket.IO Client + Shiki

## 路由

| 路径 | 说明 | 组件 |
|------|------|------|
| `/` | 重定向到 /sessions | - |
| `/sessions` | 会话列表 | `SessionList` |
| `/sessions/$sessionId` | 聊天界面 | `SessionChat` |
| `/sessions/new` | 创建新会话 | `NewSession` |
| `/sessions/$sessionId/files` | 文件浏览 + Git 状态 | `FilesPage` |
| `/sessions/$sessionId/file` | 文件查看/编辑 | `FileViewer` |
| `/sessions/$sessionId/terminal` | 终端 | `TerminalPage` |
| `/sessions/$sessionId/changes` | 变更审查 | `ChangeReview` |
| `/sessions/$sessionId/timeline` | 操作时间线 | `TimelinePage` |
| `/sessions/$sessionId/undo` | 撤销变更 | `UndoPage` |
| `/settings` | 应用设置 | `SettingsPage` |
| `/browse` | 工作区浏览 | `BrowsePage` |
| `/sessions/$sessionId/git` | Git 管理 | `GitPage` |
| `/sessions/$sessionId/extensions` | 会话扩展 | `ExtensionsPage` |
| `/orchestration` | 编排 Skill | `OrchestrationPage` |
| `/s/$shareId` | 分享查看 | `ShareViewPage` |
| `/m/$sessionId/changes` | 移动端变更审查 | `MobileChangesPage` |
| `/m/$sessionId/terminal` | 移动端终端 | `MobileTerminalPage` |

## 认证

通过 `useAuth.ts` 和 `useAuthSource.ts` 管理：

- 浏览器登录：使用 `CLI_API_TOKEN[:namespace]`
- JWT 令牌，自动刷新
- 登录页面右上角 Hub 地址选择器

## 数据获取

- **TanStack Query**：`src/hooks/queries/` 查询钩子、`src/hooks/mutations/` 变更钩子
- **SSE**：`useSSE.ts` 订阅 `/api/events`，自动缓存失效
- **Socket.IO**：`useTerminalSocket.ts` 终端连接、`useBinaryUpload.ts` 二进制上传

## 关键组件

| 组件 | 说明 |
|------|------|
| `SessionChat.tsx` | 主聊天界面，集成图片上传、语音、白板 |
| `SessionList.tsx` | 会话列表，状态、待审批、进度 |
| `SessionHeader.tsx` | 会话头部，白板入口 |
| `AssistantChat/HappyComposer.tsx` | 消息编辑器，语音入口 |
| `ImagePasteDrop.tsx` | 图片粘贴/拖拽上传包装器 |
| `VoiceRecorder.tsx` | 录音 → Whisper 转文字 |
| `Whiteboard.tsx` | Canvas 绘图工具 |
| `DiffView.tsx` | Diff 对比显示 |
| `Editor/` | Monaco Editor 集成 |
| `git/` | Git 管理组件 |

## 关键 Hooks

| Hook | 说明 |
|------|------|
| `useAuth.ts` | 认证状态管理 |
| `useSSE.ts` | SSE 实时订阅 |
| `useTerminalSocket.ts` | 终端 Socket.IO 连接 |
| `useBinaryUpload.ts` | 二进制文件上传 |
| `usePushNotifications.ts` | Web Push 推送 |
| `useTheme.ts` | 主题管理 |
| `useFontScale.ts` | 字体缩放 |
| `useTerminalFontSize.ts` | 终端字号 |
| `useOnlineStatus.ts` | 在线状态 |
| `usePWAInstall.ts` | PWA 安装提示 |

## 源码结构

```
src/
├── router.tsx           路由定义（19 个路由）
├── routes/              路由页面组件
│   ├── sessions/        会话视图
│   ├── settings/        设置页面
│   ├── mobile/          移动端路由
│   ├── orchestration.tsx 编排 Skill
│   └── share.tsx        分享页面
├── components/          UI 组件
│   ├── AssistantChat/   assistant-ui 集成
│   ├── ChatInput/       聊天输入
│   ├── NewSession/      新建会话
│   ├── Editor/          Monaco 编辑器
│   ├── git/             Git 管理组件
│   ├── SessionChat.tsx  主聊天界面
│   ├── SessionList.tsx  会话列表
│   ├── ImagePasteDrop.tsx 图片上传
│   ├── VoiceRecorder.tsx 语音录制
│   ├── Whiteboard.tsx   白板工具
│   ├── DiffView.tsx     Diff 显示
│   └── MarkdownRenderer.tsx Markdown 渲染
├── hooks/
│   ├── queries/         TanStack Query 查询
│   ├── mutations/       TanStack Query 变更
│   ├── useSSE.ts        SSE 订阅
│   ├── useTerminalSocket.ts 终端连接
│   ├── useBinaryUpload.ts  二进制上传
│   └── usePushNotifications.ts 推送
├── api/
│   └── client.ts        API 客户端封装
└── types/
    └── api.ts           类型定义
```

## 开发

```bash
# 从仓库根目录
bun run dev:web

# 单独构建
bun run build:web
```

构建产物在 `web/dist/`，由 Hub 服务或嵌入单文件可执行程序。
