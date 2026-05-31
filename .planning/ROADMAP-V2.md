# Roadmap: Hapi Power v0.2 — 体验优化版

## Overview

v0.2 是体验优化版本，聚焦三大目标：全功能审计调优、iOS PWA 深度优化（添加到主屏幕全屏体验）、i18n 中英双语。执行顺序遵循"先审计发现问题 → 再 PWA 基础设施 → 然后移动端体验 → 最后 i18n 和设计打磨"的逻辑依赖链。

## Phases

- [ ] **Phase 9: 全功能审计** — 启动 dev server 实际操作测试全部 9 个模块，记录并修复所有发现的问题
- [ ] **Phase 10: iOS PWA 深度优化** — manifest/安全区域/启动画面/状态栏/推送通知/离线回退
- [ ] **Phase 11: 移动端体验增强** — 终端触摸/虚拟键盘/分享安全/聊天布局/审查手势/响应式验证
- [ ] **Phase 12: i18n 中英双语** — 统一架构 + 中文完善 + 英文翻译 + 语言切换
- [ ] **Phase 13: 设计打磨 + 收尾** — 视觉一致性 + 动画优化 + 暗/亮模式 + 构建发布 v0.2

## Phase Details

### Phase 9: 全功能审计
**Goal**: 启动 dev server，实际操作测试全部 9 个模块，系统化记录并修复所有功能和体验问题
**Depends on**: v0.1 全部完成
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05
**Success Criteria**:
  1. Git 管理：状态/历史/分支/diff 全部功能正常（22 个测试用例通过）
  2. PTY 终端：创建/输入/关闭/分屏正常（19 个测试用例通过）
  3. 文件管理 + Monaco：文件树/CRUD/编辑/预览正常（25 个测试用例通过）
  4. 扩展系统：插件/Skill/Claude Plugin 加载正常（12 个测试用例通过）
  5. AI 工作流：变更审查/时间线/撤销/上下文正常（18 个测试用例通过）
  6. 代理体验：语音/白板/Skill 编排正常（9 个测试用例通过）
  7. 上下文管理：用量显示/压缩通知正常（5 个测试用例通过）
  8. Lighthouse 核心指标：LCP < 2.5s / INP < 200ms / CLS < 0.1
  9. 所有 P0/P1 问题已修复，P2 问题有跟踪计划
**Plans**: 2 plans（审计执行 + 问题修复）

### Phase 10: iOS PWA 深度优化
**Goal**: 实现 iOS Safari 添加到主屏幕后的原生应用级 PWA 体验
**Depends on**: Phase 9（先确保功能正确再优化 PWA）
**Requirements**: PWA-01, PWA-02, PWA-03, PWA-04, PWA-05, PWA-06, PWA-07
**Success Criteria**:
  1. iOS Safari 添加到主屏幕后以 standalone 模式全屏运行
  2. 所有页面正确适配安全区域（刘海/灵动岛/底部手势条）
  3. 启动画面覆盖 iPhone SE/14/14 Pro/16 Pro/16 Pro Max（含暗/亮变体）
  4. 状态栏与主题色融合（black-translucent + 动态 theme-color）
  5. 推送通知在 iOS 16.4+ 可正常接收和展示
  6. 离线时显示友好的回退页面
  7. Home Indicator 底部不遮挡内容
**Plans**: 3 plans（manifest + 安全区域 → 启动画面/状态栏 → 推送/离线）

### Phase 11: 移动端体验增强
**Goal**: 全面优化移动端交互体验，让手机/平板上使用 Hapi Power 如丝般顺滑
**Depends on**: Phase 10（PWA 基础设施先到位）
**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04, MOB-05, MOB-06
**Success Criteria**:
  1. 终端虚拟键盘工具栏可用（Ctrl/Esc/Tab/方向键 + 修饰键锁定）
  2. 分享链接支持密码保护（bcrypt 哈希 + 加密 token）
  3. 分享链接支持访问次数限制（可配置上限 + 自动过期）
  4. 移动端 AI 聊天布局优化（语音按钮 + 气泡适配 + 快速操作）
  5. 移动端变更审查支持 swipe approve/reject 手势
  6. 所有模块在 320/375/768/1024 四个断点下正确显示
**Plans**: 3 plans（终端/键盘 → 分享安全 → 聊天/审查/响应式）

### Phase 12: i18n 中英双语
**Goal**: 统一 i18n 架构并完成中英双语翻译
**Depends on**: Phase 9（功能稳定后再做翻译）
**Requirements**: I18N-01, I18N-02, I18N-03, I18N-04, I18N-05
**Success Criteria**:
  1. i18n 核心代码统一到 shared/src/i18n/（自研轻量方案，~2KB）
  2. web/ 所有页面 100% 中文覆盖，无遗漏 key
  3. web/ 所有页面英文翻译完成，翻译完整性测试通过
  4. 运行时语言切换即时生效 + localStorage 持久化
  5. 日期/数字/文件大小按当前语言正确格式化
**Plans**: 2 plans（架构统一 + 翻译完成）

### Phase 13: 设计打磨 + 收尾
**Goal**: 全页面视觉一致性走查、动画优化、构建发布 v0.2
**Depends on**: Phase 10, Phase 11, Phase 12
**Requirements**: DS2-01, DS2-02, DS2-03
**Success Criteria**:
  1. 设计系统 token 遵从度检查通过（所有组件使用 --app-* 变量）
  2. 动画流畅度统一（150-300ms + reduced-motion 支持）
  3. 所有页面暗/亮模式视觉走查通过
  4. `bun run build` 全量构建成功
  5. `bun run build:single-exe` 单文件可执行程序构建成功
  6. v0.2 tag 已推送
  7. GitHub Release 已创建
**Plans**: 2 plans（设计打磨 + 构建发布）

## Dependency Graph

```
Phase 9 (审计) ──→ Phase 10 (iOS PWA) ──→ Phase 11 (移动端)
       │                                          │
       └──→ Phase 12 (i18n) ──────────────────────┘
                              │
              Phase 13 (打磨+收尾) ←───┘
```

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 9. 全功能审计 | Pending | — |
| 10. iOS PWA 优化 | Pending | — |
| 11. 移动端体验 | Pending | — |
| 12. i18n 中英双语 | Pending | — |
| 13. 设计打磨+收尾 | Pending | — |

---
*Roadmap created: 2026-05-30*
*Version: v0.2 — 体验优化版*
