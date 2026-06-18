import type { ReactNode } from 'react';
import type {
  CertExtension,
  DistinguishedName,
  ParsedCertificate,
} from '../../types/certificate';
import { FIELD } from '../../data/fieldDictionary';
import type { NodeVerification } from '../../lib/verifyChain';
import { FieldRow } from '../FieldRow/FieldRow';
import { Seal } from '../Seal/Seal';
import { VerificationBadge } from '../VerificationBadge/VerificationBadge';
import './CertificateDetail.css';

interface CertificateDetailProps {
  cert: ParsedCertificate;
  /** 朱印に記す発行者名（チェーン表示時に渡す） */
  sealText?: string;
  /** 押印者の説明（例: 「Example Root CA が押印」） */
  sealedByLabel?: string;
  /** 署名検証の結果 */
  verification?: NodeVerification;
}

const DN_LABELS: Record<string, string> = {
  CN: 'コモンネーム',
  O: '組織',
  OU: '部門',
  C: '国',
  ST: '都道府県',
  L: '市区町村',
  E: 'メール',
};

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(
    d.getUTCHours(),
  )}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}

function DnView({ dn }: { dn: DistinguishedName }) {
  if (dn.attributes.length === 0) return <span>（情報なし）</span>;
  return (
    <ul className="dn-list">
      {dn.attributes.map((a, i) => (
        <li key={i}>
          <span className="dn-list__label">
            {DN_LABELS[a.shortName] ?? a.shortName}
            <code className="orig-tag">{a.shortName}</code>
          </span>
          <span className="dn-list__value">{a.value}</span>
        </li>
      ))}
    </ul>
  );
}

function ValidityView({ cert }: { cert: ParsedCertificate }) {
  const now = Date.now();
  const { notBefore, notAfter } = cert.validity;
  const totalMs = notAfter.getTime() - notBefore.getTime();
  const remainingMs = notAfter.getTime() - now;
  const remainingDays = Math.ceil(remainingMs / 86_400_000);
  const totalDays = Math.round(totalMs / 86_400_000);
  const elapsed = Math.min(
    100,
    Math.max(0, ((now - notBefore.getTime()) / totalMs) * 100),
  );

  let status: string;
  let statusClass: string;
  if (remainingMs < 0) {
    status = '有効期限切れ';
    statusClass = 'is-expired';
  } else if (remainingDays <= 14) {
    status = `残り ${remainingDays} 日（期限間近）`;
    statusClass = 'is-warn';
  } else {
    status = `残り ${remainingDays} 日`;
    statusClass = 'is-ok';
  }

  return (
    <div className="validity">
      <div className="validity__dates">
        <span>{formatDate(notBefore)}</span>
        <span className="validity__arrow">→</span>
        <span>{formatDate(notAfter)}</span>
      </div>
      <div className="validity__bar" aria-hidden="true">
        <div
          className={`validity__bar-fill ${statusClass}`}
          style={{ width: `${elapsed}%` }}
        />
      </div>
      <div className={`validity__status ${statusClass}`}>
        {status}
        <span className="validity__total">（発行時点の有効日数: 約 {totalDays} 日）</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detail-section">
      <h3 className="detail-section__title">{title}</h3>
      <div className="detail-section__body">{children}</div>
    </section>
  );
}

export function CertificateDetail({
  cert,
  sealText,
  sealedByLabel,
  verification,
}: CertificateDetailProps) {
  const ext = (kind: CertExtension['kind']) =>
    cert.extensions.find((e) => e.kind === kind);

  const san = ext('subjectAltName');
  const eku = ext('extKeyUsage');
  const ku = ext('keyUsage');
  const bc = ext('basicConstraints');
  const skid = ext('subjectKeyIdentifier');
  const akid = ext('authorityKeyIdentifier');
  const crl = ext('crlDistributionPoints');
  const others = cert.extensions.filter((e) => e.kind === 'unsupported');

  const sigBytes = cert.signatureValue.split(':').length;

  return (
    <article className="cert-detail">
      <header className="cert-detail__header">
        <div className="cert-detail__title-block">
          <p className="cert-detail__eyebrow">この証明書の名義</p>
          <h2 className="cert-detail__cn">
            {cert.subject.commonName ?? '（コモンネームなし）'}
          </h2>
        </div>
        {cert.isSelfSigned && (
          <span className="cert-detail__badge is-selfsigned" title="Subject と Issuer が一致">
            自己署名
          </span>
        )}
      </header>

      {sealedByLabel && (
        <section className="seal-section">
          <Seal
            text={sealText ?? (cert.isSelfSigned ? '自己署名' : '発行者')}
            verified={verification?.status === 'verified'}
            size="lg"
          />
          <div className="seal-section__body">
            <div className="seal-section__head">
              <span className="seal-section__label">この証明書への押印（署名）</span>
              <VerificationBadge status={verification?.status} />
            </div>
            <p className="seal-section__by">{sealedByLabel}</p>
            <p className="seal-section__desc">
              押印の実体は「証明書の中身(tbsCertificate)のハッシュを、発行者の秘密鍵で
              署名した値」です。値は下部「技術仕様・押印」の{' '}
              <code className="orig-tag">Signature Value</code> に示します。検証には{' '}
              <code className="orig-tag">Authority Key Identifier</code>{' '}
              が指す発行者の公開鍵を用います。
            </p>
            {verification && (
              <p className="seal-section__detail">{verification.detail}</p>
            )}
          </div>
        </section>
      )}

      <Section title="基本情報">
        <FieldRow meta={FIELD.subject}>
          <DnView dn={cert.subject} />
        </FieldRow>
        <FieldRow meta={FIELD.issuer}>
          <DnView dn={cert.issuer} />
          {cert.isSelfSigned && (
            <p className="inline-note">
              発行者が名義と一致するため、認証局による押印がない自己署名証明書です。
            </p>
          )}
        </FieldRow>
        <FieldRow meta={FIELD.validity}>
          <ValidityView cert={cert} />
        </FieldRow>
        <FieldRow meta={FIELD.version}>
          v{cert.version}
          <code className="orig-tag">{`0x${(cert.version - 1).toString(16)}`}</code>
        </FieldRow>
        <FieldRow meta={FIELD.serialNumber}>
          <span className="mono">{cert.serialNumber}</span>
        </FieldRow>
      </Section>

      <Section title="用途・権限">
        <FieldRow meta={FIELD.subjectAltName} present={!!san} critical={san?.critical}>
          {san && (
            <ul className="value-list">
              {san.sanEntries?.map((e, i) => (
                <li key={i} className="value-chip">
                  <span className="value-chip__type">{e.type}</span>
                  <span className="mono">{e.value}</span>
                </li>
              ))}
            </ul>
          )}
        </FieldRow>

        <FieldRow meta={FIELD.extKeyUsage} present={!!eku} critical={eku?.critical}>
          {eku && (
            <ul className="value-list">
              {eku.extKeyUsages?.map((u, i) => (
                <li key={i}>
                  {u.name}
                  <code className="orig-tag">{u.oid}</code>
                </li>
              ))}
            </ul>
          )}
        </FieldRow>

        <FieldRow meta={FIELD.keyUsage} present={!!ku} critical={ku?.critical}>
          {ku && (
            <ul className="value-list">
              {ku.keyUsages?.map((u, i) => <li key={i}>{u}</li>)}
            </ul>
          )}
        </FieldRow>

        <FieldRow meta={FIELD.basicConstraints} present={!!bc} critical={bc?.critical}>
          {bc?.basicConstraints && (
            <span>
              {bc.basicConstraints.ca
                ? 'この証明書は認証局(CA)です'
                : 'この証明書自体はCAではありません'}
              <code className="orig-tag">
                CA:{bc.basicConstraints.ca ? 'TRUE' : 'FALSE'}
              </code>
              {bc.basicConstraints.pathLen !== undefined && (
                <span className="inline-note">
                  下位CAの最大段数 (pathLen): {bc.basicConstraints.pathLen}
                </span>
              )}
            </span>
          )}
        </FieldRow>
      </Section>

      <Section title="識別子・失効情報">
        <FieldRow
          meta={FIELD.subjectKeyIdentifier}
          present={!!skid?.keyIdentifier}
          critical={skid?.critical}
        >
          <span className="mono">{skid?.keyIdentifier}</span>
        </FieldRow>
        <FieldRow
          meta={FIELD.authorityKeyIdentifier}
          present={!!akid?.keyIdentifier}
          critical={akid?.critical}
        >
          <span className="mono">{akid?.keyIdentifier}</span>
        </FieldRow>
        <FieldRow
          meta={FIELD.crlDistributionPoints}
          present={!!crl?.crlUrls?.length}
          critical={crl?.critical}
        >
          <ul className="value-list">
            {crl?.crlUrls?.map((u, i) => (
              <li key={i} className="mono">
                {u}
              </li>
            ))}
          </ul>
        </FieldRow>
      </Section>

      <Section title="技術仕様・押印">
        <FieldRow meta={FIELD.publicKey}>
          {cert.publicKey.summary}
          <code className="orig-tag">{cert.publicKey.algorithmName}</code>
        </FieldRow>
        <FieldRow meta={FIELD.signatureAlgorithm}>
          {cert.signatureAlgorithm.name}
        </FieldRow>
        <FieldRow meta={FIELD.signatureValue}>
          <div className="sig-value mono">{cert.signatureValue}</div>
          <p className="inline-note">全 {sigBytes} バイト</p>
        </FieldRow>
        <FieldRow meta={FIELD.fingerprint}>
          <div className="sig-value mono">{cert.fingerprintSha256}</div>
        </FieldRow>
      </Section>

      {others.length > 0 && (
        <Section title="その他の拡張">
          <p className="inline-note">
            以下の拡張は検出されましたが、値の詳細表示は次フェーズ(Phase3)で対応します。
          </p>
          <ul className="value-list">
            {others.map((e, i) => (
              <li key={i}>
                {e.englishName}
                <code className="orig-tag">{e.oid}</code>
                {e.critical && <span className="field-row__critical">CRITICAL</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}
