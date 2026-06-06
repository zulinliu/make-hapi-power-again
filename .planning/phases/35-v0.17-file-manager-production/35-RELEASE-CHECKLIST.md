---
phase: 35-v0.17-file-manager-production
document: RELEASE-CHECKLIST
version: v0.17.0
created: 2026-06-07
status: ready
---

# Release Checklist: v0.17.0 文件管理器生产化

## Git / 版本约束

- [x] 当前分支为 `feat/v0.17.0`
- [x] commit 作者配置为 `zulinliu <277557317@qq.com>`
- [x] commit message 使用中文描述
- [x] 未添加 `Co-Authored-By`
- [x] 未添加第三方品牌署名或旧品牌域名

## 功能验收

- [x] `/browse` 无活动会话也可浏览 workspaceRoots
- [x] 显性返回上一级按钮可用
- [x] 显示/隐藏文件开关真实触达 CLI machine list
- [x] 新建入口收敛为单一“新建”，弹窗选择文件/文件夹
- [x] 新建、删除、重命名、移动、复制均可在 machine mode 执行
- [x] `/sessions/:id/files?tab=directories` 复用统一 FileManager
- [x] `/browse` 点击文件打开 `/browse/file` 全局文件页
- [x] 全局和 session 文件页保存使用 `expectedHash`，不静默覆盖外部修改
- [x] 保存失败保留本地内容，并提供 retry / reload / force overwrite / copy recovery
- [x] 上传入口真实写入当前目录，支持进度和失败重试
- [x] 下载入口真实读取文件并生成浏览器 Blob 下载
- [x] 搜索支持当前目录名称过滤、递归名称搜索和递归内容搜索

## 安全边界

- [x] machine 文件操作限制在 workspaceRoots 内
- [x] 路径必须为绝对路径
- [x] null byte 被拒绝
- [x] workspace 外路径被拒绝
- [x] symlink escape 被拒绝
- [x] 上传默认不覆盖已有文件
- [x] 内容搜索跳过 1MB 以上文件，避免大文件读取压力

## 质量门禁

```bash
bun run typecheck
# PASS

bun run test:shared
# PASS: 37 tests

bun run test:hub
# PASS: 299 tests

bun run test:web
# PASS: 79 files, 672 tests

bun run test:cli
# PASS: 88 files passed, 1 skipped; 772 passed, 12 skipped

bun run test
# PASS: cli + hub + web + shared

bun run build
# PASS

scripts/brand-check.sh
# PASS

git diff --check
# PASS
```

## 非阻断风险

1. 上传仍是 5MB base64 writeFile 链路，后续大文件应改 multipart/streaming。
2. 内容搜索是轻量递归 list/read，不是 ripgrep 级性能，超大仓库需后续优化。
3. Monaco 懒加载未在本专项落地，当前采用 textarea 轻编辑兜底。
4. 目录 zip 下载、目录上传和覆盖确认未纳入 v0.17.0 阻断范围。
5. 搜索条提高了 FileManager 顶部高度，移动端后续可再做密度优化。

## 发布前动作

- [ ] 推送 `feat/v0.17.0`
- [ ] 由维护者确认是否立即合并 main
- [ ] 合并后创建 `v0.17.0` tag
- [ ] 创建 GitHub Release，Release Notes 禁止第三方品牌残留
