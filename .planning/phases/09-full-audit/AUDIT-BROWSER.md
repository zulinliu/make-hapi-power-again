# Phase 9 审计报告 — 浏览器验证

**日期**: 2026-05-31
**环境**: http://localhost:3210 (dev server, feat/v2 分支)

## 已验证的 UI 结构

### 登录页 (/)
- Token 输入框 + Sign In 按钮 ✅
- 语言切换 + Hub 选择器 ✅
- 需要帮助链接 ✅

### Sessions 列表 (/sessions)
- 36 sessions, 19 projects 显示正确 ✅
- 项目分组 + 目录复制按钮 ✅
- 搜索框 ✅
- Browse / Settings / New Session 按钮 ✅

### Session 详情 (/sessions/:id)
- 对话历史 + 工具活动面板 ✅
- 模块导航：Files / 变更审查 / 时间线 / 撤销变更 / 白板绘图 ✅
- 底部输入区：附件 / 设置 / 语音 / PWA 安装提示 ✅
- 上下文用量显示 (ctx 0/190k) ✅

### Git 页面 (/sessions/:id/git)
- Status / History / Branches 三 Tab ✅
- Runner 离线时显示 RPC 错误 + Retry 按钮 ✅

### Terminal 页面 (/sessions/:id/terminal)
- CWD 路径显示 ✅
- Offline 状态指示器 ✅
- 离线提示 "Session is inactive" ✅
- 虚拟键盘工具栏（17 个按键，全部正确禁用）✅

## 初步发现的问题

| ID | 严重度 | 模块 | 描述 |
|----|--------|------|------|
| A-01 | P2 | 全局 | Session 列表按钮点击区域不明显，hover 无视觉反馈 |
| A-02 | P2 | 全局 | "Copy: /path" 按钮与下方 session 按钮间距不足 |
| A-03 | P3 | 全局 | 底部 PWA Install 卡片可能遮挡输入区 |

## 限制说明

Git / Terminal / Files 等模块需要活跃 runner 才能完整测试。
当前审计转向**代码级审计 + 静态分析**，更高效地发现功能和质量问题。

## Lighthouse 基线

| 类别 | 分数 |
|------|------|
| Accessibility | 90 |
| Best Practices | 96 |
| SEO | 91 |
| Agentic Browsing | 67 |
