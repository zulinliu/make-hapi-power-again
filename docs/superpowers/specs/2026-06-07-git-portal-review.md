# Git Portal 自审文档 (GP-6)

**日期**: 2026-06-07
**分支**: feat/v0.17.3
**审查范围**: Git Portal 传送门功能全部新增代码

---

## 1. 实施总结

### 阶段完成情况

| 阶段 | 描述 | 状态 | 文件数 | 变更量 |
|------|------|------|--------|--------|
| GP-1 | 后端基础设施 | 完成 | 12 | +405/-17 |
| GP-2 | 前端基础层 | 完成 | 4 | +663 |
| GP-3 | 输入组件 | 完成 | 5 | +603 |
| GP-4 | 进度/结果组件 | 完成 | 3 | +615 |
| GP-5 | 集成与 i18n | 完成 | 4 | +279 |
| GP-6 | 质量门禁 | 完成 | 8 | ~+120 |

### 新增文件清单

**后端 (CLI + Hub)**:
- `shared/src/rpcMethods.ts` — MachineGitClone RPC 方法
- `shared/src/socket.ts` — CloneProgressPayload 扩展
- `shared/src/schemas.ts` — clone-progress SyncEvent 类型
- `cli/src/modules/common/handlers/git.ts` — SSRF 防护 + ASKPASS 认证 + 进度流
- `hub/src/web/routes/machines.ts` — 机器级 clone 路由
- `hub/src/sync/rpcGateway.ts` — gitCloneMachine 方法
- `hub/src/sync/syncEngine.ts` — 同步引擎 pass-through
- `hub/src/socket/handlers/cli/index.ts` — clone:progress 转发

**前端 (Web)**:
- `web/src/lib/git-portal-storage.ts` — localStorage 历史管理
- `web/src/lib/git-portal-api.ts` — API 封装层
- `web/src/components/GitPortal/useGitClone.ts` — 状态管理 hook
- `web/src/components/GitPortal/GitPortal.tsx` — 主容器
- `web/src/components/GitPortal/GitPortalStepInput.tsx` — URL 输入 + 配置
- `web/src/components/GitPortal/GitPortalAuth.tsx` — 认证组件
- `web/src/components/GitPortal/GitPortalHistory.tsx` — 历史/收藏
- `web/src/components/GitPortal/GitPortalEmptyState.tsx` — 空状态
- `web/src/components/GitPortal/GitPortalAnimation.tsx` — SVG 动画
- `web/src/components/GitPortal/GitPortalProgress.tsx` — 进度显示
- `web/src/components/GitPortal/GitPortalResult.tsx` — 结果页
- `web/src/styles/git-portal.css` — CSS 动画/响应式/无障碍

---

## 2. 代码审查发现与修复

### CRITICAL (已修复)

| # | 问题 | 文件 | 修复方案 |
|---|------|------|----------|
| C1 | ASKPASS shell 注入 — 密码中 `$`、反引号会被 shell 解释 | `cli/.../git.ts` | 改用环境变量 `$GP_CLONE_PASSWORD` 传递，ASKPASS 脚本通过 `printf '%s'` 输出，避免任何 shell 解释 |
| C2 | targetDir 路径遍历 — 缺少 `validatePath()` 检查 | `cli/.../git.ts` | 当 `data.targetDir` 存在时，对 `path.resolve()` 后的结果调用 `validatePath(targetDir, workingDirectory)` |
| C3 | SSRF IPv6 绕过 — 未检查 `::1`、`fd00::`、`::ffff:` 映射 | `cli/.../git.ts` | 添加 IPv6 loopback/private/link-local 检查，以及 IPv6-mapped IPv4 地址解析检查 |

### HIGH (已修复)

| # | 问题 | 文件 | 修复方案 |
|---|------|------|----------|
| H1 | i18n 键不匹配 — StepInput 用 `gitPortal.input.*` 但 locale 文件未定义 | `en.ts` / `zh-CN.ts` | 在两个 locale 文件中添加 9 个 `gitPortal.input.*` 键 |
| H2 | confirm.cancel 键名不一致 | `en.ts` / `zh-CN.ts` | 添加 `gitPortal.confirm.cancel` 别名 |
| H3 | History 展开/收起同一文本 | `GitPortalHistory.tsx` | 收起用 `gitPortal.history.less`，并添加对应 i18n 键 |

### MEDIUM (已修复)

| # | 问题 | 文件 | 修复方案 |
|---|------|------|----------|
| M1 | 本地 `cn()` 函数重复定义 | `Result.tsx` / `Animation.tsx` | 删除本地定义，统一 import `@/lib/utils` 的 `cn` |
| M2 | FavoriteStar 硬编码英文 aria-label | `GitPortalHistory.tsx` | 改用 `t('gitPortal.result.unfavorite/favorite')` |
| M3 | clone `cwd` 设为不存在的 targetDir | `cli/.../git.ts` | `spawn` 的 `cwd` 改用 `resolved.cwd`（父目录），targetDir 作为 git clone 参数 |

### 已知限制 (LOW — 不阻塞发布)

| # | 问题 | 说明 |
|---|------|------|
| L1 | History `useMemo` 依赖 `activeTab` | 切换 tab 时两个列表都重算，外部更新不触发重渲染。可后续加 refreshKey |
| L2 | `formatRelativeTime` 未国际化 | 显示 "5m ago" 等英文。可后续用 Intl.RelativeTimeFormat |
| L3 | ASKPASS 可预测路径 | 使用 UUID cloneId，熵足够，chmod 600 在 writeFileSync 时设置 |

---

## 3. 质量检查结果

| 检查项 | 结果 |
|--------|------|
| TypeScript typecheck (shared) | PASS |
| TypeScript typecheck (hub) | PASS |
| TypeScript typecheck (web) | PASS |
| TypeScript typecheck (cli) | PASS |
| Vite production build | PASS (48s) |
| 品牌检查 (brand-check.sh) | PASS — 零残留 |
| SSRF 防护 | PASS — IPv4 + IPv6 + 十进制编码 |
| 路径遍历防护 | PASS — targetDir + cwd 均有 validatePath |
| Shell 注入防护 | PASS — ASKPASS 使用环境变量 |
| i18n 覆盖 | PASS — en + zh-CN 全覆盖 |
| 无障碍基线 | PASS — aria-label 已国际化，prefers-reduced-motion 支持 |

---

## 4. 架构决策记录

1. **useGitClone 暴露 handleProgressEvent 回调** — 而非内部调用 useSSE，避免重复 SSE 连接
2. **MachineGitClone 独立 RPC** — 与 session 级 GitClone 分离，通过 machineRpc 路由
3. **localStorage 存储** — P1 简单方案，最大 20 条，收藏免驱逐
4. **SVG 动画分级** — 低端设备自动降级为静态图标

---

## 5. 后续建议

1. **DNS 解析验证** — 当前 SSRF 防护基于字符串匹配，可考虑增加 DNS 解析后 IP 检查
2. ~~**Intl.RelativeTimeFormat** — 替换手动 formatRelativeTime 实现自动国际化~~ 已通过 gitPortal.time.* i18n 键解决
3. ~~**History refreshKey** — 解决外部更新不触发重渲染的问题~~ 已添加 refreshKey 状态
4. **Clone 进度字节级** — 当前进度基于对象数百分比，可细化到字节数
5. **E2E 测试** — 需要实际 git clone 场景的端到端测试覆盖
6. **SSE shouldSend 路由** — SSEManager.shouldSend 检查顶级 sessionId/machineId，但 clone-progress 事件这些字段在 data 内，非 all 订阅无法收到
7. **FileManager onProgressEvent** — 未连接 SSE 进度订阅到 GitPortal，clone 期间用户只看到静态"连接中"
8. **焦点陷阱** — 对话框缺少 Tab 键焦点循环限制
9. **git push/pull/fetch 参数验证** — 原有 git handler 的 remote/branch/startPoint 未做格式校验（非 Git Portal 新增，但建议后续修复）

---

## 6. 五维度审查补充 (cd303c6)

**审查方式**: 并行 5 个专业子代理

| 维度 | 判定 | 关键发现 | 已修复 |
|------|------|----------|--------|
| 安全 | 4 CRITICAL | SSRF 八进制绕过、spawn error 信息泄露 | 2/4 (其余为原有代码) |
| 前端质量 | 2 HIGH | stale closure、setTimeout 泄漏 | 全部 |
| CSS/无障碍 | 8 CRITICAL | CSS 死代码、ARIA 缺失、安全区域 | 全部 |
| i18n/品牌 | 6 WARNING | formatRelativeTime 硬编码、平台名硬编码 | 1/6 (其余为 LOW) |
| 架构集成 | 2 FAIL | SSE 路由不匹配、FileManager 未连接进度 | 0/2 (需架构改动) |

### 已修复清单

- SSRF 八进制编码 IP 检测
- spawn error 返回经 sanitizeGitUrl 清理
- startClone 使用 stateRef 消除 stale closure
- setTimeout 在 reset/cancel 时清理
- onCloneComplete 添加 abortRef 检查
- 移动端/桌面端补全 role="dialog" + aria-modal
- 移动端 iOS 安全区域处理
- label/input htmlFor/id 关联
- formatRelativeTime 国际化 (5 个新 i18n 键)
- SSE 订阅添加 unsubscribe 清理
- History 添加 refreshKey 解决新条目不显示
- CSS 删除 8 处死代码
- GitPortal.tsx 去重移动/桌面渲染树
- prefers-reduced-motion 补全 gp-star-active

### 未修复（需后续迭代）

- SSE shouldSend 路由（需改 SSEManager 架构）
- FileManager onProgressEvent 连接（需改 FileManager props 传递）
- 焦点陷阱（需引入 focus-trap-react 或手写）
- git push/pull/fetch 参数验证（非 Git Portal 新增）
