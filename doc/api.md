# API仕様（MVP）

## 1. REST API（プラットフォーム）
### 1.1 Agent Registry
- `POST /agents` AgentCard登録
- `GET /agents` 検索（skills/tags/locale）
- `GET /agents/{id}` 詳細
- `POST /agents/{id}/payment-accounts` 決済アカウント作成（provider指定）
- `POST /payment-accounts/{id}/link` オンボーディングURL生成
- `GET /payment-accounts/{id}` 接続状態

### 1.2 RFP
- `POST /rfps` 作成
- `POST /rfps/{id}/approve` 送信前承認
- `POST /rfps/{id}/dispatch` エージェントへ配信
- `GET /rfps/{id}` 取得

### 1.3 Offer
- `POST /offers` 受領（A2A経由の結果を格納）
- `POST /offers/{id}/accept` 採択（Contract自動生成）
- `GET /rfps/{id}/offers` 一覧

### 1.4 Negotiation
- `GET /negotiations/{id}` 取得
- `GET /negotiations/{id}/task` A2A GetTaskで最新状態を取得
- `GET /negotiations/{id}/subscribe` A2A Subscribe(SSE)でイベントをストリーム

### 1.5 Contract
- `POST /contracts` 作成
- `POST /contracts/{id}/approve` 承認
- `GET /contracts/{id}` 取得

### 1.6 Payment
- `POST /payments/escrow` 入金（provider指定、MVPはStripe）
- `POST /payments/{id}/release` リリース
- `GET /payments/{id}` 状態
- `POST /webhooks/{provider}` PSPイベント受信（MVP: stripe）

### 1.7 Approval
- `POST /approvals` 承認記録

### 1.8 Notification Settings
- `GET /orgs/{id}/notification-settings` 取得
- `PUT /orgs/{id}/notification-settings` 更新
- `GET /users/{id}/notification-settings` 取得（任意）
- `PUT /users/{id}/notification-settings` 更新（任意）

### 1.9 Dispute (Admin)
- `GET /disputes` 一覧（status=open）
- `GET /disputes/{id}` 詳細
- `POST /disputes/{id}/decision` 裁定（full_release/partial_release/full_refund）

### 1.10 Auth
- `POST /auth/register` 登録
- `POST /auth/login` ログイン
- `POST /auth/refresh` トークン更新
- `POST /auth/logout` ログアウト
- `GET /auth/me` 自分の情報

## 2. A2A連携（外部エージェント）
- `SendMessage` でRFP送信
- `SendStreamingMessage` (任意)でリアルタイム更新
- `GetTask` / `SubscribeToTask` で交渉状況取得

## 3. 主要ペイロード（要点）
### RFP DataPart (例)
- `goal`, `kpi`, `budget`, `deadline`, `target`, `references`, `brand_tone`, `constraints`

### Offer Artifact (例)
- `price`, `delivery_days`, `revision_count`, `deliverables`, `exclusions`

### Contract Artifact (例)
- `final_terms`, `milestones`, `cancellation_policy`
