import { Fragment } from 'react';
import type { ChainNode } from '../../lib/chain';
import type { NodeVerification } from '../../lib/verifyChain';
import { CertificateCard } from './CertificateCard';
import './ChainView.css';

interface ChainViewProps {
  nodes: ChainNode[];
  selectedIndex: number;
  verifications: Map<number, NodeVerification>;
  onSelect: (index: number) => void;
}

/**
 * 証明書チェーンの一覧表示 (F-05)。上=ルート、下=サーバ証明書で縦に並べ、
 * カード間を矢印で連結して「上位が下位に署名・発行する」関係を示す。
 */
export function ChainView({
  nodes,
  selectedIndex,
  verifications,
  onSelect,
}: ChainViewProps) {
  return (
    <section className="chain-view" aria-label="証明書チェーン">
      <div className="chain-view__header">
        <h2 className="chain-view__title">証明書チェーン（信頼の連鎖）</h2>
        <p className="chain-view__hint">
          カードを選択すると、その証明書の詳細を下に表示します。
        </p>
      </div>
      <div className="chain-view__list">
        {nodes.map((node, i) => (
          <Fragment key={i}>
            <CertificateCard
              node={node}
              selected={i === selectedIndex}
              verification={verifications.get(i)}
              onSelect={() => onSelect(i)}
            />
            {i < nodes.length - 1 && (
              <div className="chain-view__connector" aria-hidden="true">
                <span className="chain-view__connector-label">署名・発行</span>
                <span className="chain-view__connector-arrow">↓</span>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
