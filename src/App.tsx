/**
 * アプリケーションシェル（環境構築フェーズのプレースホルダ）。
 *
 * 工程③「環境構築」の動作確認用。実装フェーズ1（MVP）以降で、
 * ここに入力エリア・チェーン一覧・詳細表示を段階的に組み込んでいく。
 */
function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">サーバ証明書ビューア</h1>
        <p className="app-subtitle">Server Certificate Viewer</p>
      </header>

      <main className="app-main">
        <section className="setup-card" aria-labelledby="setup-heading">
          <h2 id="setup-heading">環境構築が完了しました</h2>
          <p>
            React + TypeScript + Vite による開発環境が起動しています。
            証明書解析には node-forge を使用します。
          </p>
          <p className="setup-note">
            次工程：実装フェーズ1（MVP）— PEM/ファイル入力と単一証明書の
            日本語＋原語併記表示。
          </p>
          <dl className="setup-meta">
            <div>
              <dt>バージョン</dt>
              <dd>0.1.0</dd>
            </div>
            <div>
              <dt>実行モード</dt>
              <dd>完全クライアントサイド（証明書を外部へ送信しない）</dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="app-footer">
        <small>
          ブラウザ内で完結する学習ツール。証明書データはサーバへ送信されません。
        </small>
      </footer>
    </div>
  );
}

export default App;
