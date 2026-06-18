import type { CertExtension, ParsedCertificate } from '../types/certificate';
import { matchInspectionVendor } from '../data/knownProxies';
import type { CertRole } from './chain';
import { isCa } from './chain';

export type DiagnosticSeverity = 'critical' | 'warning' | 'info';

export interface Diagnostic {
  id: string;
  severity: DiagnosticSeverity;
  /** 見出し */
  title: string;
  /** 表示メッセージ */
  message: string;
  /** 判断根拠（どのフィールドを見て判断したか） */
  basis: string;
}

export interface DiagnosticOptions {
  /** 照合したいアクセス先ドメイン（任意） */
  targetDomain?: string;
}

const MD5_RSA = '1.2.840.113549.1.1.4';
const SHA1_RSA = '1.2.840.113549.1.1.5';
const SHA1_ECDSA = '1.2.840.10045.4.1';

function findExt(
  cert: ParsedCertificate,
  kind: CertExtension['kind'],
): CertExtension | undefined {
  return cert.extensions.find((e) => e.kind === kind);
}

/** SAN の DNS 名一覧（CN も補助的に加える） */
function dnsNames(cert: ParsedCertificate): string[] {
  const san = findExt(cert, 'subjectAltName');
  const names =
    san?.sanEntries?.filter((e) => e.type === 'DNS').map((e) => e.value) ?? [];
  if (cert.subject.commonName) names.push(cert.subject.commonName);
  return [...new Set(names)];
}

/** ワイルドカード対応のドメイン照合 */
function domainMatches(pattern: string, domain: string): boolean {
  const p = pattern.toLowerCase();
  const d = domain.toLowerCase();
  if (p === d) return true;
  if (p.startsWith('*.')) {
    const base = p.slice(2);
    const dot = d.indexOf('.');
    return dot >= 0 && d.slice(dot + 1) === base;
  }
  return false;
}

const DAY = 86_400_000;

/**
 * 証明書から読み取れる事実に基づき、注意すべき状態を検出する (F-07)。
 * 各診断には判断根拠フィールドを必ず添える。
 */
export function runDiagnostics(
  cert: ParsedCertificate,
  role: CertRole,
  options: DiagnosticOptions = {},
): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const now = Date.now();

  // 1. SSLインスペクション（既知プロキシ業者が発行者）
  const vendor =
    matchInspectionVendor(cert.issuer.organization) ??
    matchInspectionVendor(cert.issuer.commonName);
  if (vendor) {
    diags.push({
      id: 'ssl-inspection',
      severity: 'warning',
      title: 'SSLインスペクションの可能性',
      message:
        'この通信は企業プロキシ等で復号・再暗号化されている可能性があります。発行者が既知のインスペクション製品です。',
      basis: `Issuer（発行者）に "${vendor}" を検出`,
    });
  }

  // 2. 自己署名
  if (cert.isSelfSigned) {
    if (isCa(cert) || role === 'root') {
      diags.push({
        id: 'self-signed-root',
        severity: 'info',
        title: '自己署名（信頼の起点）',
        message:
          'これは信頼の起点となるルート認証局の証明書です。ルートが自己署名であるのは正常です。',
        basis: 'Subject と Issuer が一致（CA:TRUE）',
      });
    } else {
      diags.push({
        id: 'self-signed-leaf',
        severity: 'warning',
        title: '自己署名証明書',
        message:
          '認証局による署名がありません。第三者の認証局に裏付けられていない証明書です。',
        basis: 'Subject と Issuer が一致（CA:FALSE）',
      });
    }
  }

  // 3. 弱い署名アルゴリズム
  const sigOid = cert.signatureAlgorithm.oid;
  if (sigOid === MD5_RSA) {
    diags.push({
      id: 'weak-sig-md5',
      severity: 'critical',
      title: '危険な署名アルゴリズム (MD5)',
      message: '古く危殆化したMD5が署名に使われています。偽造のリスクがあります。',
      basis: `Signature Algorithm = ${cert.signatureAlgorithm.name}`,
    });
  } else if (sigOid === SHA1_RSA || sigOid === SHA1_ECDSA) {
    diags.push({
      id: 'weak-sig-sha1',
      severity: 'warning',
      title: '非推奨の署名アルゴリズム (SHA-1)',
      message: 'SHA-1は衝突耐性が破られており、現在は非推奨です。',
      basis: `Signature Algorithm = ${cert.signatureAlgorithm.name}`,
    });
  }

  // 4. 弱い鍵長（RSA 1024bit 以下）
  if (
    cert.publicKey.algorithmName === 'RSA' &&
    cert.publicKey.keySizeBits !== undefined &&
    cert.publicKey.keySizeBits <= 1024
  ) {
    diags.push({
      id: 'weak-key',
      severity: 'critical',
      title: '鍵長が不十分',
      message: `RSA ${cert.publicKey.keySizeBits}bit は現在では不十分です（2048bit以上を推奨）。`,
      basis: `Subject Public Key Info = ${cert.publicKey.summary}`,
    });
  }

  // 5. 有効期限切れ／期限間近
  const remainingDays = Math.ceil((cert.validity.notAfter.getTime() - now) / DAY);
  if (remainingDays < 0) {
    diags.push({
      id: 'expired',
      severity: 'critical',
      title: '有効期限切れ',
      message: `この証明書は ${-remainingDays} 日前に失効しています。`,
      basis: `Not After = ${cert.validity.notAfter.toISOString().slice(0, 10)}`,
    });
  } else if (remainingDays <= 14) {
    diags.push({
      id: 'expiring-soon',
      severity: 'warning',
      title: '有効期限が間近',
      message: `あと ${remainingDays} 日で有効期限が切れます。`,
      basis: `Not After = ${cert.validity.notAfter.toISOString().slice(0, 10)}`,
    });
  }

  // 6. 短命証明書（発行時点の有効日数が極端に短い）
  const totalDays = Math.round(
    (cert.validity.notAfter.getTime() - cert.validity.notBefore.getTime()) / DAY,
  );
  if (totalDays <= 14 && remainingDays >= 0) {
    diags.push({
      id: 'short-lived',
      severity: 'info',
      title: '短命証明書',
      message: `発行時点の有効期間が約 ${totalDays} 日と通常より短い証明書です。`,
      basis: `Validity（有効期間）= 約 ${totalDays} 日`,
    });
  }

  // 7. 名義とドメインの不一致（任意指定のドメインと SAN を照合）
  const target = options.targetDomain?.trim();
  if (target && role === 'leaf') {
    const names = dnsNames(cert);
    const matched = names.some((n) => domainMatches(n, target));
    if (matched) {
      diags.push({
        id: 'domain-match',
        severity: 'info',
        title: 'ドメイン一致',
        message: `"${target}" はこの証明書の有効なドメイン名に含まれます。`,
        basis: `Subject Alternative Name に一致あり`,
      });
    } else {
      diags.push({
        id: 'domain-mismatch',
        severity: 'critical',
        title: '名義とドメインの不一致',
        message: `この証明書は "${target}" 用ではありません。SANに該当ドメインが含まれていません。`,
        basis: `Subject Alternative Name = ${names.join(', ') || '（なし）'}`,
      });
    }
  }

  // 8. 証明書透明性ログ(SCT)の欠如（TLSサーバ証明書のみ対象）
  if (role === 'leaf' && !cert.isSelfSigned) {
    const hasSct = !!findExt(cert, 'sct');
    if (!hasSct) {
      diags.push({
        id: 'no-sct',
        severity: 'info',
        title: '透明性ログ(SCT)の欠如',
        message:
          '公開のCertificate Transparencyログに登録された証跡(SCT)が見当たりません。',
        basis: 'SCT 拡張（1.3.6.1.4.1.11129.2.4.2）が存在しない',
      });
    }
  }

  // 重大度順に並べる
  const order: Record<DiagnosticSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return diags.sort((a, b) => order[a.severity] - order[b.severity]);
}
