import type { ReactNode } from 'react';
import type {
  CertExtension,
  DistinguishedName,
  ParsedCertificate,
} from '../../types/certificate';
import './CertificateTree.css';

interface CertificateTreeProps {
  cert: ParsedCertificate;
}

/** 長い16進を「先頭…＋全バイト数」で短縮（ツリーをコンパクトに保つ） */
function truncateHex(hexColon: string, headBytes = 16): string {
  const groups = hexColon.split(':');
  if (groups.length <= headBytes) return hexColon;
  return `${groups.slice(0, headBytes).join(':')} … （全 ${groups.length} バイト）`;
}

function dnInline(dn: DistinguishedName): string {
  if (dn.attributes.length === 0) return '（情報なし）';
  return dn.attributes.map((a) => `${a.shortName}=${a.value}`).join(', ');
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
}

/** ツリーの1ノード（ラベル＋原語＋値） */
function Node({
  icon,
  ja,
  en,
  value,
  children,
}: {
  icon?: string;
  ja: string;
  en?: string;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="ctree__item">
      <div className="ctree__row">
        {icon && <span className="ctree__icon">{icon}</span>}
        <span className="ctree__ja">{ja}</span>
        {en && <code className="ctree__en">{en}</code>}
        {value !== undefined && <span className="ctree__value">{value}</span>}
      </div>
      {children && <ul className="ctree__children">{children}</ul>}
    </li>
  );
}

/**
 * 証明書の階層構造（木構造）図解。
 * tbsCertificate（署名対象の本体）を枠で囲み、署名値へ「この本体に署名」と結線して、
 * 公開鍵“だけ”でなく本体全体がまとめて署名されることを伝える。
 */
export function CertificateTree({ cert }: CertificateTreeProps) {
  const pk = cert.publicKey;

  return (
    <div className="ctree">
      <p className="ctree__legend">
        証明書は階層構造（ASN.1）です。下の<strong>青い枠＝署名対象の本体
        (tbsCertificate)</strong>。
        発行者(CA)はこの枠の中身を1つにまとめてハッシュし、その<strong>
        ハッシュに自分の秘密鍵で署名</strong>します。
      </p>

      <ul className="ctree__root">
        <Node icon="📜" ja="証明書" en="Certificate">
          {/* === 署名対象の本体 === */}
          <li className="ctree__item">
            <div className="ctree__signed">
              <div className="ctree__signed-head">
                📝 署名対象の本体 <code className="ctree__en">tbsCertificate</code>
                <span className="ctree__signed-note">
                  ← この枠の全体が署名される
                </span>
              </div>
              <ul className="ctree__children ctree__children--signed">
                <Node icon="📄" ja="規格バージョン" en="version" value={`v${cert.version}`} />
                <Node
                  icon="#️⃣"
                  ja="シリアル番号"
                  en="serialNumber"
                  value={<code className="ctree__mono">{truncateHex(cert.serialNumber, 12)}</code>}
                />
                <Node
                  icon="🖊️"
                  ja="署名アルゴリズム(予告)"
                  en="signature"
                  value={cert.signatureAlgorithm.name}
                />
                <Node
                  icon="🏛️"
                  ja="発行者"
                  en="issuer"
                  value={<span className="ctree__dn">{dnInline(cert.issuer)}</span>}
                />
                <Node icon="📆" ja="有効期間" en="validity">
                  <Node ja="開始" en="notBefore" value={formatDate(cert.validity.notBefore)} />
                  <Node ja="終了" en="notAfter" value={formatDate(cert.validity.notAfter)} />
                </Node>
                <Node
                  icon="🪪"
                  ja="名義"
                  en="subject"
                  value={<span className="ctree__dn">{dnInline(cert.subject)}</span>}
                />
                {/* サーバの公開鍵 */}
                <Node icon="🔑" ja="サーバの公開鍵" en="subjectPublicKeyInfo">
                  <Node ja="アルゴリズムと強度" value={pk.summary} />
                  {pk.rsaModulusHex && (
                    <>
                      <Node
                        ja="係数"
                        en="modulus"
                        value={
                          <code className="ctree__mono">{truncateHex(pk.rsaModulusHex)}</code>
                        }
                      />
                      <Node ja="公開指数" en="exponent" value={pk.rsaExponent} />
                    </>
                  )}
                  {pk.ecPointHex && (
                    <Node
                      ja="公開鍵の点"
                      en="04‖X‖Y"
                      value={<code className="ctree__mono">{truncateHex(pk.ecPointHex)}</code>}
                    />
                  )}
                </Node>
                {/* 拡張 */}
                <Node icon="🧩" ja="拡張領域" en="extensions">
                  {cert.extensions.length === 0 ? (
                    <Node ja="（拡張なし）" />
                  ) : (
                    cert.extensions.map((e: CertExtension, i) => (
                      <Node
                        key={i}
                        ja={e.name === e.englishName ? e.englishName : e.name}
                        en={e.englishName}
                        value={
                          e.critical ? (
                            <span className="ctree__critical">CRITICAL</span>
                          ) : undefined
                        }
                      />
                    ))
                  )}
                </Node>
              </ul>
            </div>
          </li>

          {/* === 署名アルゴリズムと署名値 === */}
          <Node
            icon="🖊️"
            ja="署名アルゴリズム"
            en="signatureAlgorithm"
            value={cert.signatureAlgorithm.name}
          />
          <Node
            icon="🔴"
            ja="署名値"
            en="signatureValue"
            value={<code className="ctree__mono">{truncateHex(cert.signatureValue)}</code>}
          >
            <li className="ctree__callout">
              ↑ 上の青い枠「本体 (tbsCertificate)」のハッシュを、発行者の秘密鍵で
              署名した値です。だから本体を1文字でも書き換えると、この署名と合わなくなり
              改ざんを検出できます。
            </li>
          </Node>
        </Node>
      </ul>
    </div>
  );
}
