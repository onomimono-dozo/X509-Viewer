import { useState } from 'react';
import { CertificateInput } from './components/CertificateInput/CertificateInput';
import { CertificateDetail } from './components/CertificateDetail/CertificateDetail';
import {
  CertificateParseError,
  parseCertificates,
} from './lib/parseCertificate';
import type { ParsedCertificate } from './types/certificate';

function App() {
  const [certs, setCerts] = useState<ParsedCertificate[] | null>(null);
  const [error, setError] = useState<string | undefined>();

  const handleParse = (raw: string) => {
    try {
      const parsed = parseCertificates(raw);
      setCerts(parsed);
      setError(undefined);
    } catch (e) {
      setCerts(null);
      setError(
        e instanceof CertificateParseError
          ? e.message
          : '予期しないエラーが発生しました。入力内容を確認してください。',
      );
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">サーバ証明書ビューア</h1>
        <p className="app-subtitle">Server Certificate Viewer</p>
      </header>

      <main className="app-main">
        <CertificateInput onParse={handleParse} errorMessage={error} />

        {certs && certs.length > 1 && (
          <p className="app-multi-note">
            複数の証明書（{certs.length}枚）が見つかりました。チェーン表示は次フェーズ
            (Phase2) で対応します。現在は先頭の証明書を表示しています。
          </p>
        )}

        {certs && certs.length > 0 && <CertificateDetail cert={certs[0]} />}

        {!certs && !error && (
          <p className="app-hint">
            PEMテキストを貼り付けるか、証明書ファイルをアップロードすると、
            内容を日本語＋原語で表示します。証明書データはブラウザの外へ送信されません。
          </p>
        )}
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
