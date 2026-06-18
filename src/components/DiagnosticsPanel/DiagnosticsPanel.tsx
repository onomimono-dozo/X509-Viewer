import type { Diagnostic } from '../../lib/diagnostics';
import './DiagnosticsPanel.css';

interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
  /** ドメイン照合の入力値 */
  targetDomain: string;
  onTargetDomainChange: (value: string) => void;
  /** 対象がサーバ証明書(leaf)か（ドメイン照合欄の表示制御） */
  showDomainInput: boolean;
}

const SEVERITY_META = {
  critical: { icon: '⛔', label: '重大', cls: 'is-critical' },
  warning: { icon: '⚠️', label: '注意', cls: 'is-warning' },
  info: { icon: 'ℹ️', label: '情報', cls: 'is-info' },
} as const;

/**
 * 異常検出・診断パネル (F-07)。証明書から読み取れる事実に基づく注意点を、
 * 判断根拠フィールド付きで一覧表示する。
 */
export function DiagnosticsPanel({
  diagnostics,
  targetDomain,
  onTargetDomainChange,
  showDomainInput,
}: DiagnosticsPanelProps) {
  return (
    <section className="diag-panel" aria-label="診断結果">
      <div className="diag-panel__header">
        <h2 className="diag-panel__title">診断結果</h2>
        {showDomainInput && (
          <label className="diag-panel__domain">
            <span>アクセス先ドメインと照合（任意）</span>
            <input
              type="text"
              placeholder="例: www.example.com"
              value={targetDomain}
              onChange={(e) => onTargetDomainChange(e.target.value)}
              spellCheck={false}
            />
          </label>
        )}
      </div>

      {diagnostics.length === 0 ? (
        <p className="diag-panel__empty">
          ✓ 目立った異常は検出されませんでした。
        </p>
      ) : (
        <ul className="diag-list">
          {diagnostics.map((d) => {
            const meta = SEVERITY_META[d.severity];
            return (
              <li key={d.id} className={`diag-item ${meta.cls}`}>
                <span className="diag-item__icon" aria-hidden="true">
                  {meta.icon}
                </span>
                <div className="diag-item__body">
                  <div className="diag-item__head">
                    <span className="diag-item__severity">{meta.label}</span>
                    <span className="diag-item__title">{d.title}</span>
                  </div>
                  <p className="diag-item__message">{d.message}</p>
                  <p className="diag-item__basis">
                    <span className="diag-item__basis-label">判断根拠</span>
                    {d.basis}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
