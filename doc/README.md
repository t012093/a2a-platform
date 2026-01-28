# A2A LP調達プラットフォーム ドキュメント

本ディレクトリは、A2A（Agent2Agent）を用いた **B2B SaaS向けLP制作の調達・交渉・契約・決済** を行うプラットフォームのMVP設計ドキュメント集です。
制作・実装そのものは外部エージェント/制作会社が担い、プラットフォームは「交渉〜契約〜決済」の摩擦を最小化します。

## ドキュメント構成
- `requirements.md` 要件定義（目的/スコープ/要件）
- `architecture.md` アーキテクチャ概要（構成/連携/データ流）
- `specification.md` 仕様書（機能仕様/状態/ルール）
- `detailed-design.md` 詳細設計（データモデル/処理/バリデーション）
- `api.md` API仕様（MVPのREST + A2A連携）
- `flows.md` 主要フロー（RFP→交渉→契約→決済）
- `payments.md` 決済設計（プロバイダ抽象化）
- `payments-stripe.md` 決済設計（Stripe Connect / MVP）
- `mcp.md` MCP連携方針（社内ツール/外部エージェント）
- `a2a-extension.md` 商談拡張（RFP/Offer/Contract/Approvalスキーマ）
- `a2a-flow.md` A2Aフロー図（API呼び出し順）
- `implementation-notes.md` 実装反映メモ（現状のバックエンド実装）

## 位置づけ
- **対象**: B2B SaaSのLP制作を外注したい企業 / 制作会社・エージェント
- **MVP範囲**: 交渉・契約・決済（エスクロー）に限定
- **除外**: LP制作実務、広告運用、運用改善の実行

## 用語
- **RFP**: 依頼内容（要件/予算/納期など）の構造化データ
- **Offer**: 見積・条件提案
- **Contract**: 合意済みの条件
- **Approval**: 承認（契約/支払い）
- **A2A**: エージェント間通信の標準プロトコル
