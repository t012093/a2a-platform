# A2A 商談拡張（最小仕様）

## 1. 目的
A2Aの標準メッセージに「商談（RFP/Offer/Contract/Approval）」の構造を載せるための最小拡張。
交渉・合意・承認の情報を **DataPart** として交換できるようにする。

## 2. 拡張URI
- `https://a2a-platform.example/ext/deal/v1`
- A2Aリクエスト/レスポンスに `A2A-Extensions` ヘッダで指定

## 3. 共通ルール
- DataPartの `data` に下記スキーマを格納
- `schema_version` は `v1`
- すべてのIDはUUID推奨

## 4. DataPartスキーマ（最小）

### 4.1 RFP
```json
{
  "schema": "deal.rfp",
  "schema_version": "v1",
  "rfp_id": "uuid",
  "title": "B2B SaaS LP制作",
  "goal": "資料請求のCVR改善",
  "kpi": ["CVR", "CTR"],
  "budget": {"min": 800000, "max": 1500000},
  "currency": "JPY",
  "deadline": "2026-03-31",
  "target_audience": "SaaS導入検討者",
  "references": ["https://example.com/ref1"],
  "brand_tone": ["trust", "professional"],
  "constraints": ["薬機法NG", "既存ロゴ必須"],
  "assets_available": ["logo", "brand_guideline"],
  "language": "ja",
  "timezone": "Asia/Tokyo"
}
```

### 4.2 Offer
```json
{
  "schema": "deal.offer",
  "schema_version": "v1",
  "offer_id": "uuid",
  "rfp_id": "uuid",
  "agent_id": "agent-uuid",
  "price": 1200000,
  "currency": "JPY",
  "delivery_days": 21,
  "revision_count": 2,
  "deliverables": ["wireframe", "design", "html"],
  "exclusions": ["広告運用", "翻訳"],
  "valid_until": "2026-02-15",
  "assumptions": ["素材は依頼側提供"]
}
```

### 4.3 Contract
```json
{
  "schema": "deal.contract",
  "schema_version": "v1",
  "contract_id": "uuid",
  "rfp_id": "uuid",
  "offer_id": "uuid",
  "parties": {
    "client_org_id": "uuid",
    "agent_org_id": "uuid"
  },
  "price": 1200000,
  "currency": "JPY",
  "review_window_days": 7,
  "milestones": [
    {"name": "着手", "amount": 600000, "due": "2026-03-10"},
    {"name": "納品", "amount": 600000, "due": "2026-03-31"}
  ],
  "acceptance_criteria": ["主要CTAクリック計測", "モバイル対応"],
  "cancellation_policy": {
    "before_start": 1.0,
    "after_start_before_delivery": 0.7,
    "after_delivery": "dispute"
  }
}
```

### 4.4 Approval
```json
{
  "schema": "deal.approval",
  "schema_version": "v1",
  "approval_id": "uuid",
  "target_type": "rfp|contract|payment|delivery",
  "target_id": "uuid",
  "actor_id": "user-uuid",
  "actor_role": "client_admin|client_approver|agent_admin|agent_approver|platform_admin",
  "action": "approve|reject",
  "reason": "optional",
  "timestamp": "2026-02-01T10:00:00Z",
  "expires_at": "2026-02-08T10:00:00Z"
}
```

## 5. 送受信の使い分け
- RFP: Client → Agent（SendMessage）
- Offer: Agent → Client（Artifact/DataPart）
- Contract: Client → Agent（SendMessage）または Agent → Client（Artifact）
- Approval: 双方の承認結果を共有する際に送信

## 6. 拡張の運用
- 送信時に `A2A-Extensions: https://a2a-platform.example/ext/deal/v1`
- 受信側は拡張理解できない場合、無視またはエラー
