# A2Aフロー（MVP）

## 1. 前提
- プラットフォームは **A2Aクライアント**
- 外部制作会社/エージェントは **A2Aサーバ**
- 拡張URI: `https://a2a-platform.example/ext/deal/v1`

## 2. フロー概要（時系列）
1. **AgentCard取得**
   - GET `/.well-known/agent-card.json` またはレジストリから取得
2. **RFP送信**
   - `SendMessage` に RFP DataPart を同梱
   - Header: `A2A-Extensions: https://a2a-platform.example/ext/deal/v1`
3. **Task受領**
   - `SendMessage` の結果で `Task` を受領（task_id / context_id）
4. **見積（Offer）受領**
   - `SubscribeToTask` または `GetTask` で更新を取得
   - `Artifact` として Offer DataPart を受領
5. **追加情報の往復**
   - Agentが `TASK_STATE_INPUT_REQUIRED` の場合、補足情報を送信
6. **契約合意（Contract）**
   - プラットフォームが `SendMessage` で Contract DataPart を送信
   - 双方承認後、`TASK_STATE_COMPLETED`
7. **決済（プラットフォーム内部）**
   - PSP（Stripe）で入金 → 承認 → リリース
   - 主要状態は `Payment` で管理

## 3. API呼び出し順（最小）
### 3.1 RFP配信
1. `GET /agents/{id}` （AgentCard取得）
2. `POST /message:send` （SendMessage）

### 3.2 交渉/見積取得
3. `GET /tasks/{task_id}` （GetTask）
   または
4. `GET /tasks/{task_id}:subscribe` （SubscribeToTask）

### 3.3 契約合意
5. `POST /message:send` （Contract DataPart送信）

### 3.4 承認共有（任意）
6. `POST /message:send` （Approval DataPart送信）

## 4. 例外
- Agent側が拡張を理解しない場合、通常テキストにフォールバック
- `TASK_STATE_REJECTED` の場合は交渉終了
