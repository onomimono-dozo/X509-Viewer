import type { ReactNode } from 'react';
import type { FieldMeta } from '../../data/fieldDictionary';
import './FieldRow.css';

interface FieldRowProps {
  meta: FieldMeta;
  /** 値の表示内容。present=false のときは無視され「含まれていません」を表示 */
  children?: ReactNode;
  /** critical 拡張か（赤タグを表示） */
  critical?: boolean;
  /** この項目が証明書に含まれているか（false なら不在を明示） */
  present?: boolean;
}

/**
 * 1フィールドを「アイコン＋日本語ラベル（原語添え）＋値＋補足」の4要素で表示する。
 * 要件 3.3 / 6.4 の表示ルールに対応。
 */
export function FieldRow({
  meta,
  children,
  critical = false,
  present = true,
}: FieldRowProps) {
  return (
    <div className={`field-row${present ? '' : ' field-row--absent'}`}>
      <div className="field-row__icon" aria-hidden="true">
        {meta.icon ?? '•'}
      </div>
      <div className="field-row__body">
        <div className="field-row__label">
          <span className="field-row__ja">{meta.ja}</span>
          <code className="field-row__en">{meta.en}</code>
          {critical && (
            <span className="field-row__critical" title="無視してはならない拡張">
              CRITICAL
            </span>
          )}
        </div>
        <div className="field-row__value">
          {present ? children : <span className="field-row__absent">含まれていません</span>}
        </div>
        {meta.note && <p className="field-row__note">{meta.note}</p>}
      </div>
    </div>
  );
}
