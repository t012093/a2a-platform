# アーキテクチャ概要

## 1. 全体像（論理構成）
```
[Client UI] ─┐
             ├─> [API Gateway]
[Admin UI] ──┘          │
                         ├─ [Registry Service] ──(AgentCard DB)
                         ├─ [Negotiation Service] ──(Task/Message DB)
                         ├─ [Contract Service] ──(Contract DB)
                         ├─ [Dispute Service] ──(Dispute DB)
                         ├─ [Payment Service] ──(PSP Adapter: Stripe MVP)
                         ├─ [Notification Service] ──(Email/Webhook/SSE)
                         └─ [Audit Log]

[External A2A Agents] <────── A2A Client/Connector (SendMessage/Stream)
[Stripe/Other PSP]   <────── Payment Service (API/Webhook)
[Sign Provider]      <────── Contract Service (optional)
```

## 2. 主要コンポーネント
- **API Gateway**: 認証/認可、レート制御、リクエストルーティング
- **Registry Service**: AgentCard登録・検索
- **Negotiation Service**: RFP配信、A2A Task/Message管理
- **Contract Service**: 合意条件の固定化、承認記録
- **Dispute Service**: 紛争受付と裁定
- **Payment Service**: エスクロー管理、決済連携（PSPアダプタ方式、MVPはStripe）
- **Notification Service**: 重要イベント通知（メール/アプリ内）
- **Audit Log**: 重要操作の監査証跡

## 3. データストア
- **RDB (PostgreSQL)**: RFP/Offer/Contract/Payment/Approval
- **Object Storage**: 見積PDF、契約サマリー、添付ファイル
- **Log Store**: 監査ログ、イベントログ

## 4. A2A連携の位置づけ
- プラットフォームは **A2Aクライアント** としてエージェントへ接続
- 交渉の実態は **A2A Task/Message/Artifact** で管理
- AgentCardの能力情報をレジストリに格納し検索可能にする

## 5. MVPの構成指針
- **モジュラーモノリス**として実装（将来の分割を前提）
- まずはREST + A2A Connectorで最小運用
- ストリーミング/SSEは後続フェーズで導入

## 6. 可観測性
- リクエストID/タスクID/契約IDで一貫トレーシング
- 主要イベントは監査ログに記録

## 7. 将来拡張（MCP）
- MCP接続は「社内ツール」「外部エージェント側ツール」の両方を想定
- 初期は接続先を最小化し、MCPアダプタ層を追加で分離
