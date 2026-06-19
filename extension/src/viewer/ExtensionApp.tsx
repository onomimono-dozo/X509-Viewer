import { useEffect, useMemo, useState } from 'react';
import { CertificateInput } from '@app/components/CertificateInput/CertificateInput';
import { CertificateDetail } from '@app/components/CertificateDetail/CertificateDetail';
import { ChainView } from '@app/components/ChainView/ChainView';
import { DiagnosticsPanel } from '@app/components/DiagnosticsPanel/DiagnosticsPanel';
import { buildChain, sealText, type ChainNode } from '@app/lib/chain';
import { runDiagnostics } from '@app/lib/diagnostics';
import {
  CertificateParseError,
  parseCertificates,
} from '@app/lib/parseCertificate';
import { verifyChain, type NodeVerification } from '@app/lib/verifyChain';

interface CaptureRecord {
  pem?: string;
  origin?: string;
  capturedAt?: number;
  error?: string;
}

/**
 * 拡張内ビューア。背景SWが捕捉した証明書(PEM)を storage.session から読み込み、
 * 既存のパーサ・コンポーネントでそのまま表示する。手動貼り付けにも対応。
 */
export function ExtensionApp() {
  const [chain, setChain] = useState<ChainNode[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [verifications, setVerifications] = useState<
    Map<number, NodeVerification>
  >(new Map());
  const [error, setError] = useState<string | undefined>();
  const [targetDomain, setTargetDomain] = useState('');
  const [capturedOrigin, setCapturedOrigin] = useState<string | undefined>();

  useEffect(() => {
    if (!chain) return;
    let active = true;
    verifyChain(chain).then((r) => {
      if (active) setVerifications(r);
    });
    return () => {
      active = false;
    };
  }, [chain]);

  const handleParse = (raw: string, origin?: string) => {
    try {
      const nodes = buildChain(parseCertificates(raw));
      setChain(nodes);
      setVerifications(new Map());
      const start = nodes.findIndex((n) => n.inputIndex === 0);
      setSelectedIndex(start >= 0 ? start : 0);
      setError(undefined);
      // 捕捉元ホスト名を「名義とドメインの不一致」照合の初期値にする
      if (origin) {
        try {
          setTargetDomain(new URL(origin).hostname);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setChain(null);
      setError(
        e instanceof CertificateParseError
          ? e.message
          : '予期しないエラーが発生しました。入力内容を確認してください。',
      );
    }
  };

  // 起動時に捕捉済み証明書を読み込む
  useEffect(() => {
    chrome.storage.session.get('capture').then((data) => {
      const cap = data.capture as CaptureRecord | undefined;
      if (!cap) return;
      if (cap.error) {
        setError(cap.error);
      } else if (cap.pem) {
        setCapturedOrigin(cap.origin);
        handleParse(cap.pem, cap.origin);
      }
      // 消費後はプライバシーのため削除
      void chrome.storage.session.remove('capture');
    });
  }, []);

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
        <p className="app-subtitle">Server Certificate Viewer — ブラウザ拡張</p>
      </header>

      <main className="app-main">
        {capturedOrigin && (
          <p className="app-multi-note">
            🔎 <strong>{capturedOrigin}</strong>{' '}
            から取得した証明書を表示しています（ブラウザが実際に受け取ったもの）。
          </p>
        )}

        <CertificateInput onParse={(raw) => handleParse(raw)} errorMessage={error} />

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
            ツールバーの拡張アイコンを押すと、表示中サイトの証明書をここに表示します。
            証明書データはブラウザ内で完結し、外部へ送信されません。
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
