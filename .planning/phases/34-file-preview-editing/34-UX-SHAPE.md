---
phase: 34-file-preview-editing
feature_version: Phase 6.0
document: UX-SHAPE
status: draft-ready-for-review
created: 2026-06-06
skills:
  - impeccable shape file-preview
register: product
---

# Phase 6.0 UX Shape：File Preview / Editing

## 1. Feature Summary

File Preview / Editing 是 FileManager 的下一层核心工作面：用户从文件列表打开文件后，在同一个产品语境内查看、编辑、保存和恢复错误。它服务于移动端碎片时间查看、小改配置，以及桌面端轻量编辑，不追求 IDE 级复杂度，先把“打开 → 看懂 → 改动 → 保存 → 不丢内容”做可靠。

## 2. Primary User Action

用户最重要的动作是：**打开一个文件，判断它是否可编辑，如果编辑了，就安全保存或安全放弃。**

界面所有层级都要围绕这件事：路径和类型给定位，内容区域给判断，底部/顶部操作给保存和恢复。

## 3. Design Direction

- **Color strategy:** Restrained。延续 Hapi Power FileManager 的暖中性 + 电光橙主操作，仅在 Dirty、Error、Success 状态使用语义色。
- **Scene sentence:** 开发者在手机或桌面浏览器里远程查看服务器文件，通常处于专注但不想进入完整 IDE 的状态，环境光可能是移动端碎片时间或桌面暗色工作区，因此界面必须安静、清楚、低装饰。
- **Anchor references:** Linear 的状态清晰度、Raycast 的操作明确性、GitHub mobile file viewer 的阅读优先。
- **Per-surface override:** 不做“编辑器炫技界面”，不引入 VS Code 式多栏复杂布局。File Viewer 是 FileManager 的自然延伸，不是独立 IDE。

视觉方向探针跳过：当前 harness 没有原生 image generation 工具，本阶段输出结构化设计 brief。

## 4. Scope

| 维度 | 决策 |
|---|---|
| Fidelity | production-ready planning |
| Breadth | 一个文件查看/编辑 flow，覆盖 FileManager 打开入口 |
| Interactivity | shipped-quality component behavior |
| Time intent | 先完成垂直 MVP，再 harden/polish/audit |

## 5. Layout Strategy

### 桌面

- 使用单一内容面板或路由页面，不做复杂 split-pane。
- 顶部 header：返回/关闭、文件图标、文件名、路径、状态 badge、Copy path、Download。
- 第二层 mode bar：Preview / Edit / Diff（仅有 diff 时显示）。Dirty 状态在同一层右侧或编辑工具条中显示。
- 主内容区：根据类型切换 Markdown、Image、Code/Text、Binary state、Large-file state。
- 保存工具条：编辑模式中 sticky 在内容区顶部或底部，显示 Dirty、Save、Discard、Copy content。

### 移动端

- 全屏页面优先，避免半高 sheet 造成键盘和滚动冲突。
- Header 高度控制在 48–56px，路径单行截断，长路径可点击展开/复制。
- Save / Discard 等主操作固定在底部安全区，触控目标 ≥44px。
- 编辑区避免过密按钮，键盘弹出后仍可触达 Save。

## 6. Key States

| 状态 | 用户需要看到 | UX 要点 |
|---|---|---|
| Loading | 正在打开哪个文件 | skeleton 或 loading label，避免空白 |
| Preview ready | 文件内容、类型、路径 | 阅读优先，操作次级 |
| Edit ready | 可编辑内容和保存入口 | 明确“未修改/已修改” |
| Dirty | 有未保存改动 | persistent status，不靠颜色 alone |
| Saving | 保存中 | 禁用重复保存，保留文本 |
| Saved | 保存成功 | 短 toast/status，更新 dirty baseline |
| Save failed | 错误原因和恢复动作 | Retry、Copy content、Discard，绝不清空本地内容 |
| Load error | 加载失败 | Retry、Copy path、返回文件夹 |
| Empty file | 空文件可编辑 | 空状态不要误认为加载失败 |
| Markdown | 默认渲染预览 | Preview/Edit 清晰切换 |
| Image | 图片和下载 | 不出现编辑按钮 |
| Binary | 无法文本预览 | 下载/复制路径，说明原因 |
| Large file | 文件过大保护 | 只读/确认加载，说明阈值 |
| Read-only | 不能保存 | 禁用保存并解释 session/权限原因 |
| Leave dirty | 离开确认 | Stay / Discard，避免误丢改动 |

## 7. Interaction Model

### Open

1. 用户点击 FileManager 文件行主按钮。
2. 路由跳转到 `/sessions/$sessionId/file?path=<base64>` 或打开统一 Viewer 容器。
3. Viewer 加载内容并自动识别类型。

### Preview/Edit

- Markdown 默认 Preview，文本/代码默认 Preview 或 Edit 取决于后续实现，但 MVP 建议先 Preview，用户显式进 Edit。
- 图片无 Edit。
- 二进制和超大文件无默认 Edit。

### Save

1. 用户修改内容，Dirty 状态出现。
2. 点击 Save，按钮进入 loading。
3. 成功：更新 baseline，清 Dirty，toast/status。
4. 失败：保留本地内容，显示错误和 Retry。

### Leave

- Dirty 时关闭、返回、切换文件、切换目录、刷新页面均触发确认。
- Stay 保持当前页面和内容。
- Discard 放弃本地内容并继续原动作。

## 8. Content Requirements

### 新增文案 key 建议

| Key | English | 中文 |
|---|---|---|
| `file.viewer.title` | File viewer | 文件查看 |
| `file.viewer.loading` | Opening file… | 正在打开文件… |
| `file.viewer.preview` | Preview | 预览 |
| `file.viewer.edit` | Edit | 编辑 |
| `file.viewer.save` | Save changes | 保存修改 |
| `file.viewer.discard` | Discard changes | 放弃修改 |
| `file.viewer.dirty` | Unsaved changes | 有未保存修改 |
| `file.viewer.saved` | Changes saved | 修改已保存 |
| `file.viewer.saveFailed` | Failed to save changes | 保存修改失败 |
| `file.viewer.retrySave` | Retry save | 重试保存 |
| `file.viewer.copyContent` | Copy content | 复制内容 |
| `file.viewer.copyPath` | Copy path | 复制路径 |
| `file.viewer.download` | Download file | 下载文件 |
| `file.viewer.binary` | This file cannot be previewed as text. | 此文件无法作为文本预览。 |
| `file.viewer.large` | This file is large, preview is limited. | 文件较大，已限制预览。 |
| `file.viewer.leaveTitle` | Discard unsaved changes? | 要放弃未保存的修改吗？ |
| `file.viewer.leaveBody` | Your edits to {name} have not been saved. | 对 {name} 的修改尚未保存。 |

### Dynamic content ranges

- 文件名：1–255 chars，可能 CJK、emoji、无扩展名、dotfile。
- 路径：可能 10+ 层，必须截断/复制，不横向撑破。
- 文本：0 bytes 到 1MB MVP 编辑阈值。
- 错误：来自 RPC/Node error，可能很长，需换行和截断策略。

## 9. Recommended Implementation References

- `impeccable harden file-preview`：保存失败、dirty、二进制、大文件、只读、i18n。
- `impeccable polish file-preview`：移动端 header/bottom action、路径溢出、视觉节奏。
- `impeccable audit file-preview`：a11y、性能、响应式、theming、anti-patterns 终检。
- `gsd-add-tests`：为 file-utils、dirty guard、save failure、large/binary states 补测试。
- `gsd-code-review`：检查路径安全、hash/overwrite、状态竞态。

## 10. Open Questions

1. **Hash conflict detection:** 建议扩展 `FileReadResponse` 返回 hash/size/mtime，但 MVP 可先维持 force overwrite 并把冲突检测列为同阶段第二任务。
2. **Editor engine:** MVP 建议保留轻量 textarea，Phase 6.1 再接 Monaco/CodeMirror 深度编辑。
3. **Sensitive files:** `.env` 是否显示敏感提示待确认。

## 11. Shape Verdict

推荐按“垂直 MVP 先行”推进：先完成文本文件打开、编辑、保存、失败恢复、dirty 离开确认，再补 Markdown、图片、大文件和二进制 polish。不要在第一步就重构成完整 IDE，也不要引入复杂面板系统。
