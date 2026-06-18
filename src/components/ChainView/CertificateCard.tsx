import type { ChainNode } from '../../lib/chain';
import { roleLabel, sealText } from '../../lib/chain';
import type { NodeVerification } from '../../lib/verifyChain';
import { Seal } from '../Seal/Seal';
import { VerificationBadge } from '../VerificationBadge/VerificationBadge';

interface CertificateCardProps {
  node: ChainNode;
  selected: boolean;
  verification?: NodeVerification;
  onSelect: () => void;
}

const ROLE_CLASS = {
  root: 'is-root',
  intermediate: 'is-intermediate',
  leaf: 'is-leaf',
} as const;

/** チェーン上の1証明書を表すカード (F-05/F-06) */
export function CertificateCard({
  node,
  selected,
  verification,
  onSelect,
}: CertificateCardProps) {
  const { cert, role } = node;
  return (
    <button
      type="button"
      className={`cert-card ${ROLE_CLASS[role]}${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="cert-card__main">
        <span className={`cert-card__role ${ROLE_CLASS[role]}`}>
          {roleLabel(role)}
        </span>
        <div className="cert-card__name">
          {cert.subject.commonName ?? '（コモンネームなし）'}
        </div>
        <div className="cert-card__issuer">
          発行者: {cert.issuer.commonName ?? '（不明）'}
        </div>
        <div className="cert-card__badges">
          <VerificationBadge status={verification?.status} />
        </div>
      </div>
      <div className="cert-card__seal">
        <Seal
          text={sealText(node)}
          verified={verification?.status === 'verified'}
        />
        <span className="cert-card__seal-caption">{node.sealedByLabel}</span>
      </div>
    </button>
  );
}
