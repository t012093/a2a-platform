# 決済設計（プロバイダ抽象化）

## 1. 方針
- PSP（決済プロバイダ）は抽象化し、複数対応を前提とする
- MVPは Stripe Connect を実装するが、API/DBは汎用化しておく

## 2. 抽象インターフェース（概念）
- `createPaymentIntent(amount, currency, metadata)`
- `confirmPaymentIntent(intentId)`
- `createTransfer(amount, destinationAccountId)`
- `refundPayment(intentId, amount)`
- `getAccountStatus(accountId)`

## 3. データモデルの前提
- `payment_accounts` にプロバイダ種別とアカウントIDを保持
- `payments.provider` にPSP種別を保持
- Webhookイベントは `payment_events` に正規化保存

## 4. MVP実装
- Stripe Connect を「最初の実装プロバイダ」として採用
- 他PSPの追加はアダプタ実装で差し替える

## 5. 将来追加候補
- PayPal Payouts
- Adyen for Platforms
- 国内決済（例: GMO/PayJP など）

## 6. 留意点
- エスクロー表現の可否は国・PSPの規約に依存
- KYC/KYBの要件はPSPにより異なる
- 返金/チャージバックの扱いは共通状態にマッピングする

## 7. 入金保持・リリース運用（MVPルール）
### 7.1 基本方針
- 入金は「預り（ホールド）」として管理し、成果受領後にリリース
- レビュー期間は **7日（カレンダー日）**
- 応答がない場合は **自動承認 → リリース**

### 7.2 レビューと差し戻し
- レビュー期間内の差し戻しはリリースを保留
- 再提出時点からレビュー期間を再カウント

### 7.3 キャンセル/返金（デフォルト）
- **作業開始前**: 100%返金
- **作業開始後・納品前**: 70%返金 / 30%支払い（キャンセル料）
- **納品後（レビュー期間内）**: 原則リリース保留、紛争解決フローへ

### 7.4 紛争対応
- 双方の主張が一致しない場合は「管理者レビュー」へ
- 管理者決裁で **部分リリース or 返金** を確定
