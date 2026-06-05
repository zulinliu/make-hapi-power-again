# Git 管理规范

> 本文档为 Hapi Power 项目的 Git 管理永久约束规范。所有开发者（包括 AI Agent）必须识别、学习并强制遵守。

## 1. 作者规范

### 1.1 唯一作者

- 项目所有 commit、tag、release 的作者只能是 **zulinliu**
- Git 配置：`user.name = zulinliu`，`user.email` 为注册邮箱
- **禁止**在 commit message 中添加任何 `Co-Authored-By` 行
- **禁止**出现 `Co-Authored-By: HAPI`、`Co-Authored-By: Claude` 等任何第三方署名

### 1.2 Commit Message 中的品牌标识

- **禁止**添加 `via [HAPI](https://hapi.run)` 或类似第三方品牌链接
- **禁止**添加 `Generated with [Claude Code]` 或类似 AI 工具宣传
- Commit message 只关注变更内容本身，不附加工具归属

### 1.3 检查方法

```bash
# 检查是否有非 zulinliu 的作者
git log --all --format='%an <%ae>' | sort | uniq -c | sort -rn

# 检查是否有 Co-Authored-By 行
git log --all --grep='Co-Authored' --oneline

# 检查是否有 HAPI 品牌残留
git log --all --grep='via.*hapi\|hapi\.run' --oneline
```

## 2. 分支管理规范

### 2.1 命名格式

```
feat/v{major}.{minor}.{patch}
```

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能分支 | `feat/vX.Y.Z` | `feat/v0.13.0` |
| 补丁分支 | `feat/vX.Y.Z` | `feat/v0.12.2` |
| 开发分支 | `dev` | `dev` |
| 主分支 | `main` | `main` |

### 2.2 版本号规则

- **必须使用三位语义化版本号** (Semantic Versioning): `vMAJOR.MINOR.PATCH`
- **禁止**使用一位或两位版本号（如 `v1`、`v0.6`）
- MINOR 版本递增：新功能、功能改进
- PATCH 版本递增：Bug 修复、小优化、文档更新
- MAJOR 版本递增：不兼容的架构变更

### 2.3 分支生命周期

```
feat/vX.Y.Z (开发) → main (合并) → release (tag + GitHub Release)
```

1. 从 `main` 创建 `feat/vX.Y.Z` 分支
2. 在 `feat/vX.Y.Z` 上开发
3. 开发完成后合并到 `main`
4. 在 `main` 上打 tag `vX.Y.Z`
5. 基于 tag 发布 GitHub Release

### 2.4 分支清理

- 已合并到 `main` 并发布 Release 的功能分支可保留（作为版本历史记录）
- 不得删除 `main`、`dev` 分支
- 远程分支必须与本地分支保持同步

## 3. Commit 规范

### 3.1 格式

```
<type>: <description>
```

### 3.2 Type 枚举

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改变行为） |
| `docs` | 文档 |
| `test` | 测试 |
| `chore` | 构建/工具/依赖 |
| `perf` | 性能优化 |
| `style` | 代码风格（不影响逻辑） |
| `ci` | CI/CD 配置 |
| `release` | 版本发布 |

### 3.3 规则

- **使用中文描述**，简洁准确
- 首行不超过 72 字符
- 可在 body 中补充详细变更内容
- **禁止**包含第三方品牌标识或 AI 工具宣传链接
- **禁止**包含 `Co-Authored-By` 行

### 3.4 示例

```
feat: 供应商模型发现引擎 + 多协议探测
fix: iOS Safari 弹窗键盘弹出定位修复
docs: 更新 STATE.md v0.7 补丁修复记录
release(v0.12.1)
```

## 4. Tag 规范

### 4.1 命名格式

```
v{MAJOR}.{MINOR}.{PATCH}
```

- **必须**使用三位语义化版本号
- **禁止**使用 `v0.1`、`v0.6` 等非完整格式

### 4.2 Tag 指向

- 功能版本 tag 指向对应的 `feat/vX.Y.Z` 分支的 tip commit
- Patch 版本 tag 可指向 `main` 上的修复 commit

### 4.3 Tag 操作

```bash
# 创建 tag
git tag vX.Y.Z feat/vX.Y.Z

# 推送 tag
git push origin vX.Y.Z

# 删除错误 tag
git tag -d vX.Y.Z
git push origin --delete vX.Y.Z
```

## 5. Release 规范

### 5.1 命名格式

```
vX.Y.Z — 一句话摘要
```

示例：`v0.13.0 — 代码搜索与智能跳转`

### 5.2 Release Notes 格式

```markdown
# Hapi Power vX.Y.Z — 版本标题

## 新功能
- ...

## Bug 修复
- ...

## 变更统计
- X 文件, +Y/-Z 行
```

### 5.3 Release 规则

- 每个 `feat/vX.Y.Z` 分支必须对应一个 Release
- Release Notes **禁止**包含 `via [HAPI](https://hapi.run)` 或任何第三方品牌链接
- Release Notes **禁止**包含 `Generated with [Claude Code]` 等工具宣传
- 使用 `gh release create` 命令创建

```bash
gh release create vX.Y.Z --title "vX.Y.Z — 版本摘要" --notes "$(cat <<'EOF'
# Hapi Power vX.Y.Z — 版本标题
...
EOF
)"
```

## 6. 质量门禁

### 6.1 Commit 前检查清单

- [ ] 作者为 zulinliu
- [ ] 无 Co-Authored-By 行
- [ ] 无第三方品牌链接
- [ ] Commit message 格式正确
- [ ] 代码通过 typecheck
- [ ] 测试通过

### 6.2 Release 前检查清单

- [ ] 分支命名符合 `feat/vX.Y.Z` 格式
- [ ] Tag 使用三位版本号
- [ ] Release Notes 无品牌残留
- [ ] 所有 commit 作者正确

## 7. 违规处理

发现以下任何违规，必须立即修复：

1. **非 zulinliu 作者的 commit** → 修正作者信息
2. **Co-Authored-By 残留** → 重写 commit message（`git commit --amend`）
3. **非三位版本号** → 重命名分支/tag/release
4. **品牌标识残留** → 清理 commit message 或 release notes
5. **Tag 指向错误 commit** → 删除重建

## 8. 版本历史索引

| 版本 | 分支 | 主题 |
|------|------|------|
| v0.1.0 | feat/v0.1.0 | 首个发布版本 |
| v0.2.0 | feat/v0.2.0 | 体验优化 |
| v0.3.0 | feat/v0.3.0 | 品牌独立 |
| v0.4.0 | feat/v0.4.0 | PWA 深度优化 |
| v0.5.0 | feat/v0.5.0 | 核心开发者工作流 |
| v0.6.0 | feat/v0.6.0 | 生产就绪 + iOS PWA |
| v0.7.0 | feat/v0.7.0 | 自定义模型 API 配置 |
| v0.8.0 | feat/v0.8.0 | 技能管理重设计 |
| v0.9.0 | feat/v0.9.0 | UI 统一优化 |
| v0.10.0 | feat/v0.10.0 | 登录页 Claude 风格重设计 |
| v0.11.0 | feat/v0.11.0 | 文档重写 & Logo 设计 |
| v0.12.0 | feat/v0.12.0 | 功能精简与焦点聚焦 |
| v0.12.1 | main | Tab 刷新修复 + 清理补丁 |
