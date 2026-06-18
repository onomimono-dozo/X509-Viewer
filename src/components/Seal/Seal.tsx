import './Seal.css';

interface SealProps {
  /** 朱印に記す文字（発行者名 or 「自己署名」） */
  text: string;
  /** 検証が取れているか（取れていれば実線、未検証は破線で表現） */
  verified?: boolean;
  size?: 'sm' | 'lg';
}

/** 印影に収まるよう、長い名前は短縮する */
function condense(text: string): string {
  const t = text.replace(/\s+/g, '');
  return t.length > 8 ? t.slice(0, 7) + '…' : t;
}

/**
 * 認証局の押印（署名）を朱印（円形スタンプ）として表現する (F-06)。
 */
export function Seal({ text, verified = false, size = 'sm' }: SealProps) {
  return (
    <div
      className={`seal seal--${size}${verified ? ' is-verified' : ''}`}
      role="img"
      aria-label={`押印: ${text}`}
      title={text}
    >
      <span className="seal__inner">{condense(text)}</span>
      <span className="seal__mark">印</span>
    </div>
  );
}
