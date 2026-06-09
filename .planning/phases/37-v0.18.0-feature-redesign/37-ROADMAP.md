# Phase 37 — v0.18.0 五大特色功能实施路线图（设计后续）

> 当前已完成：37-00 设计沉淀。
> 后续实施需单独创建 phase/plan，并按 Git 标准提交。本文只做路线建议。

## 37-00 — 设计与品牌系统（本次）

- [x] 综合代码检索：Provider、Git、Guide、Context、Outline/Export。
- [x] 外部参考调研：Git UI、Provider secret 管理、PWA、导出、Usage API。
- [x] tsintergy/GLM-5.1 direct API usage smoke test（不泄露 token）。
- [x] 品牌系统：五个功能命名、文化、logo、slogan。
- [x] UX Shape：桌面、移动端、状态、动效。
- [x] 技术设计：API、数据、事件、CLI queue、导出任务。
- [x] 需求与验收标准。

## 37-01 — 评审后前置门禁补充（本次）

目标：在任何源码实现前，将深度评审中的阻断项转为 docs-only 门禁。

- [x] `37-DEEP-REVIEW.md`：多子代理全方位评审结论。
- [x] `37-BRAND-CONTRACT.md`：canonical naming、五节点顺序、signature moment。
- [x] `37-PROTOCOL-ADDENDUM.md`：Guide Beam capability、queue isolate、fallback、幂等。
- [x] `37-SECURITY-ADDENDUM.md`：Provider SSRF、namespace、redaction、Export 隐私、Git 危险操作。
- [x] `37-UX-ACCEPTANCE-MATRIX.md`：iOS PWA、A11y、reduced motion、视口矩阵。

质量门禁：Phase 38+ 不得绕过 37-01 的前置约束。

## 38 — 模型星桥 / Model Nexus

目标：先重做 Settings Provider，因为它是模型、usage、context 的基础设施。

建议子阶段：

1. Provider schema 扩展：protocol、health、capabilities、model cache。
2. Provider health check API：models + messages + usage smoke test。
3. Model Nexus UI：健康总览、Provider 卡、Agent 矩阵。
4. Wizard 与移动端 sheet。
5. 安全强化：key reveal 降级、DNS/redirect 检查、诊断脱敏。
6. README/文档第一轮更新。

质量门禁：Hub route tests、providerStore migration tests、i18n parity、iOS 表单验证。

## 39 — Git 脉络 / Git Atlas

目标：把会话右上角 Git 页从命令 Tab 改成决策舱。

建议子阶段：

1. `git-dashboard` 结构化 API 与 parser 后移。
2. Git Atlas Hero + 变更地图首屏。
3. Diff preview pane/bottom sheet。
4. Commit Basket 与提交流程。
5. Sync Center：fetch/pull/push 统一。
6. 特殊状态：no repo、conflict、detached、clone progress。

质量门禁：Git route tests、parser tests、移动端 diff 性能、危险操作确认。

## 40 — 引导光标 + 上下文脉冲

目标：在核心会话中同时升级驾驶权与可靠性提示。

建议子阶段：

1. `deliveryMode` schema + Web optimistic `guiding` 状态。
2. Hub `guide-message` update 与 fallback queue。
3. Claude guide interrupt preserve-queue。
4. Codex guide interrupt，不复用 reset queue 的 abort。
5. Composer `排队/引导` segmented control。
6. Context Pulse UI 文案、阈值、popover。
7. Usage diagnostic：session cached usage、unavailable reason、provider capability 联动。

质量门禁：queue regression tests、CLI preserve-queue tests、StatusBar threshold tests、核心发送/取消/定时消息回归。

## 41 — 会话织锦 / Session Loom

目标：把大纲升级为导出、提炼、资产下载工作台。

建议子阶段：

1. 服务端 conversation outline，覆盖完整会话而非仅已加载消息。
2. Export preview API 与降噪/隐私扫描。
3. Markdown raw export 生成与下载。
4. Synthesis job：设计方案、PRD、决策日志、偏差检查、经验卡。
5. Session Loom panel UI：大纲/导出/提炼/资产。
6. iOS PWA 下载/share/copy fallback。

质量门禁：export snapshot tests、secret redaction tests、长会话性能测试、i18n 模板测试。

## 42 — 品牌整合与发布准备

目标：统一 README、截图、文档、icon、release 口径。

建议子阶段：

1. README/README.zh-CN 新功能品牌叙事。
2. PRODUCT.md 更新：Hapi Power 移动控制舱 + 五节点能力环。
3. docs/assets 新截图计划：Model Nexus、Git Atlas、Guide Beam、Context Pulse、Session Loom。
4. i18n 全量 parity 和无硬编码扫描。
5. 可访问性和 iOS PWA 手动审计。
6. Release checklist：无 secret、无第三方品牌残留署名、Git 作者规范。

## 依赖关系

```text
Model Nexus ──┐
              ├── Context Pulse diagnostics
Guide Beam ───┤
              └── Session Loom synthesis provider selection
Git Atlas ─────── Session Loom evidence / decision export
Brand System ──── README + screenshots + release
```

优先级建议：

1. **Model Nexus**：为 usage/context 和 provider trust 打基础。
2. **Guide Beam + Context Pulse**：直接改善核心会话体验。
3. **Git Atlas**：提升会话右上角工具价值。
4. **Session Loom**：将长期资产沉淀能力做完整。
5. **Brand/docs polish**：发布前统一传播。
