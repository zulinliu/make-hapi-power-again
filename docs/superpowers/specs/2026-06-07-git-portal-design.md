# Git Portal — Git 传送门 设计文档

> **状态**: 已确认，待实施
> **日期**: 2026-06-07
> **版本**: v1.0

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
| ZH | **传送你的代码宇宙** |

与主品牌"随时AI，编程自在"呼应。

### 1.3 功能一句话介绍

| 语言 | 介绍 |
|------|------|
| EN | _Clone any Git repository and start coding with AI in seconds._ |
| ZH | _克隆任意 Git 仓库，秒级开启 AI 编程之旅。_ |

### 1.4 功能图标（Icon）设计概念

延续力量几何设计语言，图标由**两个同心菱形**构成：

- 外菱形：代表传送门框架（稳定的几何基座）
- 内菱形：微旋转 15°，代表能量在门内涌动
- 中心：一条竖向短线，代表"Git 分支"穿越传送门
- 颜色：电光橙 `oklch(68% 0.18 55)` 主色

视觉上类似"发光的几何门框"，与主品牌 Logo 的"能量台"概念形成系列感——Logo 是"台"，Portal 是"门"。

### 1.5 品牌文化叙事

> Hapi Power 的核心承诺是"随时AI，编程自在"。Git Portal 是这个承诺的延伸——无论你的代码在哪里，传送门都能把它带到你的工作台。
>
> Portal 不是一个技术操作，而是一次"传送"。用户不需要关心 git 命令的细节，只需要知道：把 URL 扔进门里，代码就到了。
>
> 每次克隆都是一次传送，历史记录就是你的"传送日志"。

### 1.6 品牌色彩

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 | `oklch(68% 0.18 55)` | 电光橙，与主品牌一致 |
| 传送门激活态 | 橙 + 白色光晕脉冲 | 按钮激活动效 |
| 克隆阶段-连接 | 橙色闪烁 | 连接中 |
| 克隆阶段-传输 | 橙 → 琥珀渐变流动 | 数据传输 |
| 克隆阶段-解包 | 琥珀 → 绿过渡 | 文件解包 |
| 克隆完成 | 翠绿 `oklch(55% 0.15 155)` + 橙色门框亮起 | 成功态 |

---

## 2. 功能设计与用户流程

### 2.1 功能范围

| 能力 | 说明 | 优先级 |
|------|------|--------|
| 基础克隆 | 支持 HTTPS / SSH / git@ 三种协议的 URL | P0 |
| 分支/标签选择 | 克隆时可指定分支、标签，或使用默认 | P0 |
| 浅克隆（Shallow） | 支持 `--depth` 参数，节省时间和空间 | P0 |
| 目标目录选择 | 可自定义克隆到哪个目录，默认当前目录 | P0 |
| 私有仓库认证 | 支持 Username+Password / Token / SSH Key | P1 |
| 克隆历史 | 记录最近克隆的仓库 URL，一键重新克隆 | P1 |
| 收藏仓库 | 将常用仓库标记为收藏，快速访问 | P1 |
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

### 2.3 核心用户流程

```
[入口触发]
    │
    ▼
Phase 1: 输入 URL
  · 粘贴 Git URL（自动聚焦）
  · 最近传送（历史卡片）
  · 收藏仓库（星标卡片）
  · URL 有效后自动解析仓库名/平台
    │
    ▼
Phase 2: 配置选项
  · 目标目录（目录选择器）
  · 分支/标签（可选）
  · 克隆深度（可选）
  · 认证信息（按需展示：账号密码优先，可切换 Token）
    │ 点击 [开始传送]
    ▼
Phase 3: 传送动画
  阶段1: 连接建立
  阶段2: 数据传输
  阶段3: 项目解包
  阶段4: 传送完成
    │ 成功
    ▼
Phase 4: 完成引导
  ✓ 传送成功!
  · 仓库名 / 分支 / 大小
  · 打开目录
  · 开启 AI 会话 (主 CTA)
  · 收藏此仓库
```

### 2.4 桌面端 vs 移动端差异

| 方面 | 桌面端 | 移动端 |
|------|--------|--------|
| 入口形式 | 工具栏按钮 | 底部工具栏图标 + 新建会话卡片 |
| 主界面 | 右侧滑入面板（420px宽） | 全屏页面 |
| Phase 1-2 | 合并为一个面板，上下排列 | 分步全屏页面，底部"下一步" |
| Phase 3 | 面板内嵌动画 | 全屏沉浸式动画 |
| Phase 4 | 面板底部结果卡片 | 全屏结果页 + 大CTA按钮 |

### 2.5 克隆完成后行为

克隆完成后弹出提示"基于这个新项目开一个新会话"，用户可以选择：
- 点击主 CTA "开启 AI 会话" → 跳转新建会话页面，自动填入克隆目录
- 点击"打开目录" → 在文件管理器中打开克隆目录
- 关闭面板 → 相当于只克隆到目录，刷新目录列表，用户自行决定下一步

---

## 3. UI 界面设计

### 3.1 桌面端 — 右侧滑入面板

```
┌──────────────────────────────┐
│  ◀ 返回    Git Portal    ··· │  ← 顶栏：返回(关闭) | 标题 | 更多(历史)
│──────────────────────────────│
│                              │
│  ┌────────────────────────┐  │
│  │ 🔗  粘贴 Git 仓库地址   │  │  ← URL 输入框（自动聚焦）
│  │     https://github... │  │     placeholder 有微光脉冲动画
│  └────────────────────────┘  │
│                              │
│  最近传送                     │  ← 历史记录区（最多3条）
│  ┌──────┐ ┌──────┐ ┌──────┐│
│  │ 📦   │ │ 📦   │ │ 📦   ││  ← 横向小卡片，点击自动填入URL
│  │repo-1│ │repo-2│ │repo-3││
│  └──────┘ └──────┘ └──────┘│
│                              │
│  ── 传送配置 ────────────── │  ← 可折叠配置区
│  目标目录  [/current/path] ▾│
│  分支      [默认        ▾]  │
│  深度      [完整克隆    ▾]  │
│                              │
│  ── 仓库认证 ────────────── │  ← 智能认证区
│  🔒 需要认证                 │
│  用户名 [               ]    │
│  密码   [••••••••      ] 👁  │
│  ▸ 使用 Token 认证           │  ← 可切换
│                              │
│  ┌────────────────────────┐  │
│  │     ⚡ 开始传送         │  │  ← 主 CTA，电光橙按钮
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

### 3.2 移动端 — 全屏分步页面

**Step 1：输入 URL**

```
┌────────────────────────┐
│  ✕                  ← │  ← 顶栏：关闭按钮
│────────────────────────│
│                        │
│    ┌──────────────┐    │
│    │   ◇ ◇ 传送门  │    │  ← 品牌 Logo 动画（菱形微旋转）
│    │    图标动画    │    │
│    └──────────────┘    │
│                        │
│  Git Portal            │  ← 品牌名
│  传送你的代码宇宙       │  ← Slogan，小字灰色
│                        │
│  ┌──────────────────┐  │
│  │ 🔗  粘贴仓库地址  │  │  ← 大输入框，圆角 12px
│  └──────────────────┘  │
│                        │
│  最近传送               │  ← 纵向列表
│  ┌──────────────────┐  │
│  │ 📦 user/repo-1   │  │  ← 点击直接填入
│  ├──────────────────┤  │
│  │ 📦 user/repo-2   │  │
│  └──────────────────┘  │
│                        │
│  ┌──────────────────┐  │
│  │   下一步  →      │  │  ← 底部固定按钮，URL有效时激活
│  └──────────────────┘  │
└────────────────────────┘
```

**Step 2：配置选项**

```
┌────────────────────────┐
│  ← 返回    传送配置    │
│────────────────────────│
│  目标项目              │
│  ┌──────────────────┐  │
│  │ user/project     │  │
│  └──────────────────┘  │
│  克隆到目录            │
│  ┌──────────────────┐  │
│  │ /home/user/      │ ▸│  ← 点击打开目录浏览器
│  └──────────────────┘  │
│  分支选择              │
│  ┌──────────────────┐  │
│  │ 默认分支(main)   │ ▸│
│  └──────────────────┘  │
│  克隆深度              │
│  ○ 完整克隆            │
│  ● 浅克隆 (最近1次提交) │
│  ○ 自定义深度 [  ]     │
│  ── 仓库认证 ──────── │
│  🔒 需要认证           │
│  用户名 [           ]  │
│  密码   [••••••••  ] 👁│
│  ▸ 使用 Token 认证     │
│                        │
│  ┌──────────────────┐  │
│  │  ⚡ 开始传送      │  │
│  └──────────────────┘  │
└────────────────────────┘
```

**Phase 4：完成引导**

```
┌────────────────────────┐
│                        │
│         ◇✦◇           │  ← 成功动画停留
│                        │
│    传送成功!            │
│    user/project        │
│    main · 12.4 MB      │
│                        │
│  ┌──────────────────┐  │
│  │ ⭐ 收藏此仓库     │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │  🤖 开启 AI 会话  │  │  ← 主 CTA
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │  📂 打开目录      │  │
│  └──────────────────┘  │
│                        │
└────────────────────────┘
```

### 3.3 交互规格

| 交互 | 桌面端 | 移动端 |
|------|--------|--------|
| URL 输入 | 自动聚焦，粘贴后实时校验 | 同桌面端 + 剪贴板粘贴提示 |
| URL 校验 | 输入时实时校验，绿/红边框 | 同桌面端 |
| 历史记录 | 横向卡片，最多 3 条 | 纵向列表，最多 5 条 |
| 目录选择 | 内嵌折叠式目录树 | 全屏目录浏览器（复用 TransferDirectoryPicker） |
| 进度动画 | 面板内嵌，半高展示 | 全屏沉浸式 |
| 完成操作 | 面板底部 3 个按钮 | 全屏结果页大按钮 |

---

## 4. 认证体系设计

### 4.1 核心原则

**账号密码优先，Token 作为可切换的进阶选项。** 普通用户第一眼看到熟悉"账号密码"，无学习成本；GitHub 等不支持密码的平台会友好引导到 Token 模式。

### 4.2 认证策略

```
用户输入 URL
    │
    ├─ SSH 协议 (git@...)
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

| 用户输入 | 后端处理 |
|----------|----------|
| 用户名 + 密码 | `git clone https://user:password@host/repo.git` |
| 用户名 + Token | `git clone https://user:token@host/repo.git`（与密码同一处理逻辑） |
| 仅 Token | `git clone https://token@host/repo.git` |
| SSH URL | `git clone git@host:repo.git`（使用已有 SSH Key） |

### 4.7 错误时的智能引导

| 场景 | 处理方式 |
|------|----------|
| 第一次认证失败 | 提示"用户名或密码错误"，高亮密码框，可重试 |
| GitHub/GitLab 密码失败 | 额外提示"推荐使用 Token" + [一键切换到 Token 模式] 按钮 |
| SSH Key 不存在 | 提示"服务器未找到对应的 SSH 公钥" + 配置引导 |
| 网络不通（内网 Git） | 提示"无法连接到服务器" + 重试按钮 |

### 4.8 安全设计

| 策略 | 说明 |
|------|------|
| 不持久化密码 | Token/密码仅存内存，页面关闭即清除 |
| 密码框默认隐藏 | `type="password"`，可切换显示 |
| HTTPS 传输 | 所有凭据通过 HTTPS 发送到 Hub |
| 日志脱敏 | 后端日志中 URL 部分如含凭据则自动脱敏 |

---

## 5. 传送动画设计

### 5.1 技术方案

纯 CSS 动画 + SVG，不依赖第三方动画库，保证移动端性能。

### 5.2 阶段 1 — 连接建立（约 2-3s）

- 两个菱形从两侧滑入，间距 120px
- 菱形之间出现虚线连接线，`stroke-dashoffset` 动画实现"画线"效果
- 连接线上有 3 个橙色脉冲点沿线流动，`@keyframes` 循环 1.5s
- 文字："正在连接 github.com..."

### 5.3 阶段 2 — 数据传输（主体时间）

- 菱形之间生成 8 条平行路径（数据流管道）
- 粒子沿路径流动，颜色 `oklch(68% 0.18 55)` → `oklch(70% 0.14 75)` 渐变
- 粒子速度与实际传输字节关联
- 底部显示已传输大小，每秒更新

### 5.4 阶段 3 — 项目解包（约 1-2s）

- 中心出现文件夹轮廓，`scale(0) → scale(1)` 弹性动画
- 文件夹打开后内部逐行展开文件树（最多 6 行），每行延迟 80ms
- 颜色从琥珀 `oklch(75% 0.12 85)` 渐变为翠绿 `oklch(55% 0.15 155)`

### 5.5 阶段 4 — 传送完成（定格）

- 菱形扩大 1.2 倍，边框发光 `box-shadow` 白色光晕
- 中心对勾 `stroke-dashoffset` 绘制动画，500ms spring 缓动
- 光晕脉冲循环 2 次，定格为静态成功态
- 颜色：翠绿门框 + 橙色光晕

### 5.6 页面过渡动效

| 过渡 | 方向 | 时长 | 缓动 |
|------|------|------|------|
| 桌面面板滑入 | 右→左 | 300ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| 桌面面板滑出 | 左→右 | 250ms | `ease-in` |
| 移动端 Step1→Step2 | 左→右推入 | 280ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| 移动端 Step2→动画 | 淡入淡出 | 200ms | `ease` |
| 移动端 动画→结果 | 下→上推入 | 300ms | `ease-out` |
| 结果页→关闭 | 缩放淡出 | 200ms | `ease-in` |

### 5.7 动效规格

| 动效 | 时长 | 缓动 | 说明 |
|------|------|------|------|
| 面板滑入 | 300ms | ease-out | 桌面端面板从右滑入 |
| 页面切换 | 250ms | ease-in-out | 移动端分步页面横向滑动 |
| URL 校验反馈 | 150ms | ease | 边框颜色变化 |
| 历史卡片悬停 | 100ms | ease | 微上浮 + 阴影增强 |
| 传送动画阶段切换 | 400ms | cubic-bezier(0.4,0,0.2,1) | 平滑过渡 |
| 成功对勾出现 | 500ms | spring(1, 80, 10) | 弹性缩放 |
| 收藏星标动画 | 300ms | ease-out | 星标旋转 + 放大后缩小 |
| 按钮 CTA 脉冲 | 2000ms | ease-in-out | 完成后主按钮微光脉冲循环 |

### 5.8 移动端手势

| 手势 | 作用 |
|------|------|
| 右滑（从左边缘） | 返回上一步 |
| 下拉（在 Step1） | 关闭 Git Portal |
| 点击空白区域（桌面面板外） | 关闭面板 |

### 5.9 响应式断点

| 断点 | 行为 |
|------|------|
| ≥768px | 桌面端：右侧滑入面板模式 |
| <768px | 移动端：全屏分步页面模式 |
| <480px | 按钮全宽，历史列表隐藏到"展开更多" |

---

## 6. 后端 API 设计

### 6.1 新增 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/machines/:id/git-clone` | 机器级克隆（文件管理器入口） |
| `POST` | `/sessions/:id/git-clone` | 会话级克隆（已有，增强参数） |
| `GET` | `/machines/:id/git-clone/history` | 获取克隆历史 |
| `POST` | `/machines/:id/git-clone/history` | 保存/更新克隆历史条目 |
| `DELETE` | `/machines/:id/git-clone/history/:entryId` | 删除历史条目 |
| `POST` | `/machines/:id/git-clone/favorite` | 添加收藏 |
| `DELETE` | `/machines/:id/git-clone/favorite/:url` | 取消收藏 |

### 6.2 增强 Git Clone 请求参数

```typescript
interface GitCloneRequest {
  url: string
  targetDir?: string
  branch?: string
  tag?: string              // 新增：指定标签
  depth?: number            // 新增：克隆深度，1=浅克隆
  cloneId: string
  auth?: {                  // 新增：认证信息
    type: 'password' | 'token' | 'ssh'
    username?: string       // password/token 模式需要
    password?: string       // 密码或 Token
    sshKeyRef?: string      // SSH 密钥引用（预留）
  }
}
```

### 6.3 增强响应

```typescript
interface GitCloneResponse {
  success: boolean
  error?: string
  stderr?: string
  clonedPath?: string       // 实际克隆到的路径
  repoInfo?: {              // 仓库信息
    name: string
    branch: string
    sizeBytes: number
    fileCount: number
    remoteUrl: string
  }
}
```

### 6.4 流式进度（增强现有能力）

```typescript
type CloneProgressEvent =
  | { phase: 'connecting'; message: string }
  | { phase: 'transferring'; bytesReceived: number; bytesTotal?: number }
  | { phase: 'unpacking'; filesExtracted: number }
  | { phase: 'done'; repoInfo: RepoInfo }
  | { phase: 'error'; error: string }
```

后端通过 SSE 或 WebSocket 推送进度，解析 `git clone --progress` 的 stderr 输出。

### 6.5 克隆历史数据模型

```typescript
interface CloneHistoryEntry {
  id: string
  url: string               // 原始 URL（脱敏后存储）
  platform: 'github' | 'gitlab' | 'bitbucket' | 'other'
  repoName: string
  targetDir: string
  branch?: string
  isFavorite: boolean
  lastClonedAt: string      // ISO 时间
  cloneCount: number
}
```

### 6.6 RPC 层变更

- `shared/src/rpcMethods.ts` 新增 `GitCloneHistory`、`GitCloneFavorite`
- `cli/src/modules/common/handlers/git.ts` 增强 `git clone` 命令参数（`--depth`、`--branch`、`--tag`、`--progress`）

---

## 7. 前端组件架构

### 7.1 新增文件清单

```
web/src/
├── components/
│   ├── GitPortal/
│   │   ├── GitPortal.tsx           # 主容器：桌面面板 / 移动全屏路由
│   │   ├── GitPortalStepUrl.tsx     # Step1: URL 输入 + 历史/收藏
│   │   ├── GitPortalStepConfig.tsx  # Step2: 配置 + 认证
│   │   ├── GitPortalProgress.tsx    # Phase3: 传送动画
│   │   ├── GitPortalResult.tsx      # Phase4: 完成引导
│   │   ├── GitPortalAuth.tsx        # 认证输入组件（密码/Token 切换）
│   │   ├── GitPortalHistory.tsx     # 历史记录卡片列表
│   │   ├── GitPortalAnimation.tsx   # 纯 SVG 传送动画组件
│   │   └── useGitClone.ts          # Hook: 克隆状态管理 + 进度订阅
├── styles/
│   └── git-portal.css               # 传送动画 keyframes + 响应式样式
└── lib/
    └── git-portal-api.ts            # API 封装：clone / history / favorite
```

### 7.2 组件关系

```
FileManager.tsx ── toolbar "Git Portal" ──┐
                                          ▼
                                    GitPortal.tsx (主容器)
                                    ├─ 桌面: 单面板内切 Phase
                                    └─ 移动: 全屏分步路由
                                        ├─ GitPortalStepUrl
                                        │   ├─ URL 输入框
                                        │   ├─ GitPortalHistory
                                        │   └─ URL 智能解析
                                        ├─ GitPortalStepConfig
                                        │   ├─ 目录选择器 (复用 TransferDirectoryPicker)
                                        │   ├─ 分支/深度选择
                                        │   └─ GitPortalAuth
                                        │       ├─ 账号密码模式 (默认)
                                        │       └─ Token 模式 (可切换)
                                        ├─ GitPortalProgress
                                        │   └─ GitPortalAnimation (SVG)
                                        └─ GitPortalResult
                                            ├─ 仓库信息
                                            ├─ [开启 AI 会话] (主 CTA)
                                            ├─ [打开目录]
                                            └─ [收藏此仓库]

NewSession ── "从 Git 导入"卡片 ── GitPortal.tsx (克隆完成后回调回 NewSession)
```

### 7.3 状态管理

```typescript
type ClonePhase =
  | 'input'          // Step1: URL 输入
  | 'config'         // Step2: 配置
  | 'connecting'     // Phase3-1
  | 'transferring'   // Phase3-2
  | 'unpacking'      // Phase3-3
  | 'done'           // Phase4: 完成
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
```

### 7.4 后端文件变更清单

```
hub/src/web/routes/git.ts              # 新增机器级克隆路由 + 历史路由
hub/src/sync/syncEngine.ts             # 增强 gitClone + 流式进度
shared/src/rpcMethods.ts               # 新增 RPC 方法
cli/src/modules/common/handlers/git.ts # 增强 git clone 命令参数
```

---

## 8. 国际化（i18n）

使用 `gitPortal.` 前缀作为独立翻译命名空间。

### 8.1 完整翻译键列表

**品牌与标题**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.name` | Git Portal | Git 传送门 |
| `gitPortal.slogan` | Portal to your code universe | 传送你的代码宇宙 |
| `gitPortal.description` | Clone any Git repository and start coding with AI in seconds | 克隆任意 Git 仓库，秒级开启 AI 编程之旅 |

**入口按钮**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.toolbarBtn` | Git Portal | Git 传送门 |
| `gitPortal.mobileBtn` | Clone | 克隆 |
| `gitPortal.sessionCard.title` | Import from Git | 从 Git 导入 |
| `gitPortal.sessionCard.desc` | Clone a remote repository and start a new session | 克隆远程仓库并开启新会话 |

**Step 1 — URL 输入**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.url.placeholder` | Paste Git repository URL | 粘贴 Git 仓库地址 |
| `gitPortal.url.invalid` | Please enter a valid Git URL | 请输入有效的 Git 地址 |
| `gitPortal.url.supported` | Supports HTTPS, SSH, and git@ protocols | 支持 HTTPS、SSH、git@ 协议 |
| `gitPortal.history.title` | Recent portals | 最近传送 |
| `gitPortal.history.empty` | No recent clones | 暂无克隆记录 |
| `gitPortal.favorites.title` | Favorites | 收藏 |
| `gitPortal.next` | Next | 下一步 |

**Step 2 — 配置**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.config.title` | Clone settings | 传送配置 |
| `gitPortal.config.targetProject` | Target project | 目标项目 |
| `gitPortal.config.cloneTo` | Clone to directory | 克隆到目录 |
| `gitPortal.config.branch` | Branch | 分支 |
| `gitPortal.config.branch.default` | Default branch ({branch}) | 默认分支 ({branch}) |
| `gitPortal.config.depth` | Clone depth | 克隆深度 |
| `gitPortal.config.depth.full` | Full clone | 完整克隆 |
| `gitPortal.config.depth.shallow` | Shallow (latest commit only) | 浅克隆（仅最新提交） |
| `gitPortal.config.depth.custom` | Custom depth | 自定义深度 |
| `gitPortal.config.start` | Start portal | 开始传送 |

**认证**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.auth.title` | Authentication | 仓库认证 |
| `gitPortal.auth.privateRepo` | {platform} private repository | {platform} 私有仓库 |
| `gitPortal.auth.username` | Username | 用户名 |
| `gitPortal.auth.password` | Password | 密码 |
| `gitPortal.auth.token` | Token | Token |
| `gitPortal.auth.usePassword` | Use username & password | 使用账号密码 |
| `gitPortal.auth.useToken` | Use Token | 使用 Token |
| `gitPortal.auth.githubHint` | GitHub no longer supports password auth. Recommend using a Personal Access Token | GitHub 已不支持密码验证，推荐使用 Personal Access Token |
| `gitPortal.auth.gitlabHint` | Enter your GitLab username and password | 输入你的 GitLab 用户名和密码 |
| `gitPortal.auth.howToToken` | How to get a {platform} Token | 如何获取 {platform} Token |
| `gitPortal.auth.sshDetected` | Using configured SSH key | 使用服务器已配置的 SSH 密钥 |
| `gitPortal.auth.sshCustom` | Specify custom SSH key | 指定自定义密钥 |

**传送动画**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.progress.connecting` | Connecting to {host}... | 正在连接 {host}... |
| `gitPortal.progress.transferring` | Transferring data... {size} | 正在传输数据... {size} |
| `gitPortal.progress.unpacking` | Unpacking project files... | 正在解包项目文件... |
| `gitPortal.progress.done` | Portal complete! | 传送成功! |

**完成页**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.result.success` | Portal complete! | 传送成功! |
| `gitPortal.result.openDir` | Open directory | 打开目录 |
| `gitPortal.result.startSession` | Start AI session | 开启 AI 会话 |
| `gitPortal.result.favorite` | Star this repo | 收藏此仓库 |
| `gitPortal.result.favorited` | Added to favorites | 已收藏 |

**错误**

| 键 | EN | ZH |
|---|---|---|
| `gitPortal.error.authFailed` | Authentication failed. Please check your credentials | 认证失败，请检查用户名和密码 |
| `gitPortal.error.tokenExpired` | Token may have expired | Token 可能已过期 |
| `gitPortal.error.networkError` | Cannot connect to server | 无法连接到服务器 |
| `gitPortal.error.dirExists` | Directory already exists. Choose a different path | 目录已存在，请选择其他路径 |
| `gitPortal.error.diskFull` | Not enough disk space. Estimated size: {size} | 磁盘空间不足，预估大小: {size} |
| `gitPortal.error.sshKeyMissing` | No matching SSH key found on the server | 服务器未找到对应的 SSH 公钥 |
| `gitPortal.error.retry` | Retry | 重试 |
| `gitPortal.error.switchToToken` | Switch to Token authentication | 切换到 Token 认证 |

---

## 9. 需更新的现有内容

实施阶段需同步更新以下内容：

| 更新项 | 说明 |
|--------|------|
| 文件管理器工具栏 | 新增 "Git Portal" 按钮 |
| 文件管理器移动端底部栏 | 新增"克隆"图标按钮 |
| 新建会话流程 | 新增"从 Git 导入"卡片 |
| README.md | Features 章节增加 Git Portal 品牌描述 |
| README.zh-CN.md | 同步中文版 |
| 国际化文件 en.ts / zh-CN.ts | 新增 `gitPortal.*` 翻译键 |
| 现有 GitCloneDialog.tsx | 评估是否替换或共存（建议替换） |
| 现有 git.clone.* 翻译键 | 保留兼容或迁移到新命名空间 |
