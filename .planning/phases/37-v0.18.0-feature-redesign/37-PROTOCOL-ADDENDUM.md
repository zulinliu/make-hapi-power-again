# Phase 37 — 协议补充门禁：Guide Beam 与跨端消息时序

> 本文只定义未来实施必须满足的协议约束，不修改源码。目的：确保“立即引导”不会破坏核心会话、queue、messages-consumed、权限、附件、定时消息和旧 CLI 兼容性。

## 1. 协议目标

Guide Beam 的正确语义：

```text
用户在 Agent thinking 时发送“立即引导”
→ Hub 持久化 guide message
→ 若 CLI 声明支持 guide，则请求中断当前 turn
→ guide message 进入队列最前端且单独消费
→ 普通 queued messages 保留原顺序
→ guide 被 queue collect 后才 messages-consumed
→ 若任一步不支持/失败，降级为普通 queue
```

## 2. Capability Handshake

### 2.1 CLI 必须声明能力

CLI session metadata / update-metadata 需增加能力声明，示例：

```ts
type SessionCapabilities = {
    guideInterrupt?: {
        supported: boolean
        mode: 'remote-turn-interrupt' | 'local-switch' | 'unsupported'
        preservesQueue: boolean
        isolatedDelivery: boolean
        version: 1
    }
}
```

### 2.2 Hub 发送策略

| CLI capability | Hub 行为 |
|---|---|
| `supported=true`, `preservesQueue=true`, `isolatedDelivery=true` | 可发送 guide update。 |
| capability 缺失 | 降级为普通 `new-message`，message meta 仍记录 requested guide。 |
| `supported=false` | 降级 queue，并向 Web 发 `guide-fallback-queued`。 |
| capability 过期/CLI 重连未确认 | 不发送 guide，先降级 queue。 |

### 2.3 旧 CLI 防卡死

禁止直接向未知能力 CLI 发送新 `guide-message`。旧 CLI 如果收到未知 update 可能不会 enqueue，也不会 ack consumed，导致消息永久 stuck。

## 3. API / Schema 约束

```ts
type MessageDeliveryMode = 'queue' | 'guide'
```

### 3.1 SendMessage refine

| 条件 | 规则 |
|---|---|
| `deliveryMode` 缺省 | 视为 `queue`。 |
| `scheduledAt != null` | 必须为 `queue`。 |
| `attachments.length > 0` | 第一版必须为 `queue`；后续支持需单独设计上传时序。 |
| session 非 thinking | `guide` 可被接受，但等价普通立即发送，不触发 interrupt。 |
| CLI 不支持 guide | 降级 `queue`，不失败。 |

### 3.2 Message meta

Guide 请求必须持久化，便于 UI 和重启恢复：

```ts
meta: {
    sentFrom: 'webapp'
    deliveryMode: 'queue' | 'guide'
    guide?: {
        requestedAt: number
        policy: 'interrupt-current-preserve-queue'
        state: 'requested' | 'interrupting' | 'queued-fallback' | 'consumed' | 'failed'
        fallbackReason?: string
    }
}
```

若现有 CLI message schema 会剥离未知 meta，必须先扩展 shared schema，再实现 UI。

## 4. Socket / SSE 事件

### 4.1 CLI update

推荐新增 guide update，但必须经过 capability gate：

```ts
type GuideMessageUpdate = {
    t: 'guide-message'
    sid: string
    message: Message
    policy: 'interrupt-current-preserve-queue'
    dedupeKey: string // localId or messageId
}
```

### 4.2 Web SSE

| Event | 触发 |
|---|---|
| `guide-requested` | Hub 接收 guide send。 |
| `guide-interrupt-started` | CLI ack 已开始 interrupt。 |
| `guide-fallback-queued` | CLI 不支持、超时或失败，降级 queue。 |
| `guide-consumed` | queue collect 后发 `messages-consumed`。 |
| `guide-failed` | 持久化失败或不可恢复错误。 |

Web UI 不应只靠 optimistic 状态；必须根据 SSE 收敛。

## 5. Queue 语义

### 5.1 必须新增 guide 专用队列方法

现有方法不足：

| 方法 | 不足 |
|---|---|
| `unshift()` | 同 mode 普通 queued 可能被一起 batch。 |
| `pushIsolateAndClear()` | 会清空普通队列，违反 preserve-queue。 |
| `reset()` | 会丢 pending，禁止用于 guide。 |

新增语义：

```ts
pushGuide(message, mode, localId): void
```

要求：

1. 插入队首。
2. `isolate=true`，单独 collect。
3. 不清空已有 queue。
4. guide 被 collect 后才触发 `onBatchConsumed([localId])`。
5. guide 后的普通 queued 保持原顺序。

### 5.2 messages-consumed 时序

禁止：

- interrupt 成功就 mark invoked。
- Hub 在 CLI collect 前 mark invoked。
- fallback 前清 pending。

允许：

- guide collect 后正常 `messages-consumed`。
- fallback queue 后按普通 queue collect。

## 6. Agent-specific 约束

### 6.1 Claude remote

- 新增 guide interrupt path：abort 当前 turn，但不 close session、不 clear queue。
- abort settle 后 `pushGuide()`。
- 若当前已经 idle，则直接 `pushGuide()` 或普通 immediate send。

### 6.2 Codex remote

禁止复用当前 `handleAbort()`，因为该路径会 `session.queue.reset()`。

必须新增：

```text
handleGuideInterrupt()
→ interruptActiveTurns('guide')
→ reset current turn processors only
→ keep session.queue
→ pushGuide()
→ continue loop
```

### 6.3 Local mode

Local launcher 里的 abort/switch 路径也可能 reset queue。Guide local path 必须：

- 触发当前进程切换/中断。
- 保留 queue。
- guide 单独进入队首。

### 6.4 Unsupported agents

Gemini/Kimi/OpenCode/Cursor 如果未实现 guide capability：

- UI 可显示 Guide，但发送后必须提示“该 Agent 暂不支持立即引导，已排队”。
- 不得失败丢消息。

## 7. 幂等与重启

| 场景 | 规则 |
|---|---|
| Hub 重启 | 未 consumed guide 可重投递，但必须用 `localId/messageId` 去重。 |
| CLI 重连 | 先重新确认 capability，再决定 guide/fallback。 |
| 同一 guide 重放 | 不得重复 interrupt 当前 turn。 |
| interrupt 超时 | 标记 fallback，进入普通 queue。 |
| session end | 未 consumed immediate guide 与普通 queued 一样按现有 sweep 规则处理，不影响 scheduled。 |

## 8. 必测用例

- [ ] 旧 CLI 无 guide capability：降级 queue，不 stuck。
- [ ] guide 插队但不与普通 queued batch。
- [ ] guide 不清空普通 queue。
- [ ] guide collect 后只发一次 `messages-consumed`。
- [ ] guide cancel before consumed。
- [ ] guide 已 consumed 后取消返回不可取消。
- [ ] scheduled + guide 被 schema 拒绝或强制 queue。
- [ ] attachments + guide 被 schema 拒绝或强制 queue。
- [ ] Codex guide 不调用 queue.reset。
- [ ] Hub restart 不重复 interrupt。
- [ ] permission request active 时 guide 不绕过权限。
