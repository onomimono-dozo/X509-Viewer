import { useEffect, useMemo, useState } from 'react';
import { CertificateInput } from './components/CertificateInput/CertificateInput';
import { CertificateDetail } from './components/CertificateDetail/CertificateDetail';
import { ChainView } from './components/ChainView/ChainView';
import { DiagnosticsPanel } from './components/DiagnosticsPanel/DiagnosticsPanel';
import { buildChain, sealText, type ChainNode } from './lib/chain';
import { runDiagnostics } from './lib/diagnostics';
import {
  CertificateParseError,
  parseCertificates,
} from './lib/parseCertificate';
import { verifyChain, type NodeVerification } from './lib/verifyChain';

function App() {
  const [chain, setChain] = useState<ChainNode[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [verifications, setVerifications] = useState<
    Map<number, NodeVerification>
  >(new Map());
  const [error, setError] = useState<string | undefined>();
  const [targetDomain, setTargetDomain] = useState('');

  // チェーンが変わったら署名検証を非同期で実行する
  useEffect(() => {
    if (!chain) return;
    let active = true;
    verifyChain(chain).then((result) => {
      if (active) setVerifications(result);
    });
    return () => {
      active = false;
    };
  }, [chain]);

  const handleParse = (raw: string) => {
    try {
      const certs = parseCertificates(raw);
      const nodes = buildChain(certs);
      setChain(nodes);
      setVerifications(new Map());
      // 初期選択は取り込みの起点となったサーバ証明書（入力の先頭）
      const startPos = nodes.findIndex((n) => n.inputIndex === 0);
      setSelectedIndex(startPos >= 0 ? startPos : 0);
      setError(undefined);
    } catch (e) {
      setChain(null);
      setError(
        e instanceof CertificateParseError
          ? e.message
          : '予期しないエラーが発生しました。入力内容を確認してください。',
      );
    }
  };

  const selected = chain?.[selectedIndex];

  const diagnostics = useMemo(
    () =>
      selected
        ? runDiagnostics(selected.cert, selected.role, { targetDomain })
        : [],
    [selected, targetDomain],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">サーバ証明書ビューア</h1>
        <p className="app-subtitle">Server Certificate Viewer</p>
      </header>

      <main className="app-main">
        <CertificateInput onParse={handleParse} errorMessage={error} />

        {chain && chain.length > 0 && (
          <ChainView
            nodes={chain}
            selectedIndex={selectedIndex}
            verifications={verifications}
            onSelect={setSelectedIndex}
          />
        )}

        {selected && (
          <DiagnosticsPanel
            diagnostics={diagnostics}
            targetDomain={targetDomain}
            onTargetDomainChange={setTargetDomain}
            showDomainInput={selected.role === 'leaf'}
          />
        )}

        {selected && (
          <CertificateDetail
            cert={selected.cert}
            sealText={sealText(selected)}
            sealedByLabel={selected.sealedByLabel}
            verification={verifications.get(selectedIndex)}
          />
        )}

        {!chain && !error && (
          <p className="app-hint">
            PEMテキストを貼り付けるか、証明書ファイルをアップロードすると、
            内容を日本語＋原語で表示します。証明書チェーン（複数証明書）を入力すると、
            信頼の連鎖を押印付きで可視化します。証明書データはブラウザの外へ送信されません。
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
