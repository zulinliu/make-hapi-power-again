# Hapi Power -- 项目状态

## 项目参考

参见: .planning/PROJECT.md (更新于 2026-05-30)

**核心价值:** 让 AI 编码代理拥有完整的开发者环境 -- 代码编辑、终端操作、版本控制、插件扩展，全部在浏览器中完成。
**当前状态:** v0.1 已发布，v0.2 规划中

## 当前状态

- **版本**: v0.2 开发中（基于 v0.1 发布版）
- **分支**: feat/v2 (from main)
- **远程仓库**: https://github.com/zulinliu/make-hapi-power-again.git
- **v0.2 主题**: 全功能审计调优 + iOS PWA 深度优化 + 移动端体验 + i18n 中英双语
- **代码库**: v0.1 完整功能 + v0.2 规划文档

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

## v0.2 规划

### Phase 9: 全功能审计
- [ ] 9 模块 117+ 测试用例实际操作审计
- [ ] Lighthouse 性能审计 (LCP < 2.5s / INP < 200ms / CLS < 0.1)
- [ ] axe-core 可访问性扫描
- [ ] 移动端专项审计
- [ ] OWASP Top 10 安全审计
- [ ] 所有 P0/P1 问题修复

### Phase 10: iOS PWA 深度优化
- [ ] manifest + standalone 模式配置
- [ ] 安全区域适配 (env(safe-area-inset-*))
- [ ] 启动画面 (6 iPhone 型号 + 暗/亮变体)
- [ ] 状态栏融合 (black-translucent + theme-color)
- [ ] iOS 推送通知 (Web Push API)
- [ ] 离线回退页面
- [ ] Home Indicator 避让

### Phase 11: 移动端体验增强
- [ ] 终端虚拟键盘工具栏
- [ ] 分享密码保护
- [ ] 分享访问次数限制
- [ ] 移动端 AI 聊天布局
- [ ] 移动端审查手势 (swipe)
- [ ] 响应式四断点验证

### Phase 12: i18n 中英双语
- [ ] 统一 i18n 架构到 shared/src/i18n/
- [ ] 中文翻译完善 (100% 覆盖)
- [ ] 英文翻译
- [ ] 语言动态切换
- [ ] 日期/数字本地化

### Phase 13: 设计打磨 + 收尾
- [ ] 视觉一致性检查
- [ ] 动画流畅度优化
- [ ] 暗/亮模式验证
- [ ] 构建 + v0.2 tag + GitHub Release

## 研究文档

| 文件 | 用途 |
|------|------|
| .planning/research/IOS-PWA.md | iOS PWA 最佳实践研究 (1457 行) |
| .planning/research/MOBILE-UX.md | 移动端 UX 研究参考 (756 行) |
| .planning/research/I18N.md | i18n 实现方案研究 |
| .planning/research/AUDIT.md | 全功能审计方法论 (766 行) |

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

---
*状态更新: 2026-05-30 (v0.2 规划完成)*
