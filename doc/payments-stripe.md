# 決済設計（Stripe Connect）

## 1. 方針
- 決済は PSP 抽象化の上で Stripe Connect を採用（MVP）
- プラットフォームは「入金保持→承認→支払いリリース」を担う
- 代理店/エージェントは Stripe 接続アカウントとして登録

## 2. 主要オブジェクト
- **Connected Account**: 代理店/エージェントの受取口座
- **PaymentIntent**: 依頼側の入金処理
- **Transfer**: 支払いリリース時に接続アカウントへ移動
- **Webhook**: 決済状態の同期

## 3. 基本フロー（MVP）
### 3.1 代理店オンボーディング
1. `POST /agents/{id}/payment-accounts` で接続アカウント作成（provider=stripe）
2. `POST /payment-accounts/{id}/link` でオンボーディングURL発行
3. 完了後、`payment_accounts.account_id` を保存

### 3.2 入金（エスクロー相当）
1. 契約確定後、`POST /payments/escrow` で PaymentIntent を作成
2. 依頼側が決済を完了
3. Webhook で決済成功を検知し、`escrowed` に遷移

### 3.3 支払いリリース
1. 依頼側が成果受領を承認
2. `POST /payments/{id}/release` で Transfer を実行
3. Webhook で移動完了を検知し、`released` に遷移

### 3.4 返金
- キャンセル/合意解除時は PaymentIntent の返金処理

## 4. 状態管理（Payment）
- `escrow_pending`: PaymentIntent 作成済み/未完了
- `escrowed`: 入金完了
- `release_pending`: 承認済み/送金待ち
- `released`: 送金完了
- `refunded`: 返金完了

## 5. 運用ルール（MVP）
- レビュー期間は **7日（カレンダー日）**
- 応答がない場合は **自動承認 → リリース**
- 差し戻しが入った場合はリリース保留、再提出で期間リセット
- キャンセル時の返金率は契約条件に従う（デフォルト: 100% / 70% / 紛争）

## 6. Webhookで反映するイベント（例）
- 決済成功/失敗
- 返金完了
- 送金完了

## 7. エンドポイント（MVP）
- `POST /webhooks/stripe`（または `/webhooks/{provider}` の provider=stripe）

## 6. 留意点
- 「資金の保持期間」や「エスクロー表現」の扱いは、Stripeの規約と各国法令に従う
- 代理店の所在地や通貨により、オンボーディング要件が変わる可能性がある
- 決済失敗/不正検知時の再試行フローを最初から用意する
