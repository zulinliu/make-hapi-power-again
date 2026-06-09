# Claude Code 项目工作规则

## Codegraph 强制使用规则（最高优先级）

本项目已集成 codegraph 代码图谱（`.codegraph/codegraph.db`），存储了所有符号、调用关系、文件依赖。Codegraph 是**预建索引**：读取是亚毫秒级，索引通过 file watcher 滞后写入约 1 秒。所有 codegraph MCP 工具已自动授权，调用不会弹权限框。

### 开始代码工作前必须做的（违反即视为重复劳动）

1. **健康检查**：会话开头调用 `codegraph_status` 确认图谱状态（文件数 / 节点数 / 边数 / 是否滞后）
2. **代码探索**：用 `codegraph_explore` 探索目标代码区域
   - 接受自然语言问题 **或** 符号/文件名列表
   - 返回相关符号的**源码**（Read 等价物，**单次调用通常足够**）
3. **符号定位**：仅找符号位置用 `codegraph_search`（返回位置不返回源码）
4. **影响评估**：编辑前用 `codegraph_impact` 评估改动会破坏哪些下游依赖
5. **调用关系**：分析"谁调用 X"用 `codegraph_callers`，"X 调用谁"用 `codegraph_callees`
6. **单个符号详情**：要看某个符号完整定义（含被截断的函数体、重载方法）用 `codegraph_node` 配合 `includeCode: true`

### 禁止行为

- ❌ 用 `grep + Read` 循环查找符号位置 — codegraph 已建索引，这是**重复劳动**
- ❌ Read 整个文件只为理解"X 是什么" — 用 `codegraph_node`
- ❌ 改代码前不评估影响范围 — 必须先 `codegraph_impact`
- ❌ 同时让 subagent 做 codegraph 已经做过的查找 — 主上下文直接调一次即可

### 何时仍需 Read / Grep（合理用法）

- codegraph 返回的源码被截断，需要看完整文件上下文时
- 确认 codegraph 未覆盖的细节（如具体行号上下文、注释、字符串字面量）
- 验证 codegraph 索引是否滞后（写入后约 1 秒）
- 调试 codegraph 本身的问题

### 触发条件

无论任务是修 bug、加功能、重构、解释代码、还是回答"X 怎么工作"，**第一步都是 codegraph 查询**，不是 `grep`、不是 `Read`、不是 `find`。

---

## 项目其他规则

详见 [AGENTS.md](./AGENTS.md) — 包含完整架构、目录结构、开发命令、Git 规范、品牌零容忍规则、敏感信息处理边界等。**首次交互前必读**。
