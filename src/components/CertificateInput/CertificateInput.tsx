import { useRef, useState } from 'react';
import './CertificateInput.css';

interface CertificateInputProps {
  /** 解析を要求する。raw は PEM テキストまたは DER バイト文字列 */
  onParse: (raw: string) => void;
  /** 直近の解析エラー（あれば表示） */
  errorMessage?: string;
}

type Tab = 'pem' | 'file';

/** ArrayBuffer をバイナリ文字列（1文字=1バイト）に変換する */
function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    result += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return result;
}

/**
 * 証明書入力 (F-01)。PEM貼り付け / ファイルアップロードの2方式をタブで切替。
 * いずれもブラウザ内で解析が完結し、データを外部へ送信しない。
 */
export function CertificateInput({ onParse, errorMessage }: CertificateInputProps) {
  const [tab, setTab] = useState<Tab>('pem');
  const [pemText, setPemText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const raw = arrayBufferToBinaryString(reader.result as ArrayBuffer);
      onParse(raw);
    };
    reader.readAsArrayBuffer(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <section className="cert-input" aria-label="証明書の入力">
      <div className="cert-input__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'pem'}
          className={`cert-input__tab${tab === 'pem' ? ' is-active' : ''}`}
          onClick={() => setTab('pem')}
        >
          PEMテキスト貼り付け
        </button>
        <button
          role="tab"
          aria-selected={tab === 'file'}
          className={`cert-input__tab${tab === 'file' ? ' is-active' : ''}`}
          onClick={() => setTab('file')}
        >
          ファイルアップロード
        </button>
      </div>

      {tab === 'pem' && (
        <div className="cert-input__panel">
          <textarea
            className="cert-input__textarea"
            placeholder={'-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----'}
            value={pemText}
            onChange={(e) => setPemText(e.target.value)}
            spellCheck={false}
            rows={8}
          />
          <button
            className="cert-input__submit"
            disabled={pemText.trim().length === 0}
            onClick={() => onParse(pemText)}
          >
            証明書を解析する
          </button>
        </div>
      )}

      {tab === 'file' && (
        <div className="cert-input__panel">
          <div
            className={`cert-input__drop${dragOver ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
          >
            <p className="cert-input__drop-main">
              ここにファイルをドラッグ＆ドロップ
            </p>
            <p className="cert-input__drop-sub">
              またはクリックして選択（.pem / .crt / .cer / .der）
            </p>
            {fileName && <p className="cert-input__filename">選択中: {fileName}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pem,.crt,.cer,.der,application/x-x509-ca-cert,application/pkix-cert"
            className="cert-input__file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}

      {errorMessage && (
        <p className="cert-input__error" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
