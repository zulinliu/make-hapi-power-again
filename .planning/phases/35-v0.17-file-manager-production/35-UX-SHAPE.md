---
phase: 35-v0.17-file-manager-production
document: UX-SHAPE
version: v0.17.0
created: 2026-06-06
skill: impeccable
status: completed
---

# UX Shape: v0.17.0 文件管理器

## 1. Feature Summary

这是 Hapi Power 的生产级文件管理器，用于在浏览器中管理远程机器 workspace roots 内的项目文件。它服务于开发者和 AI 代理使用者，核心任务是快速定位、预览、编辑和整理文件，并从任意目录启动 AI 会话。

## 2. Primary User Action

用户最重要的动作是：在明确知道当前所在路径的前提下，对文件或目录执行真实操作，并在需要时打开文件完成预览或编辑。

## 3. Design Direction

- **Register**: product。
- **Color strategy**: Restrained。沿用 Hapi Power `--hp-*` 令牌，橙色只用于主操作、选中态和关键状态，不做装饰。
- **Scene sentence**: 开发者在手机或桌面浏览器中处理远程服务器项目文件，环境可能是碎片时间或夜间工作，界面必须冷静、可信、清晰，不打断任务流。
- **Anchor references**: Linear 的任务密度和状态清晰度，Raycast 的命令入口效率，Finder/iOS Files 的路径感和文件操作熟悉度。

## 4. Scope

- **Fidelity**: production-ready。
- **Breadth**: 全局文件管理页面，会话文件页面，文件预览编辑流程，移动端和桌面端。
- **Interactivity**: shipped-quality component，所有可见操作必须真实可用或明确不可用原因。
- **Time intent**: v0.17.0 版本内完成 P0 和关键 P1，后续能力有明确 backlog。

## 5. Layout Strategy

### 桌面端

1. 顶部为路径和操作栏：上一级、面包屑、隐藏文件、刷新、新建、上传、更多。
2. 主区域为当前目录列表，而不是强制树形。
3. 右侧或路由面板显示文件预览和编辑，避免文件点击无结果。
4. 多选后出现批量操作栏。

### 移动端

1. 顶部保留上一级和当前路径摘要。
2. 列表行为以单点触控为主，操作按钮可见。
3. 底部操作栏保留最高频动作：新建、上传、会话、更多。
4. 文件预览可使用独立路由或底部 sheet，但必须有清晰返回路径。

## 6. Key States

| 状态 | 用户需要看到 |
|---|---|
| Loading | 骨架屏，保留路径栏，避免页面跳动 |
| Empty | 空目录说明和新建文件/文件夹入口 |
| Error | 具体错误、重试、路径信息 |
| Machine offline | 离线原因和重新连接提示 |
| No workspace root | runner workspace root 配置引导 |
| Default listing | 文件名、类型、大小、修改时间、更多操作 |
| Hidden on | 开关高亮，dotfile 出现在列表中 |
| Selection | 被选中文件清晰，批量栏出现 |
| Operation running | 行级或按钮级 loading，防重复提交 |
| Operation success | toast 或 inline feedback，列表刷新 |
| Operation failed | 错误原因明确，保留用户输入 |
| Edit dirty | 未保存状态明显，离开确认 |
| Conflict | 外部修改冲突说明和可选动作 |
| Large/binary | 安全说明、下载、复制路径 |

## 7. Interaction Model

- 点击目录：进入目录。
- 点击文件：打开预览/编辑。
- 上一级：返回父目录。
- 面包屑：跳转到历史路径段。
- 新建：使用一个创建入口，可选择文件或文件夹。
- 更多：打开操作菜单，支持重命名、移动、复制、删除、下载、复制路径。
- 隐藏文件：立即刷新当前目录，不改变当前路径。
- 上传：默认上传到当前目录，目录行菜单可上传到指定目录。
- 保存文件：默认使用 expectedHash，冲突时不静默覆盖。

## 8. Content Requirements

### 核心标签

- 上一级
- 新建
- 新建文件
- 新建文件夹
- 上传文件
- 下载
- 移动到
- 复制到
- 重命名
- 删除
- 显示隐藏文件
- 隐藏隐藏文件
- 从此目录启动会话
- 保存更改
- 放弃更改
- 重新加载文件
- 强制覆盖

### 错误文案原则

错误文案必须说明三件事：发生了什么，为什么可能发生，用户下一步可以做什么。

示例：

- 路径不在 workspace root 内，文件管理器只能操作已授权的工作区目录。
- 文件已被外部修改，重新加载后再保存，或确认强制覆盖。
- 当前机器未连接，重新连接后可继续浏览文件。

## 9. Recommended Impeccable References

实施时使用：

- `layout.md`: 路径栏、列表、编辑面板和移动端结构。
- `adapt.md`: iOS 触控、安全区域、移动端底部栏。
- `clarify.md`: 操作标签、错误说明、确认弹窗。
- `harden.md`: 边界状态、失败恢复、可访问性。
- `polish.md`: 最终视觉和交互收口。
- `audit.md`: 阶段验收。

## 10. Open Questions Resolved By Decision

| 问题 | 决策 |
|---|---|
| 是否必须先有 session 才能管理文件 | 否，全局模式必须无需 session |
| 是否保留两个文件管理 UI | 否，收敛到统一核心 |
| Monaco 是否 P0 | 否，P0 先保证文件打开和安全保存，Monaco 属于 P1 |
| 目录下载是否 P0 | 否，单文件下载 P1，目录 zip P2 |
| 是否允许隐藏不可用按钮 | 不允许，v0.17 可见入口必须真实可用或明确禁用原因 |

