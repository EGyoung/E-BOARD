# E-Board 协同功能设计与实施步骤（超详细）

> 目标：在现有项目基础上实现协同编辑，不依赖 yjs，使用向量时钟进行冲突处理；发送 op 采用任务队列批量发送；能够处理网络乱序、丢包、发送失败、消息体过大、各种边界场景。

## 0. 约束与基本假设

- 不使用 yjs 或其他现成 CRDT 框架。
- 冲突处理基于向量时钟（Vector Clock），不得用本地时间戳作为排序依据。
- 发送 op 需要任务队列 + 批量发送。
- 接收 op 必须能处理乱序：先到后续 op、再到先前 op。
- 必须考虑发送失败、断线重连、消息体过大等边界场景。

## 1. 术语与数据模型

### 1.1 节点与身份

- `clientId`：客户端唯一标识（可用随机 UUID）。
- `sessionId`：协同会话 ID（房间）。
- `site`：`clientId` 的别名。

### 1.2 向量时钟结构

```ts
// 示例结构
interface VectorClock {
  [clientId: string]: number; // 每个 clientId 的单调递增计数
}
```

规则：

- 每次本地产生 op 时，先 `clock[clientId]++`，并把整个 `clock` 作为 op 的 `vc`。
- 对远端 op：只在其 op 被成功应用后，才更新本地 `clock`（逐项取 max）。

### 1.3 协同操作 op 结构

```ts
interface OpEnvelope {
  opId: string; // UUID
  clientId: string; // 发送者
  sessionId: string; // 房间
  vc: VectorClock; // 向量时钟
  deps?: VectorClock; // 可选：显式依赖
  type: string; // 业务操作类型（draw, move, delete...）
  payload: any; // 业务数据
  seq: number; // 客户端本地递增序号（用于去重和重发）
  size?: number; // 估算大小（字节）
  ackRequested?: boolean; // 是否需要 ack
}
```

### 1.4 运行时队列

- `sendQueue`：待发送的 op 队列。
- `inflight`：已发送未确认的 batch。
- `holdbackQueue`：接收到但暂不满足依赖条件的 op。
- `appliedSet`：已应用 opId 集合（去重）。

## 2. 协议与消息类型

### 2.1 消息类型

- `operation`：协同 op（批量发送时为数组）。
- `ack`：确认消息（可以按 batchId 或 opId）。
- `sync-request` / `sync`：断线重连时的状态同步。
- `snapshot`：大消息或全量状态。
- `error`：服务端拒绝（过大、非法、限流）。

### 2.2 批量发送载荷结构

```ts
interface BatchMessage {
  type: "operation";
  sessionId: string;
  batchId: string; // UUID
  clientId: string;
  ops: OpEnvelope[]; // 批量操作
}
```

## 3. 发送侧设计（任务队列 + 批量）

### 3.1 发送队列策略

- 触发条件：
  - 达到 `MAX_BATCH_SIZE`；或
  - 到达 `FLUSH_INTERVAL`（例如 16~50ms）；或
  - 显式 `flush()`（例如用户停止拖拽）。
- 批量大小：控制单包大小，避免超过 `MAX_MESSAGE_BYTES`。

### 3.2 发送流程

1. 本地产生 op：更新本地向量时钟，构造 `OpEnvelope`。
2. 入队 `sendQueue`。
3. 发送任务队列调度：
   - 拼装 batch（限制条数与字节数）。
   - `inflight[batchId] = { ops, retryCount, nextRetryAt }`。
4. 发送失败处理：
   - 若 `send()` 返回 false 或 websocket 不可用，回退到队列并等待重连。
5. ack 机制：
   - 服务端按 `batchId` 返回 ack。
   - ack 到达时移除 `inflight`，并标记 op 发送成功。
6. 重试：
   - 指数退避，如 1s、2s、4s...
   - 超过最大重试次数进入 `dead-letter`，可提示用户重试或进入只读。

### 3.3 发送时的压缩与分片

- 若 batch 超过 `MAX_MESSAGE_BYTES`：
  - 优先减少 batch 数量；
  - 若单个 op 过大，触发 `snapshot` 或 `chunk`。
- 可选压缩：
  - 使用 `gzip` 或 `deflate`（需要前后端协商）。

## 4. 接收侧设计（乱序与冲突处理）

### 4.1 因果可达判定

对收到的 op：

- 若 `vc` 的所有分量都满足 `vc[site] <= localClock[site] + (site==sender?1:0)`，则可应用。
- 否则进入 `holdbackQueue`。

### 4.2 乱序处理流程

1. 收到 batch，逐个 op 检查。
2. 若 `opId` 已在 `appliedSet`，忽略（去重）。
3. 若依赖满足，执行 `applyOp()`。
4. 若不满足，进入 `holdbackQueue`。
5. 每次成功应用 op 后，尝试扫描 `holdbackQueue`，看是否有新满足的 op。

### 4.3 冲突解决原则

- 冲突识别：
  - 两个 op 的向量时钟互不因果（并发）。
- 解决策略选项：
  - **基于操作语义的 OT/变换**：对图形/元素操作定义 transform 规则。
  - **基于优先级规则**：如 `clientId` 字典序或哈希排序作为并发 tie-breaker。
  - **基于业务类型**：例如并发删除优先；并发移动合并；并发样式变更以字段为粒度合并。

注意：不使用本地时间戳排序。

## 5. 服务端职责

- 仅负责转发、限流、ack、同步，不负责冲突处理。
- 维护每个 session 的 `history` 或 `snapshot`。
- 对 `operation` 做广播。
- 返回 `ack` 给发送方。
- 当消息过大或非法时返回 `error`。

## 6. 网络波动与重连

### 6.1 断线重连

- 客户端重连后发送 `sync-request`，带上本地 `vectorClock` 或 `lastAckSeq`。
- 服务端根据历史或 snapshot 返回 `sync`。
- 客户端合并并重新消费，仍需应用向量时钟规则。

### 6.2 乱序场景

- 先收到后续 op：进入 `holdbackQueue`。
- 后收到之前 op：应用后触发 `holdbackQueue` 释放。

### 6.3 丢包/重发

- `inflight` 仍未 ack 的 batch 继续重试。
- 服务端可重复发送同 op，客户端用 `opId` 去重。

## 7. 失败处理

- 发送失败：
  - 若 websocket 断开，停止发送，缓存到 `sendQueue`。
  - 重连后重发。
- ack 超时：
  - 回退并重发；
  - 超过重试次数进入 `dead-letter`。

## 8. 消息体过大

### 8.1 限制与策略

- `MAX_MESSAGE_BYTES`（例如 64KB）。
- `MAX_OP_BYTES`（例如 16KB）。

### 8.2 处理策略

- 拆包：一个 op 太大时拆成多个 `chunk`。
- 降级：直接发送 `snapshot`（全量或局部）。
- 压缩：发送前 gzip。

## 9. 边界场景清单

- 重复 ack 或重复 op。
- 同一 op 在多个 batch 中重复发送。
- 断线期间持续本地编辑。
- 远端批量 op 到达但部分 op 数据非法。
- `holdbackQueue` 过大造成内存膨胀。
- 向量时钟缺失/损坏。
- 客户端 clock 回退（BUG）。

## 10. 建议的模块拆分

- `collaboration/queue`: 发送队列与重试策略。
- `collaboration/vectorClock`: 向量时钟工具与比较逻辑。
- `collaboration/transport`: websocket 发送、ack、重连。
- `collaboration/holdback`: 乱序队列与释放逻辑。
- `collaboration/conflict`: 冲突处理策略接口。

## 11. 实施步骤（逐步落地）

### 步骤 1：定义协议与数据结构

1. 创建 `OpEnvelope`、`BatchMessage`、`AckMessage` 类型。
2. 规定 `vectorClock` 的字段与更新规则。
3. 服务端明确支持 `operation`/`ack`/`sync`/`error`。

### 步骤 2：实现向量时钟模块

1. `increment(clock, clientId)`。
2. `merge(local, remote)`。
3. `compare(a, b)` 返回 `before`/`after`/`concurrent`。
4. `isCausallyReady(op.vc, localClock)` 判断是否可应用。

### 步骤 3：实现发送队列与批量

1. `enqueue(op)`。
2. `buildBatch()`：按大小与数量打包。
3. `sendBatch()`：发送并进入 inflight。
4. `handleAck(batchId)`：移除 inflight。
5. `retry()`：指数退避。

### 步骤 4：实现接收与乱序处理

1. 接收 batch。
2. 逐条检查 `opId` 去重。
3. 可应用则执行 `applyOp()`。
4. 不可应用加入 `holdbackQueue`。
5. 每次应用后尝试释放。

### 步骤 5：实现冲突处理策略

1. 定义 `transform(opA, opB)` 接口。
2. 对 `draw/move/delete` 等操作提供具体规则。
3. 并发时按规则变换或合并。

### 步骤 6：实现断线重连与同步

1. 断线后暂停发送。
2. 重连后发送 `sync-request` 携带 `clock`。
3. 服务端返回历史或 snapshot。
4. 客户端重建状态再继续发送。

### 步骤 7：实现失败与过大处理

1. send 失败进入队列。
2. 超时重试与 dead-letter。
3. 超大消息拆包或 snapshot。

### 步骤 8：补充监控与测试

- 单元测试：向量时钟 compare、holdback 释放逻辑。
- 集成测试：乱序、断网、重连、重复发送。

---

以上是完整设计与实施步骤。如果你要我基于这份文档直接开始改代码，我可以继续写具体模块与实现。
