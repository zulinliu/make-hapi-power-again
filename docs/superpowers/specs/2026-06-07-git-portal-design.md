# Git Portal — Git 传送门 设计文档

> **状态**: 评审修订版，待实施
> **日期**: 2026-06-07
> **版本**: v1.1（根据架构/UX/安全/i18n 四维评审修订）

---

## 1. 品牌创意设计

### 1.1 品牌名称

| 语言 | 名称 | 说明 |
|------|------|------|
| 英文 | **Git Portal** | 简洁有力，全球开发者通用 |
| 中文 | **Git 传送门** | 互联网经典概念，零认知成本 |

### 1.2 品牌标语（Slogan）

| 语言 | Slogan |
|------|--------|
| EN | **Portal to your code universe** |
| ZH | **通向你的代码宇宙** |

与主品牌"随时AI，编程自在"呼应。

### 1.3 功能一句话介绍

| 语言 | 介绍 |
|------|------|
| EN | _Clone any Git repository and start coding with AI in seconds._ |
| ZH | _克隆任意 Git 仓库，秒级开启 AI 编程之旅。_ |

### 1.4 功能图标（Icon）设计概念

延续力量几何设计语言，图标由**两个同心菱形**构成：

- 外菱形：代表传送门框架（稳定的几何基座）
- 内菱形：微旋转 8°，降低动态感，增加与能量台 Logo 的统一感
- 中心：一条竖向短线，代表"Git 分支"穿越传送门
- 颜色：使用 CSS 变量 `var(--hp-primary)` 适配明暗主题

视觉上类似"发光的几何门框"，与主品牌 Logo 的"能量台"概念形成系列感——Logo 是"台"，Portal 是"门"。

### 1.5 品牌文化叙事

> Hapi Power 的核心承诺是"随时AI，编程自在"。Git Portal 是这个承诺的延伸——无论你的代码在哪里，传送门都能把它带到你的工作台。
>
> Portal 不是一个技术操作，而是一次"传送"。用户不需要关心 git 命令的细节，只需要知道：把 URL 扔进门里，代码就到了。
>
> 每次克隆都是一次传送，历史记录就是你的"传送日志"。

### 1.6 品牌色彩

所有颜色引用 CSS 设计系统 token，适配明暗主题：

| 用途 | Token/色值 | 说明 |
|------|------------|------|
| 主色 | `var(--hp-primary)` | 电光橙，适配明暗主题 |
| 传送门激活态 | 主色 + 白色光晕脉冲 | 按钮激活动效 |
| 传输中渐变 | `var(--hp-primary)` → 琥珀 | 数据传输 |
| 克隆完成 | `var(--hp-success)` + 主色光晕 | 成功态 |

---

## 2. 功能设计与用户流程

### 2.1 功能范围

| 能力 | 说明 | 优先级 |
|------|------|--------|
| 基础克隆 | 支持 HTTPS / SSH / git@ 三种格式 | P0 |
| 分支/标签选择 | 克隆时可指定分支或标签（统一用 `--branch` 参数），或使用默认 | P0 |
| 浅克隆（Shallow） | 支持 `--depth` 参数，节省时间和空间 | P0 |
| 目标目录选择 | 可自定义克隆到哪个目录，默认当前目录 | P0 |
| 私有仓库认证 | 支持 Username+Password / Token / SSH Key | P1 |
| 克隆历史 | 记录最近克隆的仓库 URL，一键重新克隆（P1: localStorage，P2: 后端存储） | P1 |
| 收藏仓库 | 将常用仓库标记为收藏，快速访问（P1: localStorage，P2: 后端存储） | P1 |
| URL 智能解析 | 自动识别 GitHub/GitLab/Bitbucket URL，预填仓库名和默认分支 | P2 |

### 2.2 入口设计

**入口 1：文件管理器工具栏**

- 位置：工具栏"上传"按钮右侧，新增"传送门"按钮
- 图标：传送门图标（同心菱形）
- 桌面端：按钮显示 icon + 文字 "Git Portal"
- 移动端：底部工具栏新增 icon，文字显示"克隆"

**入口 2：新建会话流程**

- 位置：新建会话选择目录步骤中，增加"从 Git 传送"卡片选项
- 卡片样式：传送门图标 + "Git Portal" 标题 + "从远程仓库克隆"副标题
- 点击后进入全屏克隆流程，克隆完成自动回到新建会话并填入目录

### 2.3 核心用户流程（2+1 模式）

根据评审反馈，将原 4 步流程合并为 **2+1 模式**：URL 输入（含折叠配置）→ 传送进度 → 结果。

```
[入口触发]
    │
    ▼
Step 1: 输入 URL + 折叠配置（单页面）
  ┌─────────────────────────────────┐
  │ 粘贴 Git URL（自动聚焦）         │  ← 主区域
  │ URL 有效后自动解析仓库名/平台    │
  │                                 │
  │ 最近传送 / 收藏（历史卡片）      │  ← 辅助区域
  │                                 │
  │ ▸ 高级选项                      │  ← 默认折叠
  │   · 目标目录（默认当前目录）    │
  │   · 分支/标签（默认分支）       │
  │   · 克隆深度（完整克隆）        │
  │ ▸ 仓库认证（仅私有仓库时展示）  │
  │   · 用户名 + 密码（默认）       │
  │   · 或 Token（可切换）          │
  │                                 │
  │ [⚡ 开始传送]                    │  ← 主 CTA
  └─────────────────────────────────┘
    │ 点击 [开始传送]
    ▼
Phase 2: 传送进度
  阶段1: 传输中（动态进度）
  阶段2: 传送完成（定格）
    │ 成功
    ▼
Phase 3: 完成引导
  ✓ 传送完成!
  · 仓库名 / 分支 / 大小
  · [开启 AI 会话] (主 CTA)
  · [打开目录] (次要)
  · ⭐ 收藏（右上角图标按钮）
```

**80% 的用户**只需粘贴 URL → 点击"开始传送"→ 两步完成。高级用户展开配置修改选项。

### 2.4 桌面端 vs 移动端差异

| 方面 | 桌面端 | 移动端 |
|------|--------|--------|
| 入口形式 | 工具栏按钮 | 底部工具栏图标 + 新建会话卡片 |
| 主界面 | 右侧滑入面板（420px宽） | 全屏页面 |
| Step 1 | 单面板，配置/认证默认折叠 | 全屏页面，配置/认证默认折叠 |
| Phase 2 | 面板内嵌进度展示 | 全屏沉浸式（含取消按钮） |
| Phase 3 | 面板底部结果卡片 | 全屏结果页 + 大CTA按钮 |

### 2.5 克隆完成后行为

克隆完成后弹出提示"基于这个新项目开一个新会话"，用户可以选择：
- 点击主 CTA "开启 AI 会话" → 跳转新建会话页面，自动填入克隆目录
- 点击"打开目录" → 在文件管理器中打开克隆目录
- 关闭面板 → 相当于只克隆到目录，刷新目录列表，用户自行决定下一步
- 克隆完成后 `auth` 字段立即从内存中清除

### 2.6 并发与取消

| 场景 | 行为 |
|------|------|
| 并发克隆 | 每台机器同时最多 1 个 clone 操作，后续请求排队等待 |
| 克隆进行中关闭面板 | 桌面端：面板关闭但克隆在后台继续；移动端：弹出确认"传送尚未完成，确定关闭吗？" |
| 取消克隆 | Phase 2 始终显示"取消传送"按钮，点击后弹出确认并终止 git 进程 |
| 面板重新打开 | 如果有正在进行的克隆，自动回到 Phase 2 |

---

## 3. UI 界面设计

### 3.1 桌面端 — 右侧滑入面板

**默认状态（配置折叠）：**

```
┌──────────────────────────────┐
│  ✕         Git Portal        │  ← 顶栏：关闭 | 标题
│──────────────────────────────│
│                              │
│  ┌────────────────────────┐  │
│  │ 🔗  粘贴 Git 仓库地址   │  │  ← URL 输入框（自动聚焦）
│  └────────────────────────┘  │
│                              │
│  最近传送                     │  ← 历史记录区（最多2条 + "查看更多"）
│  ┌──────┐ ┌──────┐          │
│  │ 📦   │ │ 📦   │          │
│  │repo-1│ │repo-2│          │
│  └──────┘ └──────┘          │
│                              │
│  ▸ 高级选项                  │  ← 默认折叠，点击展开
│                              │
│  (克隆中时此区域变为进度区)   │
│                              │
│  ┌────────────────────────┐  │
│  │     ⚡ 开始传送         │  │  ← 主 CTA，电光橙按钮
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**展开高级选项后：**

```
│  ▾ 高级选项                  │
│  将克隆到 /current/path      │  ← 折叠摘要行
│  目标目录  [/current/path] ▾ │
│  分支      [默认        ▾]  │
│  深度      [完整克隆    ▾]  │
│                              │
│  ▸ 仓库认证                  │  ← 仅 URL 识别为私有仓库时显示
│  🔒 需要认证                 │
│  用户名 [               ]    │
│  密码   [••••••••      ] 👁  │
│  ▸ 使用 Token 认证           │
```

### 3.2 移动端 — 全屏页面

**Step 1（URL + 折叠配置）：**

```
┌────────────────────────┐  ← padding-top: env(safe-area-inset-top)
│  ✕                      │
│────────────────────────│
│                        │
│    ┌──────────────┐    │
│    │   ◇◇ 传送门   │    │  ← 品牌 Logo（静态图标，非动画）
│    └──────────────┘    │
│                        │
│  Git Portal            │
│  通向你的代码宇宙       │
│                        │
│  ┌──────────────────┐  │
│  │ 🔗  粘贴仓库地址  │  │  ← 大输入框，圆角 12px
│  └──────────────────┘  │
│                        │
│  最近传送               │  ← 纵向列表（最多3条）
│  ┌──────────────────┐  │
│  │ 📦 user/repo-1   │  │
│  └──────────────────┘  │
│                        │
│  ▸ 高级选项             │  ← 折叠，点击展开
│  ▸ 仓库认证             │  ← 仅私有仓库时展示
│                        │
│                        │
│  ┌──────────────────┐  │
│  │  ⚡ 开始传送      │  │  ← 底部固定，URL有效时激活
│  └──────────────────┘  │  ← padding-bottom: env(safe-area-inset-bottom)
└────────────────────────┘
```

**Phase 2：传送进度（全屏）：**

```
┌────────────────────────┐
│  ✕          取消传送    │  ← 始终可见的取消按钮
│────────────────────────│
│                        │
│                        │
│      (进度动画区)       │  ← 正常模式：SVG动画
│                        │     reduced-motion：纯进度条
│                        │
│  正在传输数据...        │  ← aria-live="polite" 文字
│  12.4 MB               │
│  ━━━━━━━━━━━░░░░░░░░   │  ← 进度条
│                        │
│                        │
└────────────────────────┘
```

**Phase 3：完成引导：**

```
┌────────────────────────┐
│                        │
│         ◇✦◇    ⭐     │  ← 成功图标 + 收藏按钮(右上角)
│                        │
│    传送完成!            │
│    user/project        │
│    main · 12.4 MB      │
│                        │
│  ┌──────────────────┐  │
│  │  🤖 开启 AI 会话  │  │  ← 主 CTA，电光橙
│  └──────────────────┘  │
│  打开目录               │  ← 文字链接/描边按钮
│                        │
└────────────────────────┘
```

### 3.3 空状态设计

**无历史记录：**
```
│                    │
│    ◇ (淡色传送门)  │  ← 传送门图标淡化 40% 透明度
│                    │
│  还没有传送记录     │
│  粘贴 Git 仓库地址  │
│  开始第一次传送     │
│                    │
```

**无收藏：**
```
│  ⭐ (淡色)         │
│  还没有收藏的仓库   │
│  克隆完成后可以收藏 │
│  常用仓库          │
```

**克隆失败：**
```
│  ◇ (变红 + 微振动) │  ← 传送门图标闪红
│                    │
│  传送失败           │
│  具体错误信息       │
│                    │
│  [重试]  [切换Token]│  ← GitHub 等平台时显示
│                    │
```

**首次使用（无历史无收藏）：**
```
│  快速开始           │
│  粘贴一个 GitHub    │
│  仓库地址试试       │
│                    │
│  热门示例：         │  ← 可选：展示 2-3 个知名开源项目
│  📦 facebook/react  │
│  📦 vuejs/core      │
```

### 3.4 交互规格

| 交互 | 桌面端 | 移动端 |
|------|--------|--------|
| URL 输入 | 自动聚焦，粘贴后实时校验 | 同桌面端 + 剪贴板粘贴提示 |
| URL 校验 | 实时校验，颜色 + 图标（对勾/叉号） | 同桌面端 |
| 历史记录 | 横向卡片，默认 2 条 + "查看更多" | 纵向列表，默认 3 条 |
| 高级选项 | 默认折叠为一行摘要 | 同桌面端 |
| 认证区域 | 仅私有仓库时展示 | 同桌面端 |
| 进度展示 | 面板内嵌 | 全屏沉浸式 + 始终可见取消按钮 |
| 完成操作 | 面板底部主 CTA + 文字链接 | 全屏结果页 |
| 收藏操作 | 右上角星标图标按钮 | 同桌面端 |

### 3.5 可访问性（a11y）规格

| 方面 | 规格 |
|------|------|
| SVG 动画 | `aria-hidden="true"`，独立 `aria-live="polite"` 区域播报进度文字 |
| 阶段切换 | `aria-live="polite"` 播报状态变化 |
| 传送完成 | `aria-live="assertive"` 播报"传送完成" |
| URL 校验 | 颜色 + 图标双提示，不依赖颜色传达信息 |
| 颜色对比度 | 所有文本色值满足 WCAG AA 4.5:1（两种主题下验证） |
| 焦点管理 | 面板打开→焦点移入；步骤切换→焦点移至新内容首个可交互元素；关闭→焦点回到触发按钮 |
| 焦点陷阱 | 桌面面板内 Tab 循环，不跳到背后内容 |
| 屏幕阅读器 | 按钮有描述性 `aria-label`；进度百分比通过 sr-only 文字更新 |

### 3.6 键盘导航

| 按键 | 行为 |
|------|------|
| `Tab` | URL 输入 → 历史卡片 → 高级选项折叠按钮 → 开始传送按钮 |
| `Escape` | 关闭面板/全屏页面（克隆中时弹出确认） |
| `Enter`（URL 输入框） | URL 有效时等同于点击"开始传送" |
| `Phase 2` | `Tab` 焦点直接到取消按钮 |

### 3.7 移动端 safe-area

| 位置 | 处理 |
|------|------|
| 全屏页面顶栏 | `padding-top: max(var(--hp-space-3), env(safe-area-inset-top))` |
| 全屏页面底部按钮 | `padding-bottom: max(var(--hp-space-4), env(safe-area-inset-bottom))` |
| 全屏容器 | `height: 100dvh`（动态视口高度，避免软键盘问题） |
| PWA 状态栏 | 可通过 `<meta name="theme-color">` 动态更新颜色 |

### 3.8 移动端手势

| 手势 | 作用 |
|------|------|
| 内容区右滑（非边缘） | 返回/关闭（不占用 iOS 左边缘系统手势区域） |
| 下拉（Step1 内容区） | 关闭 Git Portal（不从屏幕顶部触发，避免与通知中心冲突） |
| 点击遮罩（桌面面板外） | 关闭面板 |

---

## 4. 认证体系设计

### 4.1 核心原则

**账号密码优先，Token 作为可切换的进阶选项。** 普通用户第一眼看到熟悉"账号密码"，无学习成本；GitHub 等不支持密码的平台会友好引导到 Token 模式。

### 4.2 认证策略

```
用户输入 URL
    │
    ├─ SSH 格式 (git@...)
    │   → 自动识别：使用 SSH Key（服务器已配置）
    │
    └─ HTTPS 协议
        → 默认展示：用户名 + 密码
        → 可切换至：Token 模式
        → 两种方式后端都支持
```

### 4.3 智能平台提示

输入 URL 识别出平台后，在密码输入框下方显示浅色提示文字：

| 平台 | 提示文案 |
|------|----------|
| GitHub | "GitHub 已不支持密码认证，建议使用 Token" → 可点击切换到 Token 模式 |
| GitLab | "输入你的 GitLab 用户名和密码" |
| Bitbucket | "输入你的 Bitbucket 用户名和 App Password" |
| 未知平台 | "输入仓库的用户名和密码" |

提示文字**不强制**，仅建议。用户仍可尝试密码，失败后再引导。

### 4.4 认证 UI — 密码模式（默认）

```
│  🔒 需要认证
│  GitHub 私有仓库          ← 识别出平台时显示
│  用户名  [            ]
│  密码    [••••••••    ] 👁
│  ▸ 使用 Token 认证        ← 点击切换
```

### 4.5 认证 UI — Token 模式（可切换）

```
│  🔒 需要认证
│  GitHub 私有仓库
│  Token   [••••••••    ] 👁
│  ? 如何获取 GitHub Token  ← 平台帮助链接
│  ▸ 使用账号密码           ← 切回密码模式
```

### 4.6 后端认证实现

**重要：不使用 URL embed 凭据方式**（评审发现存在凭据残留 `.git/config`、进程参数泄露等问题）。

采用 `GIT_ASKPASS` 环境变量方式注入凭据：

| 用户输入 | 后端处理 |
|----------|----------|
| 用户名 + 密码 | 写入临时 ASKPASS 脚本 → `GIT_ASKPASS=/tmp/gp-askpass-{cloneId}.sh git clone https://host/repo.git` → clone 后删除脚本 |
| 用户名 + Token | 同上，密码字段传 Token |
| 仅 Token | ASKPASS 脚本中无用户名参数 |
| SSH URL | `git clone git@host:repo.git`（使用已有 SSH Key） |

ASKPASS 脚本示例：
```bash
#!/bin/sh
echo "${GP_CLONE_PASSWORD}"
```

执行流程：
1. 写入临时脚本到 `/tmp/gp-askpass-{cloneId}.sh`，设置 `chmod 600`
2. 设置环境变量 `GP_CLONE_PASSWORD`、`GIT_ASKPASS`、`GIT_TERMINAL_PROMPT=0`
3. 执行 `git clone`（URL 不含凭据）
4. clone 完成/失败后立即删除脚本 + 清除环境变量
5. clone 成功后执行 `git -C <dir> remote set-url origin <clean-url>` 确保 remote URL 不含凭据

### 4.7 错误时的智能引导

| 场景 | 处理方式 |
|------|----------|
| 第一次认证失败 | 提示"认证失败，请检查凭据"，高亮密码框，可重试 |
| GitHub/GitLab 密码失败 | 额外提示"推荐使用 Token" + [一键切换到 Token 模式] 按钮 |
| SSH Key 不存在 | 提示"服务器未找到对应的 SSH 公钥" + 配置引导 |
| 网络不通（内网 Git） | 提示"无法连接到服务器" + 重试按钮 |

### 4.8 安全设计

| 策略 | 说明 |
|------|------|
| 不使用 URL embed 凭据 | 避免凭据残留在 `.git/config`、进程参数、Git 错误输出中 |
| ASKPASS 临时脚本 | clone 完成后立即删除，权限 600 |
| 凭据仅存内存 | Token/密码仅存前端内存，clone 完成后立即清除 `auth` 字段，不等页面关闭 |
| 密码框默认隐藏 | `type="password"`，可切换显示 |
| HTTPS 传输 | 所有凭据通过 HTTPS 发送到 Hub |
| 全路径脱敏 | 所有输出路径（日志、SSE、HTTP 响应、RPC 传输）中的 URL 做凭据脱敏：`url.replace(/:\/\/[^@]+@/, '://***@')` |
| Hub→CLI 传输 | auth 字段作为独立 RPC 参数传递，不嵌入 URL，不在 Socket.IO 日志中记录 |
| SSRF 防护 | 目标地址不允许指向私有网络（RFC 1918）、回环地址（127.x）、链路本地（169.254.x）、云元数据 API |
| 速率限制 | `POST /machines/:id/git-clone` 每分钟最多 5 次；每台机器同时最多 1 个 clone 操作 |
| 磁盘预检 | clone 前检查可用磁盘空间 |
| URL 验证 | 拒绝 `file://` 协议；拒绝 URL 中直接包含凭据（`user:pass@`）；强制通过 `auth` 字段传递 |
| targetDir 路径沙箱 | 机器级 clone 的 `targetDir` 必须在允许的工作目录范围内 |
| 禁止错误上报含凭据 | 错误上报/遥测中禁止包含 auth state |

---

## 5. 传送动画设计

### 5.1 技术方案

纯 CSS 动画 + SVG，不依赖第三方动画库。

### 5.2 传送进度（简化为两阶段）

**阶段 1 — 传输中（动态进度）**

- 传送门图标（菱形）在画面中心，边框微光脉冲
- 下方进度条 + 百分比文字，颜色 `var(--hp-primary)`
- 进度文字通过 `aria-live="polite"` 播报
- 底部显示已传输大小，每秒更新
- 左上角始终显示"取消传送"按钮

**阶段 2 — 传送完成（定格）**

- 传送门图标扩大 1.1 倍，边框发光 `box-shadow` 白色光晕
- 中心对勾 `stroke-dashoffset` 绘制动画，500ms `cubic-bezier(0.34, 1.56, 0.64, 1)` 弹性缓动
- 颜色：`var(--hp-success)` 门框 + `var(--hp-primary)` 光晕
- 光晕脉冲 2 次后定格

### 5.3 `prefers-reduced-motion` 降级方案

```css
@media (prefers-reduced-motion: reduce) {
  /* 禁用所有 SVG 动画 */
  .gp-portal-animation * {
    animation: none !important;
    transition: none !important;
  }
  /* 仅显示静态进度条 + 百分比文字 */
  .gp-progress-bar { display: block; }
  .gp-portal-svg { display: none; }
  /* 完成态仅为静态对勾图标 */
  .gp-success-check { opacity: 1; }
}
```

### 5.4 低端设备检测

通过 `navigator.hardwareConcurrency` 和 `navigator.deviceMemory`（如可用）判断：
- `hardwareConcurrency <= 2` 或 `deviceMemory <= 2`：使用简化动画（仅进度条，无 SVG 粒子）
- 其他设备：使用完整动画

### 5.5 页面过渡动效

| 过渡 | 方向 | 时长 | 缓动 |
|------|------|------|------|
| 桌面面板滑入 | 右→左 | 300ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| 桌面面板滑出 | 左→右 | 250ms | `ease-in` |
| 移动端 Step1→Phase2 | 淡入淡出 | 200ms | `ease` |
| 移动端 Phase2→Phase3 | 下→上推入 | 300ms | `ease-out` |
| 结果页→关闭 | 缩放淡出 | 200ms | `ease-in` |

### 5.6 动效规格

| 动效 | 时长 | 缓动 | 说明 |
|------|------|------|------|
| URL 校验反馈 | 150ms | ease | 边框颜色 + 图标变化 |
| 历史卡片悬停 | 100ms | ease | 微上浮 + 阴影增强 |
| 成功对勾出现 | 500ms | cubic-bezier(0.34, 1.56, 0.64, 1) | 弹性缩放（CSS 近似 spring） |
| 收藏星标动画 | 300ms | ease-out | 旋转 + 缩放 |
| 按钮 CTA 脉冲 | 2000ms | ease-in-out | 完成后微光脉冲循环 |
| 失败图标振动 | 400ms | ease-in-out | 图标水平微振 3 次 |

### 5.7 响应式断点

| 断点 | 行为 |
|------|------|
| ≥768px | 桌面端：右侧滑入面板模式 |
| <768px | 移动端：全屏页面模式 |
| <480px | 按钮全宽，历史列表隐藏到"展开更多" |

---

## 6. 后端 API 设计

### 6.1 新增/增强 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/machines/:id/git-clone` | 机器级克隆（文件管理器入口） |
| `POST` | `/sessions/:id/git-clone` | 会话级克隆（已有，增强参数） |

历史/收藏 P1 使用 localStorage 存储，不新增 REST 端点。P2 阶段视需求增加后端存储。

### 6.2 增强 Git Clone 请求参数

```typescript
interface GitCloneRequest {
  url: string                    // 必须是合法 Git URL，不含凭据
  targetDir?: string
  branch?: string                // 分支或标签名（Git 用 --branch 统一处理）
  depth?: number                 // 克隆深度，1=浅克隆
  cloneId: string                // 幂等标识 + 进度关联 + 取消引用
  auth?: {
    type: 'password' | 'token' | 'ssh'
    username?: string
    password?: string            // 密码或 Token
    sshKeyRef?: string           // SSH 密钥引用（预留）
  }
}
```

URL 验证规则（`validateCloneUrl` 增强）：
- 拒绝 `file://` 协议
- 拒绝 URL 中包含 `user:pass@` 格式的凭据
- 解析 hostname，拒绝私有/回环/链路本地地址（SSRF 防护）
- 仅允许 `https://`、`git@`、`ssh://` 三种格式

### 6.3 增强响应

```typescript
interface GitCloneResponse {
  success: boolean
  error?: string                 // 已脱敏
  stderr?: string                // 已脱敏
  clonedPath?: string
  repoInfo?: {
    name: string
    branch: string
    sizeBytes: number
    fileCount: number
    remoteUrl: string            // 已脱敏（不含凭据）
  }
}
```

### 6.4 流式进度推送

**现有问题**：`clone:progress` 事件在 CLI→Hub 有转发，但 Hub→Web 通路缺失。

**修复方案**：

1. 在 Hub 的 Socket.IO handler 中注册 `clone:progress` 监听器
2. 将事件通过 SSE 转发给 Web 端（纳入 `SyncEvent` 类型体系或新增 `broadcastRaw` 方法）
3. 在 `useSSE.ts` 中增加 `clone:progress` 事件处理
4. 前端通过 `useCloneProgress(cloneId)` hook 订阅进度

```typescript
type CloneProgressEvent =
  | { phase: 'connecting'; message: string }     // 已脱敏
  | { phase: 'transferring'; bytesReceived: number; bytesTotal?: number }
  | { phase: 'unpacking'; filesExtracted: number }
  | { phase: 'done'; repoInfo: RepoInfo }
  | { phase: 'error'; error: string }            // 已脱敏
```

后端解析 `git clone --progress` 的 stderr（确保 `LANG=C`），所有输出通过 `sanitizeGitUrl()` 脱敏后再推送。

断线恢复：clone RPC 的最终 response 包含完整结果，作为 SSE 断线后的 backup。

### 6.5 机器级克隆 RPC 支持

现有 `gitClone` 方法仅 session-scoped。新增方案：

- 在 `RPC_METHODS` 中新增 `MachineGitClone` 方法
- CLI handler 新增 machine-scope 的 clone handler
- `SyncEngine` 新增 `gitCloneMachine(machineId, ...)` 方法，通过 `machineRpc` 调用
- `targetDir` 必须通过路径沙箱校验

### 6.6 速率限制与资源配额

| 限制 | 值 |
|------|-----|
| 克隆频率 | 每台机器每分钟最多 5 次 clone 请求 |
| 并发克隆 | 每台机器同时最多 1 个 clone 操作 |
| 克隆超时 | 600 秒（保持现有值） |
| 磁盘预检 | clone 前检查可用磁盘空间 > 预估仓库大小 × 1.5 |

---

## 7. 前端组件架构

### 7.1 新增文件清单

```
web/src/
├── components/
│   ├── GitPortal/
│   │   ├── GitPortal.tsx           # 主容器：桌面面板 / 移动全屏
│   │   ├── GitPortalStepInput.tsx  # Step1: URL + 历史/收藏 + 折叠配置 + 认证
│   │   ├── GitPortalProgress.tsx   # Phase2: 进度展示（SVG动画/降级进度条）
│   │   ├── GitPortalResult.tsx     # Phase3: 完成引导
│   │   ├── GitPortalAuth.tsx       # 认证输入（密码/Token 切换）
│   │   ├── GitPortalHistory.tsx    # 历史记录 + 收藏
│   │   ├── GitPortalEmptyState.tsx # 空状态组件（无历史/无收藏/失败/首次）
│   │   ├── GitPortalAnimation.tsx  # SVG 传送动画（含 reduced-motion 降级）
│   │   └── useGitClone.ts          # Hook: 克隆状态 + 进度订阅
├── styles/
│   └── git-portal.css               # 动画 keyframes + reduced-motion + 响应式
└── lib/
    ├── git-portal-api.ts            # API 封装：clone + 流式进度
    └── git-portal-storage.ts        # localStorage 封装：历史 + 收藏（P1）
```

### 7.2 GitPortal 组件 Props

```typescript
interface GitPortalProps {
  isOpen: boolean
  onClose: () => void
  api: ApiClient | null
  machineId: string | null
  sessionId?: string | null
  currentPath?: string              // 默认 targetDir
  onCloneComplete?: (clonedPath: string) => void  // 触发 FileManager reload
}
```

### 7.3 组件关系

```
FileManager.tsx ── toolbar "Git Portal" ──┐
                                          ▼
                                    GitPortal.tsx (主容器)
                                    ├─ 桌面: 右侧面板
                                    └─ 移动: 全屏页面
                                        │
                                        ├─ GitPortalStepInput (Step1)
                                        │   ├─ URL 输入 + 智能解析
                                        │   ├─ GitPortalHistory
                                        │   │   └─ GitPortalEmptyState
                                        │   ├─ 高级选项（折叠）
                                        │   │   ├─ 目录选择器 (复用 TransferDirectoryPicker)
                                        │   │   └─ 分支/深度选择
                                        │   └─ GitPortalAuth
                                        │       ├─ 账号密码 (默认)
                                        │       └─ Token (可切换)
                                        │
                                        ├─ GitPortalProgress (Phase2)
                                        │   └─ GitPortalAnimation (含降级)
                                        │
                                        └─ GitPortalResult (Phase3)
                                            ├─ 仓库信息
                                            ├─ [开启 AI 会话] (主 CTA)
                                            ├─ [打开目录] (次要)
                                            └─ ⭐ 收藏 (右上角图标)

NewSession ── "从 Git 导入"卡片 ── GitPortal (onCloneComplete 回调回 NewSession)
```

### 7.4 状态管理 (useGitClone Hook)

```typescript
type ClonePhase =
  | 'input'          // Step1
  | 'connecting'     // Phase2-1
  | 'transferring'   // Phase2-2
  | 'unpacking'      // Phase2-3
  | 'done'           // Phase3
  | 'error'          // 失败

interface CloneState {
  phase: ClonePhase
  url: string
  parsedRepo: { platform, owner, repo, host } | null
  config: {
    targetDir: string
    branch: string
    depth: number | null
  }
  auth: {
    type: 'password' | 'token' | 'ssh'
    username: string
    password: string
  } | null
  progress: {
    bytesReceived: number
    bytesTotal?: number
    message: string
  }
  result: {
    clonedPath: string
    repoInfo: RepoInfo
  } | null
  error: string | null
}

// clone 完成后自动清除 auth
// phase === 'done' || phase === 'error' → auth = null
```

### 7.5 localStorage 存储方案（P1）

```typescript
// git-portal-storage.ts

interface CloneHistoryEntry {
  id: string
  url: string                       // 脱敏后（前端保存前做 sanitizeGitUrl）
  platform: 'github' | 'gitlab' | 'bitbucket' | 'other'
  repoName: string
  targetDir: string
  branch?: string
  isFavorite: boolean
  lastClonedAt: string              // ISO 时间
  cloneCount: number
}

// Key: `git-portal-history:${namespace}`
// 最多 20 条历史，超过时移除最旧的
// 收藏不会被自动移除
```

### 7.6 后端文件变更清单

```
hub/src/web/routes/git.ts              # 新增机器级克隆路由 + 速率限制
hub/src/sync/syncEngine.ts             # 新增 gitCloneMachine + clone:progress 转发
hub/src/socket/handlers/cli/index.ts   # 注册 clone:progress 监听 + SSE 转发
shared/src/rpcMethods.ts               # 新增 MachineGitClone RPC 方法
cli/src/modules/common/handlers/git.ts # 增强 clone（ASKPASS + --depth + --branch + LANG=C）
web/src/api/client.ts                  # 新增 gitCloneMachine 方法
web/src/hooks/useSSE.ts                # 增加 clone:progress 事件处理
```

---

## 8. 国际化（i18n）

使用 `gitPortal.*` 前缀作为独立翻译命名空间。`gitPortal.*` 完全替代现有 `git.clone.*`，旧键在迁移完成后下个版本删除。

### 8.1 命名规范

- 遵循 `namespace.section.key` 三级结构
- 平台提示统一为 `gitPortal.auth.hint.*`
- 工具栏按钮使用 `gitPortal.toolbar.button`

### 8.2 完整翻译键列表

**品牌与标题**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.name` | Git Portal | Git 传送门 |
| `gitPortal.slogan` | Portal to your code universe | 通向你的代码宇宙 |
| `gitPortal.description` | Clone any Git repository and start coding with AI in seconds | 克隆任意 Git 仓库，秒级开启 AI 编程之旅 |

**入口按钮**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.toolbar.button` | Git Portal | Git 传送门 |
| `gitPortal.mobileBtn` | Clone | 克隆 |
| `gitPortal.sessionCard.title` | Import from Git | 从 Git 导入 |
| `gitPortal.sessionCard.desc` | Clone a remote repository and start a new session | 克隆远程仓库并开启新会话 |

**Step 1 — URL 输入**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.url.placeholder` | Paste Git repository URL | 粘贴 Git 仓库地址 |
| `gitPortal.url.invalid` | Please enter a valid Git URL | 请输入有效的 Git 地址 |
| `gitPortal.url.supported` | Supports HTTPS, SSH, and git@ formats | 支持 HTTPS、SSH 和 git@ 格式 |
| `gitPortal.url.detected` | Detected {platform} repository {owner}/{repo} | 检测到 {platform} 仓库 {owner}/{repo} |
| `gitPortal.history.title` | Recent portals | 最近传送 |
| `gitPortal.history.empty` | No recent clones | 暂无克隆记录 |
| `gitPortal.history.more` | Show more | 查看更多 |
| `gitPortal.history.clear` | Clear history | 清除历史 |
| `gitPortal.favorites.title` | Favorites | 收藏 |
| `gitPortal.favorites.empty` | No favorite repositories yet | 还没有收藏的仓库 |
| `gitPortal.advancedOptions` | Advanced options | 高级选项 |
| `gitPortal.start` | Start portal | 开始传送 |

**配置**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.config.title` | Clone settings | 克隆设置 |
| `gitPortal.config.targetProject` | Target project | 目标项目 |
| `gitPortal.config.cloneTo` | Clone to directory | 克隆到目录 |
| `gitPortal.config.changeDir` | Change directory | 更改目录 |
| `gitPortal.config.branch` | Branch | 分支 |
| `gitPortal.config.branch.default` | Default branch ({branch}) | 默认分支 ({branch}) |
| `gitPortal.config.depth` | Clone depth | 克隆深度 |
| `gitPortal.config.depth.full` | Full clone | 完整克隆 |
| `gitPortal.config.depth.shallow` | Shallow (latest commit only) | 浅克隆（仅最新提交） |
| `gitPortal.config.depth.custom` | Custom depth | 自定义深度 |

**认证**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.auth.title` | Authentication | 仓库认证 |
| `gitPortal.auth.privateRepo` | {platform} private repository | {platform} 私有仓库 |
| `gitPortal.auth.required` | This repository requires authentication | 此仓库需要认证 |
| `gitPortal.auth.username` | Username | 用户名 |
| `gitPortal.auth.usernamePlaceholder` | Enter username | 输入用户名 |
| `gitPortal.auth.password` | Password | 密码 |
| `gitPortal.auth.passwordPlaceholder` | Enter password | 输入密码 |
| `gitPortal.auth.token` | Token | Token |
| `gitPortal.auth.tokenPlaceholder` | Enter access token | 输入访问令牌 |
| `gitPortal.auth.usePassword` | Use username & password | 使用账号密码 |
| `gitPortal.auth.useToken` | Use Token | 使用 Token |
| `gitPortal.auth.hint.github` | GitHub no longer supports password auth. Recommend using a Personal Access Token | GitHub 已不支持密码认证，建议使用 Personal Access Token |
| `gitPortal.auth.hint.gitlab` | Enter your GitLab username and password | 输入你的 GitLab 用户名和密码 |
| `gitPortal.auth.hint.bitbucket` | Enter your Bitbucket username and App Password | 输入你的 Bitbucket 用户名和 App Password |
| `gitPortal.auth.hint.generic` | Enter repository username and password | 输入仓库的用户名和密码 |
| `gitPortal.auth.howToToken` | How to get a {platform} Token | 如何获取 {platform} Token |
| `gitPortal.auth.sshDetected` | Using configured SSH key | 使用服务器已配置的 SSH 密钥 |
| `gitPortal.auth.sshCustom` | Specify custom SSH key | 指定自定义密钥 |
| `gitPortal.auth.showPassword` | Show password | 显示密码 |
| `gitPortal.auth.hidePassword` | Hide password | 隐藏密码 |

**传送进度**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.progress.connecting` | Connecting to {host}... | 正在连接 {host}... |
| `gitPortal.progress.transferring` | Transferring data... {received} | 正在传输数据... {received} |
| `gitPortal.progress.transferringWithTotal` | Transferring data... {received} / {total} | 正在传输数据... {received} / {total} |
| `gitPortal.progress.unpacking` | Unpacking project files... | 正在解包项目文件... |
| `gitPortal.progress.filesExtracted` | {count} files extracted | 已解包 {count} 个文件 |
| `gitPortal.progress.filesExtracted.one` | 1 file extracted | 已解包 1 个文件 |
| `gitPortal.progress.cancel` | Cancel portal | 取消传送 |
| `gitPortal.progress.cancelling` | Cancelling... | 正在取消... |

**完成页**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.result.success` | Portal complete! | 传送完成! |
| `gitPortal.result.repoInfo` | {repo} / {branch} / {size} | {repo} / {branch} / {size} |
| `gitPortal.result.fileCount` | {count} files | {count} 个文件 |
| `gitPortal.result.fileCount.one` | 1 file | 1 个文件 |
| `gitPortal.result.openDir` | Open directory | 打开目录 |
| `gitPortal.result.startSession` | Start AI session | 开启 AI 会话 |
| `gitPortal.result.favorite` | Star this repo | 收藏此仓库 |
| `gitPortal.result.unfavorite` | Remove from favorites | 取消收藏 |
| `gitPortal.result.favorited` | Added to favorites | 已收藏 |

**空状态**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.empty.noHistory.title` | No portal history yet | 还没有传送记录 |
| `gitPortal.empty.noHistory.hint` | Paste a Git repository URL to start your first portal | 粘贴 Git 仓库地址开始第一次传送 |
| `gitPortal.empty.noFavorites.title` | No favorite repositories | 还没有收藏的仓库 |
| `gitPortal.empty.noFavorites.hint` | Star a repository after cloning to add it here | 克隆完成后可以收藏常用仓库 |
| `gitPortal.empty.firstUse.title` | Quick start | 快速开始 |
| `gitPortal.empty.firstUse.hint` | Paste a GitHub repository URL to try it out | 粘贴一个 GitHub 仓库地址试试 |

**确认对话框**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.confirm.cancelClone` | Cancel portal? Transferred data will be lost. | 确定取消传送？已传输的数据将丢失。 |
| `gitPortal.confirm.closeDuringClone` | Portal in progress. Close anyway? | 传送尚未完成，确定关闭吗？ |

**Toast**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.toast.cloneStarted` | Portal started | 传送已开始 |
| `gitPortal.toast.dirRefreshed` | Directory refreshed | 目录已刷新 |
| `gitPortal.toast.favorited` | Added to favorites | 已添加到收藏 |
| `gitPortal.toast.unfavorited` | Removed from favorites | 已取消收藏 |
| `gitPortal.toast.historyCleared` | Clone history cleared | 克隆历史已清除 |

**错误**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.error.authFailed` | Authentication failed. Please check your credentials | 认证失败，请检查凭据 |
| `gitPortal.error.tokenExpired` | Token may have expired | Token 可能已过期 |
| `gitPortal.error.networkError` | Cannot connect to server | 无法连接到服务器 |
| `gitPortal.error.dirExists` | Directory already exists. Choose a different path | 目录已存在，请选择其他路径 |
| `gitPortal.error.diskFull` | Not enough disk space. Estimated size: {size} | 磁盘空间不足。预估大小: {size} |
| `gitPortal.error.sshKeyMissing` | No matching SSH key found on the server | 服务器未找到对应的 SSH 公钥 |
| `gitPortal.error.retry` | Retry | 重试 |
| `gitPortal.error.switchToToken` | Switch to Token authentication | 切换到 Token 认证 |

**加载态**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.loading.history` | Loading clone history... | 正在加载克隆历史... |
| `gitPortal.loading.branches` | Loading branches... | 正在加载分支列表... |
| `gitPortal.loading.validating` | Validating URL... | 正在校验地址... |

**无障碍**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.a11y.historyList` | Recent clone history | 最近克隆历史 |
| `gitPortal.a11y.progressAnimation` | Clone progress animation | 克隆进度动画 |
| `gitPortal.a11y.urlInput` | Enter a Git repository URL to clone | 输入要克隆的 Git 仓库地址 |

### 8.3 RTL 预留

当前仅支持中英双语。后续版本如需支持 RTL 语言（阿拉伯语等），需：
- 新组件使用 CSS logical properties（`margin-inline-start` 而非 `margin-left`）
- SVG 动画中的方向性元素（箭头、数据流方向）需支持翻转
- 步骤导航箭头在 RTL 中自动翻转

---

## 9. 需更新的现有内容

实施阶段需同步更新以下内容：

| 更新项 | 说明 |
|--------|------|
| 文件管理器工具栏 | 新增 "Git Portal" 按钮 |
| 文件管理器移动端底部栏 | 新增"克隆"图标按钮 |
| 新建会话流程 | 新增"从 Git 导入"卡片 |
| 现有 GitCloneDialog.tsx | 替换为 GitPortal 组件 |
| 现有 `git.clone.*` 翻译键 | 迁移到 `gitPortal.*` 命名空间，旧键标记 deprecated |
| Hub clone:progress 转发 | 新增 Hub→Web 进度推送通路 |
| CLI git.ts validateCloneUrl | 增加 SSRF 防护、凭据检测 |
| CLI git.ts runGitCloneStreaming | 修复 cwd 问题、增加 ASKPASS 支持、设置 LANG=C |

### 9.1 README 品牌建设

**英文 README 新增：**

```markdown
### Git Portal

Clone any Git repository and start coding with AI in seconds. Paste a URL,
walk through the portal, and your code is ready on the workbench.

- Supports HTTPS, SSH, and git@ formats
- Branch, tag, and shallow clone options
- Private repository authentication (password, token, or SSH key)
- Smart platform detection for GitHub, GitLab, and Bitbucket
```

**中文 README 新增：**

```markdown
### Git 传送门

克隆任意 Git 仓库，秒级开启 AI 编程之旅。把 URL 扔进门里，代码就到了你的工作台。

- 支持 HTTPS、SSH 和 git@ 格式
- 可选分支、标签和浅克隆
- 私有仓库认证（密码、Token 或 SSH 密钥）
- 智能识别 GitHub、GitLab 和 Bitbucket
```

---

## 附录 A：评审修订记录

v1.0 → v1.1 修订内容（基于架构/UX/安全/i18n 四维评审）：

| 修订项 | 变更 |
|--------|------|
| 认证方案 | URL embed → `GIT_ASKPASS` + clone 后清理 |
| 用户流程 | 4 步 → 2+1（URL含折叠配置 → 进度 → 结果） |
| 动画设计 | 4 阶段 → 2 阶段，新增 `prefers-reduced-motion` 降级 + 低端设备检测 |
| 空状态设计 | 新增 4 种空状态（无历史/无收藏/克隆失败/首次使用） |
| 可访问性 | 新增 a11y 规格（SVG ARIA、键盘导航、焦点管理、焦点陷阱） |
| 安全加固 | SSRF 防护、全路径脱敏、速率限制、磁盘预检、路径沙箱 |
| 存储策略 | 历史/收藏 P1 用 localStorage，P2 再迁后端 |
| 翻译键 | 从 ~55 个扩展到 ~90 个，补全加载态/空状态/Toast/确认/无障碍等 |
| 中文翻译 | 修正 slogan、认证提示、错误信息等 |
| 图标设计 | 菱形旋转角度 15° → 8°，颜色改用 CSS 变量适配主题 |
| 移动端 | safe-area 完整覆盖，手势改为非边缘触发，进度页始终显示取消按钮 |
| 并发控制 | 每台机器同时最多 1 个 clone，速率限制每分钟 5 次 |
