# Hapi Power -- 项目状态

## 项目参考

参见: .planning/PROJECT.md (更新于 2026-05-30)

**核心价值:** 让 AI 编码代理拥有完整的开发者环境 -- 代码编辑、终端操作、版本控制、插件扩展，全部在浏览器中完成。
**当前状态:** v0.4 开发中

## 当前状态

- **版本**: v0.4 开发中 (导航修复 + 品牌清理)
- **分支**: feat/v4
- **远程仓库**: https://github.com/zulinliu/make-hapi-power-again.git
- **v0.4 主题**: PWA 深度优化 + 品牌清理 + 导航修复

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

## v0.2 已完成

### Phase 9: 全功能审计 ✅ (2026-05-31)
- [x] 4 并行代码审计 agent (Module A+B, C+D, E+F+G, Security)
- [x] Lighthouse 基线审计 (A11y 90, BP 96, SEO 91, Agentic 67)
- [x] 浏览器 UI 验证 (登录/列表/详情/Git/Terminal)
- [x] OWASP Top 10 安全审计 (7 PASS, 3 WARN)

### Phase 10~13: iOS PWA + 移动端 + i18n + 收尾 ✅ (2026-05-31)
- [x] iOS PWA 深度优化 (manifest + 图标 + 启动画面 + 离线)
- [x] 移动端体验增强 (虚拟键盘 + 分享安全)
- [x] i18n 中英双语 (397 键完整覆盖)
- [x] 设计打磨 + v0.2.0 发布

## v0.3 已完成 — 品牌独立

### Phase 14: 核心基础设施改名 ✅
- [x] shared/ 包名 @hapi/protocol → @hapipower/protocol
- [x] 所有 import 路径 @hapi/ → @hapipower/
- [x] 数据目录 ~/.hapi → ~/.hapi-power
- [x] CLI 二进制 hapi → hapi-power

### Phase 15: CLI + Hub 后端改名 ✅
- [x] Hub 包名 + 配置属性名更新
- [x] 后端字符串引用全量替换
- [x] 数据库文件名 hapi.db → hapi-power.db

### Phase 16: 前端 + PWA 品牌升级 ✅
- [x] PWA manifest name → Hapi Power
- [x] HTML title/meta 更新
- [x] UI 文本品牌展示更新

### Phase 17: Website + 文档 + CI 全量升级 ✅
- [x] website/ 目录全量品牌升级
- [x] README + 文档更新
- [x] GitHub Actions + Issue 模板更新

### Phase 18: 验证 + 发布 ✅
- [x] 全量构建 + typecheck + 测试
- [x] v0.3.0 tag + GitHub Release

**⚠️ v0.3 遗留问题**: 代码标识符改名完成但用户可见文本(~88处)未清理，Phase 23 补充完成。

## v0.4 已完成 — PWA 深度优化 + 品牌清理

### Phase 19~22: PWA 深度优化 ✅ (2026-05-31)
- [x] Phase 19: SW 更新机制修复 (registerType + skipWaiting + 自定义更新 UI)
- [x] Phase 20: 安装引导增强 (稍后提醒 + 时机 + i18n + Manifest 完善)
- [x] Phase 21: 通知与 Badge API (角标 + 推送优化)
- [x] Phase 22: 质量门禁 + v0.4 发布

### Phase 23: 品牌残留全面清理 ✅ (2026-05-31)
- [x] 23-01: P0 核心品牌替换 (UI 可见文本 + 版本号 + Hub banner + i18n)
- [x] 23-02: P1 代码替换 (CLI 提示词 + 注释 + localStorage 迁移 + 测试)
- [x] 23-03: P2 文档替换 + 质量门禁 (grep 零残留)
- **Commit**: 0df40a2 (38 文件, +219/-87)
- **验证**: scripts/brand-check.sh 全量扫描

### Phase 24: 功能导航入口修复 ✅ (2026-05-31)
- [x] 深度排查所有规划功能的实际实现状态（15+ 功能全部已实现）
- [x] 24A: SessionHeader 添加 Git 管理 + 扩展按钮
- [x] 24B: 清理未使用 Sidebar 组件 + 添加 Skill 编排全局入口
- [x] 24C: 质量门禁通过（typecheck + 676/676 tests）+ 提交推送
- **Commit**: c92ea03 (6 文件, +56/-120)
- **修复内容**: Git 管理、扩展系统、Skill 编排三个功能之前无导航入口

### Phase 24+: 环境变量全量改名（可选）
- **目标**: CLI 代码中 ~50 处 HAPI_* → HAPI_POWER_*（需兼容回退逻辑）
- **状态**: 待规划

## 品牌升级经验总结

### 完整历程

品牌升级分两轮完成：

**第一轮 (v0.3, Phase 14~18)**: 代码标识符层改名
- npm 包名 @hapi → @hapipower
- 环境变量前缀 HAPI_ → HAPI_POWER_（部分完成）
- 数据目录 ~/.hapi → ~/.hapi-power
- CLI 二进制名 hapi → hapi-power

**第二轮 (v0.4, Phase 23)**: 用户可见文本全面清理
- UI 文本、i18n 翻译、HTML 模板
- Hub 启动 banner、CLI 系统提示词
- 注释、文档、测试描述
- localStorage key 迁移逻辑
- 共 38 文件 219 处插入 87 处删除

### 遗留待处理

| 类别 | 数量 | 说明 |
|------|------|------|
| 环境变量 HAPI_* → HAPI_POWER_* | ~50 处 | 功能性代码，需兼容迁移，规划为 Phase 24 |
| 脚本中 HAPI_DEV_* | ~20 处 | 开发脚本，同上 |

### 品牌防护规则（必须遵守）

1. **零容忍** — 独立的 `\bHAPI\b` 不允许出现在任何新增文件中（代码标识符如 @hapipower 除外）
2. **每次 commit 前检查** — 运行 `scripts/brand-check.sh`
3. **新代码必须使用 Hapi Power 品牌** — 所有 UI 文本、注释、日志、文档
4. **发现残留立即修复** — 不允许推后到下个版本

### 品牌规范速查

| 上下文 | 正确用法 | 错误用法 |
|--------|----------|----------|
| 品牌名 | Hapi Power | HAPI, hapi, HapiPower |
| 产品全名 | HapiPower Hub | HAPI Hub |
| npm 包名 | @hapipower/protocol | @hapi/protocol |
| 环境变量 | HAPI_POWER_* | HAPI_* |
| 数据目录 | ~/.hapi-power | ~/.hapi |
| 官方仓库 | github.com/zulinliu/make-hapi-power-again | hapi.run |

## v0.4 运维踩坑记录

### 2026-05-31: http_proxy + 机器注册连环问题

三个连锁问题: 创建会话报错 workspace roots / 机器名显示 UUID / 目录浏览缺失

**根因**:
1. `http_proxy` 环境变量导致 axios 把 localhost 请求转发到代理，代理返回 502 → **修复: `NO_PROXY=localhost,127.0.0.1`**
2. 测试时用 curl 预创建了空 metadata 的机器记录，hub 的 `getOrCreateMachine` 是 get-OR-create 不更新已有记录 → **修复: 清理 DB + 重启**
3. `--workspace-root` 设置过窄（只包含项目目录）→ **修复: 改为 `/home/liuzl`**

**完整记录**: .planning/research/OPS-LESSONS.md
**启动脚本**: scripts/start-runner.sh

## 研究文档

| 文件 | 用途 |
|------|------|
| .planning/research/IOS-PWA.md | iOS PWA 最佳实践研究 (1457 行) |
| .planning/research/IOS-PWA-DEEP.md | iOS PWA 深度研究 (1119 行) |
| .planning/research/IOS-PWA-BUGS.md | iOS PWA 三个真实体验问题分析 |
| .planning/research/MOBILE-UX.md | 移动端 UX 研究参考 (756 行) |
| .planning/research/I18N.md | i18n 实现方案研究 |
| .planning/research/AUDIT.md | 全功能审计方法论 (766 行) |
| .planning/research/OPS-LESSONS.md | 运维踩坑记录: proxy+机器注册 |
| .planning/research/BRAND-RESIDUE.md | **品牌升级完整报告** (含执行记录+防护规则) |

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

### v0.3~v0.4 品牌升级教训
1. **分层替换不够** — 必须覆盖 7 个层次：UI 文本、i18n、HTML、日志、提示词、注释、配置
2. **grep 验证是唯一可靠标准** — 不能用"我改过了"作为完成标准
3. **环境变量改名需兼容迁移** — HAPI_* → HAPI_POWER_* 需要运行时回退逻辑
4. **新增代码也必须用新品牌** — 品牌升级是持续性约束，不是一次性工作

---
*状态更新: 2026-05-31 (Phase 24 导航修复完成 + 提交推送)*
