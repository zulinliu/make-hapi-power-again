# Lighthouse 基线审计报告

**日期**: 2026-05-31
**URL**: http://localhost:3210/
**设备**: Desktop
**模式**: Navigation

## 分数概览

| 类别 | 分数 | 状态 |
|------|------|------|
| Accessibility | 90 | 良好 |
| Best Practices | 96 | 优秀 |
| SEO | 91 | 良好 |
| Agentic Browsing | 67 | 需改进 |

## 审计摘要

- 通过: 42
- 失败: 5
- 总耗时: 7994ms

## 已登录后 Session 页面观察

### UI 布局
- 左侧 Sidebar：Sessions 列表（36 sessions, 19 projects），搜索框，Browse/Settings/New Session 按钮
- 右侧主区域：聊天对话面板 + 工具活动折叠面板
- 底部：消息输入框 + 附件/设置/语音/PWA 安装等按钮

### 发现的问题（初步）

1. **Session 按钮无 hover 状态** — session 列表项在 hover 时没有视觉反馈（cursor: pointer 但无背景色变化）
2. **Copy 路径按钮间距过密** — "Copy: /home/liuzl/..." 按钮与下方 session 按钮间距不足
3. **PWA 安装提示遮挡** — 底部 "Install HAPI" 卡片可能遮挡输入区域
4. **Agentic Browsing 67 分** — 需要进一步分析失败项

### 功能可用性确认

- 登录流程：正常（token 输入 → Sign In）
- Session 列表：正常（项目分组、时间排序、搜索）
- Session 详情：正常（对话历史、工具活动展开）
- 模块导航：Files/变更审查/时间线/撤销/白板 按钮可见

---
*报告路径: .planning/phases/09-full-audit/lighthouse-baseline/*
