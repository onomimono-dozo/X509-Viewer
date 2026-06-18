import type { VerifyStatus } from '../../lib/verifyChain';
import './VerificationBadge.css';

interface VerificationBadgeProps {
  /** undefined は検証処理中 */
  status?: VerifyStatus;
}

const LABELS: Record<VerifyStatus, { text: string; cls: string }> = {
  verified: { text: '✓ 署名検証済み', cls: 'is-verified' },
  failed: { text: '✕ 検証失敗', cls: 'is-failed' },
  unsupported: { text: '— 自動検証未対応', cls: 'is-unsupported' },
  'no-issuer': { text: '? 発行者が入力に無い', cls: 'is-noissuer' },
};

/** 署名検証の結果バッジ（要件6.3「検証可能」表示） */
export function VerificationBadge({ status }: VerificationBadgeProps) {
  if (!status) {
    return <span className="verify-badge is-pending">検証中…</span>;
  }
  const { text, cls } = LABELS[status];
  return <span className={`verify-badge ${cls}`}>{text}</span>;
}
