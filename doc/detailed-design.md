# 詳細設計（MVP）

## 1. データモデル（概要）
### 1.1 agents
- `id` (PK)
- `name`
- `provider_org`
- `agent_card_json`
- `skills` (JSON)
- `default_input_modes`
- `default_output_modes`
- `status` (active/suspended)
- `created_at`, `updated_at`

### 1.2 rfps
- `id` (PK)
- `client_org_id`
- `title`
- `requirements_json` (目的/KPI/予算/納期/参考LPなど)
- `status` (draft/submitted/closed/cancelled)
- `approved_at`

### 1.3 offers
- `id` (PK)
- `rfp_id` (FK)
- `agent_id` (FK)
- `offer_json` (価格/納期/修正回数/成果物/除外事項)
- `status` (proposed/revised/accepted/rejected/withdrawn)
- `created_at`, `updated_at`

### 1.4 negotiations
- `id` (PK)
- `rfp_id` (FK)
- `agent_id` (FK)
- `a2a_task_id`
- `a2a_context_id`
- `status`

### 1.5 contracts
- `id` (PK)
- `rfp_id` (FK)
- `offer_id` (FK)
- `terms_json`
- `status` (pending_approval/active/completed/terminated)
- `signed_at`
- `dispute_status` (none/open/resolved)

### 1.5.1 disputes
- `id` (PK)
- `contract_id` (FK)
- `status` (open/resolved)
- `opened_by` (client/agent/system)
- `reason`
- `evidence_refs` (JSON)
- `decision` (full_release/partial_release/full_refund)
- `decision_amount` (optional)
- `decided_by` (platform_admin)
- `decided_at`
- `created_at`, `updated_at`

### 1.6 approvals
- `id` (PK)
- `target_type` (rfp/contract/payment)
- `target_id`
- `actor_id`
- `actor_role` (client_admin/client_approver/agent_admin/agent_approver/platform_admin)
- `status` (approved/rejected)
- `reason`
- `expires_at`
- `created_at`

### 1.7 payments
- `id` (PK)
- `contract_id` (FK)
- `amount`
- `currency`
- `status` (escrow_pending/escrowed/release_pending/released/refunded)
- `provider` (stripe/paypal/adyen/other)
- `provider_payment_intent_id`
- `provider_transfer_id`
- `provider_ref`
- `created_at`, `updated_at`
- `platform_fee_rate`
- `platform_fee_amount`
- `net_amount`

### 1.8 payment_accounts
- `id` (PK)
- `agent_id` (FK)
- `provider` (stripe/paypal/adyen/other)
- `account_id` (PSP側ID)
- `status` (pending/active/disabled)
- `details_json`
- `created_at`, `updated_at`

### 1.9 notification_settings
- `id` (PK)
- `org_id`
- `timezone`
- `business_hours_start` (HH:MM)
- `business_hours_end` (HH:MM)
- `send_on_weekend` (bool, default=false)
- `channels` (email,in_app)
- `created_at`, `updated_at`

### 1.10 user_notification_settings (optional)
- `id` (PK)
- `user_id`
- `timezone`
- `business_hours_start` (HH:MM)
- `business_hours_end` (HH:MM)
- `send_on_weekend` (bool, default=false)
- `channels` (email,in_app)
- `created_at`, `updated_at`

### 1.11 audit_logs
- `id` (PK)
- `actor_id`
- `event_type`
- `payload_json`
- `created_at`

### 1.12 payment_events
- `id` (PK)
- `payment_id` (FK)
- `event_type`
- `payload_json`
- `created_at`

### 1.13 refresh_tokens
- `id` (PK)
- `user_id` (FK)
- `token_hash`
- `expires_at`
- `revoked_at`
- `created_at`

## 2. バリデーション
- RFP必須項目が欠けている場合は送信不可
- 価格・納期・修正回数が未設定のOfferは無効
- 契約は双方承認が揃うまで `pending_approval`
- 支払いリリースは「成果受領承認」が条件

## 3. A2Aメッセージ規約
- RFPは `DataPart` で送信
- Offer/Contractは `Artifact` で返却
- 交渉継続時は `Task` を保持

## 4. 例外/エラー
- 相手が応答しない場合は `TIMEOUT` として交渉終了
- 見積が大幅に条件変更された場合は再承認を要求

## 5. セキュリティ
- 役割ベースアクセス制御（RBAC）
- 監査ログを全ての承認イベントで記録
- AgentCardに認証方式（APIキー/OAuth）を保持
