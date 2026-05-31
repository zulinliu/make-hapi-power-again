# Hapi Power v0.3 需求文档

## 版本主题
**品牌独立** — 从 hapi 上游项目完全独立，建立 Hapi Power 自主品牌身份

## 核心目标
清除代码库中所有 "hapi" 上游品牌残留，将整个项目升级为 "Hapi Power" 独立品牌。

## 品牌规范

### 命名映射

| 旧值 | 新值 | 范围 |
|------|------|------|
| `HAPI` (品牌展示) | `Hapi Power` | UI 文本、文档、HTML |
| `HAPI` (PWA 名) | `Hapi Power` | manifest, PWA |
| `hapi` (CLI 命令) | `hapi-power` | 二进制、文档 |
| `@hapi/protocol` | `@hapipower/protocol` | npm scope |
| `@twsxtd/hapi*` | `@hapipower/hapi-power*` | npm 包名 |
| `HAPI_HOME` | `HAPI_POWER_HOME` | 环境变量 |
| `HAPI_API_URL` | `HAPI_POWER_API_URL` | 环境变量 |
| `HAPI_LISTEN_*` | `HAPI_POWER_LISTEN_*` | 环境变量 |
| `HAPI_PUBLIC_URL` | `HAPI_POWER_PUBLIC_URL` | 环境变量 |
| `HAPI_RELAY_*` | `HAPI_POWER_RELAY_*` | 环境变量 |
| `HAPI_DAEMON_*` | `HAPI_POWER_DAEMON_*` | 环境变量 |
| `HAPI_RUNNER_*` | `HAPI_POWER_RUNNER_*` | 环境变量 |
| `HAPI_EXPERIMENTAL` | `HAPI_POWER_EXPERIMENTAL` | 环境变量 |
| `HAPI_EXTRA_HEADERS_JSON` | `HAPI_POWER_EXTRA_HEADERS_JSON` | 环境变量 |
| `HAPI_CLI_EXECUTABLE` | `HAPI_POWER_CLI_EXECUTABLE` | 环境变量 |
| `HAPI_DEV_*` | `HAPI_POWER_DEV_*` | 环境变量 |
| `HAPI_OFFICIAL_WEB_URL` | `HAPI_POWER_OFFICIAL_WEB_URL` | 环境变量 |
| `HAPI_BOT_LOGINS` | `HAPI_POWER_BOT_LOGINS` | 环境变量 |
| `~/.hapi` | `~/.hapi-power` | 数据目录 |
| `hapi.db` | `hapi-power.db` | 数据库文件 |
| `happyHomeDir` | `hapiPowerHomeDir` | 代码属性名 |
| `happyLibDir` | `hapiPowerLibDir` | 代码属性名 |
| `happyCliVersion` | `hapiPowerCliVersion` | 代码属性名 |
| `hapi_*` (localStorage) | `hapi_power_*` | 浏览器存储 |
| `hapi.run` | `YOUR_DOMAIN` | 域名占位 |
| `app.hapi.run` | `YOUR_DOMAIN` | 域名占位 |
| `relay.hapi.run` | `YOUR_RELAY_DOMAIN` | 域名占位 |
| `hapi.manus.space` | `YOUR_DOMAIN` | 域名占位 |
| `hapidev.weishu.me` | `YOUR_DOMAIN` | 域名占位 |
| `github.com/tiann/hapi` | `github.com/zulinliu/make-hapi-power-again` | 仓库引用 |

### 不改的部分
- 代码中引用的第三方库 "happy-dom" 保持不变（测试依赖，非品牌）
- `.planning/` 目录中的历史文档保持不变（项目历史记录）

## 阶段划分

### Phase 14: 核心基础设施改名
- shared/ 包名 `@hapi/protocol` → `@hapipower/protocol`
- 所有 import 路径更新
- 环境变量全量改名
- 数据目录 `~/.hapi` → `~/.hapi-power`

### Phase 15: CLI + Hub 后端改名
- CLI 二进制名 `hapi` → `hapi-power`
- Hub 包名更新
- 配置文件属性名 (happyHomeDir → hapiPowerHomeDir)
- 后端所有字符串引用

### Phase 16: 前端 + PWA 品牌升级
- PWA manifest name/short_name
- HTML title 和 meta
- i18n 翻译键
- localStorage keys
- UI 文本和品牌展示

### Phase 17: Website + 文档 + CI 全量升级
- website/ 目录全量品牌升级
- README, CONTRIBUTING, SECURITY, AGENTS 更新
- GitHub Actions workflow 更新
- GitHub Issue 模板更新

### Phase 18: 验证 + 发布
- 全量构建验证
- typecheck + 测试
- 最终残留扫描 (grep 确认零残留)
- v0.3 tag + GitHub Release

## 质量门禁
- 每阶段: typecheck + vitest 通过
- 最终: `grep -ri "hapi" --exclude-dir={node_modules,.git,dist,.planning,.understand-anything}` 零结果 (仅允许 happy-dom 等第三方引用)
- 每阶段完成后 commit + push

## 风险
1. **破坏性变更**: 环境变量和目录名改动对现有用户不兼容 → 需要在文档中明确说明迁移步骤
2. **import 路径**: ~130+ 文件的 `@hapi/` import 需要全部更新 → 批量替换，风险可控
3. **测试**: 现有 676 测试用例必须全部通过 → 不能因为改名引入任何功能回归
