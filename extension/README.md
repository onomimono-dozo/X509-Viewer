# サーバ証明書ビューア — Chrome/Edge 拡張（捕捉MVP）

表示中サイトの **TLSサーバ証明書をワンクリックで捕捉**し、同梱のビューアで
日本語＋原語で表示する Manifest V3 拡張です。本体（`../src`）のパーサ・チェーン
判定・署名検証・診断・UI コンポーネントをそのまま再利用しています。

## 仕組み

1. ツールバーの拡張アイコンを押す
2. バックグラウンド Service Worker が `chrome.debugger`（DevTools Protocol の
   `Network.getCertificate`）で**現在タブの証明書チェーン(DER)**を取得
3. PEM に変換して `chrome.storage.session` に保存し、同梱ビューア(`viewer.html`)を開く
4. ビューアが既存ロジックでチェーン表示・押印・署名検証・異常検出を行う

> Chromium には拡張向けの証明書取得APIが無いため `chrome.debugger` を使います。
> 実行中だけ「拡張機能がこのブラウザをデバッグしています」というバナーが出ます。
> 取得した `Network.getCertificate` の結果は**ブラウザが検証したチェーン**のため、
> リーフに加えて中間（場合によりルート）も含まれることがあります。

## ビルド

リポジトリのルートで依存をインストール済みであること（`npm install`）。

```bash
npm run build:ext     # extension/dist/ に出力
```

## ブラウザへの読み込み（開発者モード）

1. Chrome/Edge で `chrome://extensions`（Edge は `edge://extensions`）を開く
2. 「デベロッパー モード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」→ `extension/dist` を選択
4. 任意の **https:// サイト**でツールバーのアイコンを押すと、証明書がビューアで開きます

## 権限

| 権限 | 用途 |
| --- | --- |
| `debugger` | 現在タブの証明書を DevTools Protocol で取得 |
| `storage` | 捕捉した証明書をビューアへ受け渡す（`storage.session`、消費後に削除） |
| `activeTab` | クリック時に対象タブのURL/IDを取得 |

証明書データはブラウザ内で完結し、外部へ送信されません。

## 既知の制約 / 今後

- `chrome.debugger` 使用中はデバッグ用バナーが表示されます（Chromium仕様）。
- 既読タブで取得できない場合は、ページを再読み込みしてから再実行してください。
- ルート/中間の欠落を埋める **AIAチェイシング**、企業ストア参照のための
  **Native Messaging ヘルパー**は次フェーズの候補です。
- Firefox は `webRequest.getSecurityInfo()` でより簡潔に取得できるため、別途対応余地あり。
