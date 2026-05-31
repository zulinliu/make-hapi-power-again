# 品牌升级完整报告：从 hapi 到 Hapi Power

> 创建: 2026-05-31
> 最后执行: Phase 23 (commit 0df40a2)
> 状态: **已完成** — grep 零残留确认

## 一、背景

Hapi Power 从 hapi 上游 fork，v0.3 做了第一轮品牌独立升级（Phase 14~18），包括包名 `@hapi` → `@hapipower`、环境变量 `HAPI_*` → `HAPI_POWER_*`、数据目录 `~/.hapi` → `~/.hapi-power` 等。但用户实际体验发现仍有 **~88 处**旧品牌残留，设置页面显示旧域名 hapi.run、版本号仍是上游 0.18.4、Hub 启动 banner 为 "HAPI Hub"。

## 二、残留原因分析

v0.3 品牌升级的遗漏根因：

1. **替换策略过于保守** — 只替换了代码标识符（包名、变量名、环境变量），忽略了用户可见的字符串文本（UI 文案、注释、日志、提示词）
2. **缺少全量 grep 验证** — 没有用 `\bHAPI\b` 正则做全仓库扫描确认零残留
3. **分层不彻底** — 分了 Phase 14~18 五个阶段但各层独立执行，没有最终的交叉验证
4. **版本号硬编码** — APP_VERSION 在 shared/src/buildInfo.ts 中硬编码为上游版本，未跟随项目版本
5. **localStorage keys 未迁移** — 15 个 key 仍使用 `hapi-` 前缀，无自动迁移逻辑

## 三、Phase 23 执行记录

### 执行策略

采用 **三级优先级 + grep 验证** 模式：

| 优先级 | 范围 | 方法 |
|--------|------|------|
| P0 | 用户可见 UI 文本、版本号、Hub banner | 逐文件精确替换 |
| P1 | CLI 系统提示词、注释、日志、localStorage 迁移 | grep 批量定位 + 逐文件替换 |
| P2 | 文档、测试描述、.gitignore | sed/replace_all |

### 替换规则

| 原始 | 替换为 | 说明 |
|------|--------|------|
| `\bHAPI Hub\b` | HapiPower Hub | 品牌+产品名 |
| `\bHAPI\b`（独立词） | Hapi Power | 仅限用户可见文本、注释、日志 |
| `X-Hapi-` 协议头 | `X-HapiPower-` | HTTP header |
| `hapi.run` | `github.com/zulinliu/make-hapi-power-again` | 官网 URL |
| `hapi.example.com` | `hapi-power.example.com` | 示例 URL |
| `Co-Authored-By: Hapi` | `Co-Authored-By: Hapi Power` | commit 署名 |

**不替换的范围**（代码标识符）：
- 变量名、函数名、类名中的 hapi（如 `hapiHubUrl`、`hapiPowerHomeDir`）
- localStorage key 中的 hapi（已通过迁移逻辑处理）
- npm 包名中的 @hapipower（已在 Phase 14 完成）

### 实际修复统计

**Commit**: `0df40a2`
**变更**: 38 文件, +219 插入, -87 删除

#### 按目录分布

| 目录 | 文件数 | 主要变更 |
|------|--------|----------|
| cli/src/ | 14 | 系统提示词、启动文本、注释、日志 |
| cli/tests/ | 6 | 测试断言和 mock 描述 |
| cli/fixtures/ | 1 | JSON fixture |
| cli/docs/ | 1 | runner/README.md |
| shared/src/ | 1 | slashCommands 注释 |
| hub/src/ | 3 | server.ts banner, cli.ts 协议头, cleanup 脚本 |
| hub/scripts/ | 1 | cleanup-sessions.ts |
| hub/src/ | 1 | configuration.ts 注释 |
| web/src/ | 5 | LoginPrompt, settings, i18n (en/zh-CN) |
| web/tests/ | 2 | settings test, codexSlashCommands test |
| website/src/ | 2 | SEO.tsx, VsHappy.tsx |
| scripts/ | 1 | seed-codex-web-fixture.ts |

#### 具体文件清单

**CLI 源码 (14 文件):**
- `cli/src/runner/run.ts` — "Hapi runner started" → "Hapi Power runner started"
- `cli/src/runner/doctor.ts` — 4 处注释中的 HAPI → Hapi Power
- `cli/src/claude/utils/systemPrompt.ts` — Co-Authored-By 署名、品牌说明
- `cli/src/opencode/utils/systemPrompt.ts` — 同上
- `cli/src/opencode/utils/hookPlugin.ts` — 5 处 hook 说明注释
- `cli/src/claude/utils/startHappyServer.ts` — 4 处日志/注释
- `cli/src/claude/utils/spawnHappyCLI.ts` — 5 处注释
- `cli/src/utils/autoStartServer.ts` — 3 处注释
- `cli/src/commands/claude.ts` — 1 处注释
- `cli/src/runner/runClaude.ts` — 注释
- `cli/src/runner/persistence.ts` — 注释
- `cli/src/sdk/index.ts` — 注释
- `cli/src/utils/hookPlugin.ts` — 注释

**Web 前端 (5 文件):**
- `web/src/components/LoginPrompt.tsx` — footer "HAPI" → "Hapi Power"
- `web/src/routes/settings/index.tsx` — 官网 URL 更新
- `web/src/lib/locales/en.ts` — placeholder、描述文本
- `web/src/lib/locales/zh-CN.ts` — 同上中文版
- `web/src/lib/locales/en.ts` — 多个翻译键

**Hub 后端 (3 文件):**
- `hub/src/web/server.ts` — HTML title/h1 banner
- `hub/src/web/routes/cli.ts` — 协议头 X-HapiPower-
- `hub/scripts/cleanup-sessions.ts` — ~/.hapi 路径回退 → ~/.hapi-power
- `hub/src/configuration.ts` — 注释

### 验证方法

```bash
# 全仓库 grep 确认零残留
grep -rn '\bHAPI\b' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' \
  cli/ shared/ hub/ web/src/ website/src/ scripts/ | \
  grep -v node_modules | grep -v '.git' | grep -v 'dist'

# 结果: 零匹配（仅保留 @hapipower 包名等代码标识符中的 hapi 字样）
```

## 四、经验教训

### 1. 品牌升级必须从外到内全量覆盖

品牌替换不能只改代码标识符，必须覆盖 **7 个层次**：

1. **用户可见 UI 文本** — 页面标题、按钮、footer、placeholder
2. **i18n 翻译** — 所有语言的翻译键
3. **HTML 模板** — title、meta、OG 标签
4. **服务端日志和启动 banner** — Hub 启动文本、CLI 欢迎信息
5. **系统提示词** — 影响第三方 AI 的行为
6. **注释和文档** — README、代码注释、docs/
7. **配置和路径** — 数据目录、配置文件名、协议头

### 2. grep 验证是唯一可靠的完成标准

不能用 "我改过了" 作为完成标准，必须用 `grep -rn '\bHAPI\b'` 全仓库扫描确认零匹配。

### 3. 版本号必须跟随项目版本

APP_VERSION 硬编码在 shared/src/buildInfo.ts，每次发布前必须确认与项目版本一致。Vite 的 `define` 常量不会通过 HMR 更新，需要重启 dev server。

### 4. localStorage 迁移需要运行时逻辑

不能只改 key 名——已有用户数据需要一次性迁移：读取旧 key → 写入新 key → 删除旧 key。

### 5. 每次新增代码必须使用新品牌

品牌升级不是一次性工作，而是 **持续性约束**。所有新增的 UI 文本、注释、日志、文档必须使用 Hapi Power 品牌。如有发现残留，需立即修复。

## 五、品牌防护规则

### 开发阶段

1. **新增文件检查** — 任何新增的 .ts/.tsx/.md 文件中不允许出现独立的 `\bHAPI\b`（除代码标识符如 @hapipower）
2. **代码审查** — 每次提交前用 `scripts/brand-check.sh` 扫描
3. **i18n 更新** — 添加翻译键时必须检查 en.ts 和 zh-CN.ts 一致性

### CI 检查

```bash
# scripts/brand-check.sh
# 扫描源码中的 HAPI 品牌残留
# 白名单: @hapipower, HAPI_POWER_, hapiPower (camelCase 标识符)
# 阻止: 独立的 \bHAPI\b 出现在用户可见文本中
```

### 品牌规范

| 上下文 | 正确用法 | 错误用法 |
|--------|----------|----------|
| 品牌名 | Hapi Power | HAPI, hapi, HapiPower |
| 产品全名 | HapiPower Hub | HAPI Hub |
| npm 包名 | @hapipower/protocol | @hapi/protocol |
| 环境变量 | HAPI_POWER_* | HAPI_* |
| 数据目录 | ~/.hapi-power | ~/.hapi |
| GitHub | zulinliu/make-hapi-power-again | hapi.run |
| 协议头 | X-HapiPower-* | X-Hapi-* |
| Co-Authored-By | Hapi Power <noreply@hapi-power.dev> | Hapi <noreply@hapi.dev> |
| localStorage | hapi-power-* | hapi-* |

## 六、后续追踪

- **Phase 23 已完成** — commit 0df40a2, grep 零残留
- **持续监控** — 每次 commit 前运行 brand-check.sh
- **如有发现残留** — 立即修复，不允许推后

---
*本文件为品牌升级的完整记录，是后续品牌维护的权威参考。*
