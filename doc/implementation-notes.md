# 実装反映メモ（MVPバックエンド）

本メモは、設計ドキュメントに対する**実装の反映点/差分**をまとめたものです。

## 1. バックエンド実装の配置
- 実装リポジトリ: `a2a-platform`
- スタック: **TypeScript + Fastify + Prisma + PostgreSQL**
- Prisma初期マイグレーション: `20260128152256_init`

## 2. A2A SDK統合
- 使用SDK: `@a2a-js/sdk`（JS SDK）
- 実装箇所: `src/a2a/client.ts`
- RFP配信時にA2A SendMessageを実行
  - ルート: `POST /rfps/:id/dispatch`
  - DataPartに `deal.rfp` のスキーマを送信
  - AgentCardはDBに保存されたJSONを利用
  - Taskが返った場合、または Messageに `taskId` が含まれる場合に `a2aTaskId` / `a2aContextId` を更新
- `X-A2A-Extensions` ヘッダはSDKの `ServiceParameters` で送信済み
- 交渉ステータス取得
  - `GET /negotiations/:id/task` で `GetTask` を実行し、Task状態に合わせて `Negotiation.status` を更新
  - `GET /negotiations/:id/subscribe` は `resubscribeTask` をSSEで中継し、status-update時に `Negotiation.status` を更新
- ローカル検証用のA2Aデモエージェントを追加
  - `demo-agent/server.js`（Offer artifactを返して `completed`）
  - `scripts/demo_flow.py`（RFP→dispatch→negotiationId作成）

## 3. API実装状況（MVP）
- 実装済みの主要エンドポイントは `a2a-platform/README.md` に記載
- Webhookは `POST /webhooks/:provider` に統一
- PaymentAccountは `/agents/:id/payment-accounts` と `/payment-accounts/:id/link` を実装
  - Stripeの場合、`accountId` 未指定ならアカウントを自動作成

## 4. 決済（PSP）実装の現状
- Stripe Connect連携を実装
  - PaymentIntent作成（`automatic_payment_methods`）
  - Transfer作成でリリース
  - Webhook署名検証（`STRIPE_WEBHOOK_SECRET`）
- 必須環境変数: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_RETURN_URL`, `STRIPE_REFRESH_URL`
- `providerPaymentIntentId` / `providerTransferId` はStripeのIDを保存
- Webhookイベントは `payment_events` に保存

## 5. 認証
- JWT認証を実装
  - `/auth/register` / `/auth/login` / `/auth/refresh` / `/auth/logout` / `/auth/me`
  - RefreshTokenはDBに保存（hash）
  - `AUTH_DISABLED=true` で認証を無効化可能

## 6. 紛争管理
- 管理者APIを実装
  - `GET /disputes`, `GET /disputes/:id`, `POST /disputes/:id/decision`
- 裁定は `full_release / partial_release / full_refund`
- PSP連携による実際の返金/送金は未実装

## 7. 通知設定
- 組織/ユーザー単位の通知設定APIを実装
- 送信ロジック（ジョブ/スケジューラ）は未実装

## 8. 既知の未実装（TODO）
- A2AのPush通知設定（`setTaskPushNotificationConfig`）のUI/API
- 交渉履歴（Task履歴/Artifact）の永続化
- 通知スケジューラ
