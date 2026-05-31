# Hapi Power -- 项目状态

## 项目参考

参见: .planning/PROJECT.md (更新于 2026-05-30)

**核心价值:** 让 AI 编码代理拥有完整的开发者环境 -- 代码编辑、终端操作、版本控制、插件扩展，全部在浏览器中完成。
**当前状态:** v0.4 开发中

## 当前状态

- **版本**: v0.4 开发中 (PWA 深度优化)
- **分支**: feat/v4 (from main)
- **远程仓库**: https://github.com/zulinliu/make-hapi-power-again.git
- **v0.4 主题**: PWA 深度优化 — 从底层到设计层面全面优化 PWA 模式体验
- **v0.4 需求**: 18 项 (SWU:6 + INST:4 + NTF:4 + MNF:4)

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

### Phase 9: 全功能审计 ✅ (2026-05-31)
- [x] 4 并行代码审计 agent (Module A+B, C+D, E+F+G, Security)
- [x] Lighthouse 基线审计 (A11y 90, BP 96, SEO 91, Agentic 67)
- [x] 浏览器 UI 验证 (登录/列表/详情/Git/Terminal)
- [x] OWASP Top 10 安全审计 (7 PASS, 3 WARN)
- [x] 审计报告 (0 P0, 7 P1, 15 P2, 8 P3)
- [x] 4 项快速修复已提交 (D-03, D-04, A-03, A-04)

### Phase 10: iOS PWA 深度优化 ✅ (2026-05-31)
- [x] manifest 增强: categories + shortcuts + maskable 图标 (192/512)
- [x] iOS 多尺寸图标: 120/152/167/180
- [x] iOS 启动画面: 6 iPhone 型号 x 暗/亮变体 = 12 张
- [x] 离线回退页面: offline.html + SW NavigationRoute
- [x] SW 缓存策略: NavigationRoute fallback + SPA 路由离线支持

### Phase 11: 移动端体验增强 ✅ (2026-05-31)
- [x] 终端虚拟键盘第三行: Ctrl+C/D/L/Z + ~/`/./"/' + 长按变体
- [x] Composer iOS PWA safe-area-inset-bottom 适配
- [x] 分享密码保护: Bun.password 哈希 + POST 验证
- [x] 分享访问次数限制: maxViews 字段 + 超限 410

### Phase 12: i18n 中英双语 ✅ (2026-05-31)
- [x] 分享页面国际化: 18 个 share.* 翻译键 (zh-CN + en)
- [x] 硬编码中文全部替换为 t() 调用
- [x] 现有 i18n 架构确认: 397 键完整覆盖, en.ts 无中文泄漏

### Phase 13: 设计打磨 + 收尾 ✅ (2026-05-31)
- [x] 视觉一致性检查 + 暗/亮模式验证 (Lighthouse A11y 90, BP 96, SEO 91)
- [x] 构建 + v0.2.0 tag + GitHub Release

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

## v0.3 规划 (品牌独立)

### Phase 14: 核心基础设施改名 (待执行)
- [ ] shared/ 包名 @hapi/protocol → @hapipower/protocol
- [ ] 所有 import 路径 @hapi/ → @hapipower/
- [ ] 环境变量全量改名 HAPI_* → HAPI_POWER_*
- [ ] 数据目录 ~/.hapi → ~/.hapi-power

### Phase 15: CLI + Hub 后端改名 (待执行)
- [ ] CLI 二进制 hapi → hapi-power
- [ ] Hub 包名 + 配置属性名更新
- [ ] 后端字符串引用全量替换
- [ ] 数据库文件名 hapi.db → hapi-power.db

### Phase 16: 前端 + PWA 品牌升级 (待执行)
- [ ] PWA manifest name → Hapi Power
- [ ] HTML title/meta 更新
- [ ] i18n 翻译键 HAPI → Hapi Power
- [ ] localStorage keys 迁移
- [ ] UI 文本品牌展示更新

### Phase 17: Website + 文档 + CI 全量升级 (待执行)
- [ ] website/ 目录全量品牌升级
- [ ] README + 文档更新
- [ ] GitHub Actions 更新
- [ ] GitHub Issue 模板更新

### Phase 18: 验证 + 发布 (待执行)
- [ ] 全量构建 + typecheck + 测试
- [ ] grep 零残留扫描确认
- [ ] v0.3 tag + GitHub Release

---
*状态更新: 2026-05-31 (v0.4 PWA 深度优化规划完成，开始 Phase 19)*
