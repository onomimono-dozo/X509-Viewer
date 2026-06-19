# サーバ証明書ビューア（Server Certificate Viewer）

TLSサーバ証明書を **日本語＋原語併記** で可視化し、「誰が・誰を・何によって」
証明しているかを直感的に理解するための、**完全クライアントサイド**の学習ツールです。

> 「サーバ証明書 ＝ 公証役場（中間CA）の押印がある身分証明書」という比喩を中核に、
> X.509証明書の内容を書類形式のUIで読み解きます。

## 特徴（要件定義 v2.0）

- **入力2方式**：PEMテキスト貼り付け / ファイルアップロード（.pem/.crt/.cer/.der）
- **日本語＋原語併記**：各項目を「日本語名・原語フィールド名・値・補足アナロジー」で表示
- **チェーン表示＋押印の視覚化**：サーバ→中間CA→ルートCA を押印（朱印）付きカードで並べ、選択連動で詳細表示。AKID/SKID と DN で親子関係を判定
- **署名検証**：WebCrypto で各証明書の署名を発行者の公開鍵により実際に検証（RSA / ECDSA / Ed25519）。「✓ 署名検証済み」バッジで提示
- **異常検出 (F-07)**：SSLインスペクション・短命証明書・有効期限・弱い署名/鍵長・ドメイン不一致・自己署名・SCT欠如を、判断根拠フィールド付きで提示
- **追加項目の表示**：機関情報アクセス(OCSP/CA Issuers)・証明書ポリシー(DV/OV/EV)・証明書透明性ログ(SCT)
- **完全クライアントサイド**：証明書データを外部へ送信しない。秘密鍵は一切扱わない

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| UIフレームワーク | React + TypeScript |
| ビルド | Vite |
| 証明書解析 | node-forge |
| ホスティング | GitHub Pages（静的） |

## 開発

前提：Node.js 22 以上

```bash
npm install      # 依存インストール
npm run dev      # 開発サーバ起動（http://localhost:5173）
npm run build    # 本番ビルド（dist/ に出力）
npm run preview  # ビルド結果のプレビュー
npm run lint     # ESLint
npm run format   # Prettier 整形
```

## 実装フェーズ

| Phase | 内容 | 状態 |
| --- | --- | --- |
| 環境構築 | リポジトリ・ビルド環境・ライブラリ選定 | ✅ 完了 |
| Phase 1 (MVP) | PEM/ファイル入力＋単一証明書の基本/拡張領域表示、日本語＋原語併記、criticalフラグ | ✅ 完了 |
| Phase 2 | チェーン表示・押印の視覚化・選択連動・署名検証バッジ | ✅ 完了 |
| Phase 3 | 異常検出アラート・OCSP/ポリシー/SCT表示 | ✅ 完了 |
| Phase 4 (将来) | 比較モード（期待 vs 実際の差分） | 未着手 |

## ディレクトリ構成

```
src/
  components/   UIコンポーネント（入力・カード・チェーン・詳細・診断）
  lib/          証明書解析・チェーン判定・異常検出ロジック
  types/        証明書ドメインの型定義
  data/         日本語＋原語の対訳辞書・補足説明
  styles/       スタイル
```

## ブラウザ拡張（Chrome/Edge）

`extension/` に、表示中サイトの証明書をワンクリックで捕捉して可視化する
Manifest V3 拡張（捕捉MVP）があります。本体のパーサ・コンポーネントを再利用しています。

```bash
npm run build:ext   # extension/dist/ にビルド
```

`chrome://extensions`（または `edge://extensions`）→ デベロッパーモード →
「パッケージ化されていない拡張機能を読み込む」で `extension/dist` を選択。
詳細は [`extension/README.md`](extension/README.md) を参照。

## デプロイ

`main` ブランチへ push すると GitHub Actions（`.github/workflows/deploy.yml`）が
ビルドして GitHub Pages へ公開します。初回はリポジトリの **Settings > Pages** で
Source を「GitHub Actions」に設定してください。
