/**
 * 解析済み証明書のドメインモデル。
 *
 * node-forge の高レベルAPI（certificateFromPem）は EC 証明書で例外を投げるため、
 * 本アプリでは ASN.1 を直接走査して RSA / EC / Ed25519 を一様に扱う。
 * このモデルは、表示に必要な情報を解析ロジックと UI の間で受け渡す中間表現である。
 */

/** 識別名（Distinguished Name）の1属性 */
export interface DnAttribute {
  /** OID（例: 2.5.4.3） */
  oid: string;
  /** 短縮名（例: CN, O, C） */
  shortName: string;
  /** 属性値（例: www.example.com） */
  value: string;
}

/** 識別名（Subject / Issuer） */
export interface DistinguishedName {
  attributes: DnAttribute[];
  commonName?: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  state?: string;
  locality?: string;
}

/** 公開鍵情報（Subject Public Key Info） */
export interface PublicKeyInfo {
  /** アルゴリズムOID */
  algorithmOid: string;
  /** アルゴリズム名（例: RSA, EC, Ed25519） */
  algorithmName: string;
  /** RSA鍵長（bit） */
  keySizeBits?: number;
  /** EC曲線名（例: P-256） */
  curve?: string;
  /** 人間向けの要約（例: "RSA 2048bit" / "EC P-256"） */
  summary: string;
}

/** 拡張のレンダリング種別 */
export type ExtensionKind =
  | 'subjectAltName'
  | 'keyUsage'
  | 'extKeyUsage'
  | 'basicConstraints'
  | 'subjectKeyIdentifier'
  | 'authorityKeyIdentifier'
  | 'crlDistributionPoints'
  | 'unsupported';

/** SAN の1エントリ */
export interface SanEntry {
  /** 種別（DNS / IP / Email / URI / Other） */
  type: string;
  value: string;
}

/** Extended Key Usage の1用途 */
export interface NamedOid {
  oid: string;
  name: string;
}

/** X.509 v3 拡張 */
export interface CertExtension {
  oid: string;
  /** 既知の日本語名（不明な場合は原語名/OID） */
  name: string;
  /** 原語フィールド名（例: Subject Alternative Name） */
  englishName: string;
  critical: boolean;
  kind: ExtensionKind;
  /** この版で値の詳細表示に対応しているか */
  supported: boolean;

  // 種別ごとのデコード済みペイロード
  sanEntries?: SanEntry[];
  keyUsages?: string[];
  extKeyUsages?: NamedOid[];
  basicConstraints?: { ca: boolean; pathLen?: number };
  keyIdentifier?: string;
  crlUrls?: string[];
  /** 未対応拡張の生値（16進） */
  rawHex?: string;
}

/** 解析済み証明書 */
export interface ParsedCertificate {
  /** バージョン（1 / 2 / 3） */
  version: number;
  /** シリアル番号（コロン区切り16進） */
  serialNumber: string;
  /** 署名アルゴリズム（押印アルゴリズム） */
  signatureAlgorithm: NamedOid;
  issuer: DistinguishedName;
  subject: DistinguishedName;
  validity: { notBefore: Date; notAfter: Date };
  publicKey: PublicKeyInfo;
  extensions: CertExtension[];
  /** 署名値（押印の実体・コロン区切り16進） */
  signatureValue: string;
  /** SHA-256 フィンガープリント（コロン区切り16進） */
  fingerprintSha256: string;
  /** 自己署名か（Subject と Issuer が一致） */
  isSelfSigned: boolean;

  /**
   * 署名検証用の生バイト（バイナリ文字列、1文字=1バイト）。表示には使わない。
   * rawTbs: 署名対象の tbsCertificate そのもの（原本のDERを切り出したもの）
   * rawSignature: 署名値（BIT STRING の未使用ビット数オクテットを除いた中身）
   * rawSpki: この証明書の公開鍵情報(SubjectPublicKeyInfo)のDER
   */
  rawTbs: string;
  rawSignature: string;
  rawSpki: string;
}

/** 解析結果（複数証明書に対応。Phase1 は先頭を表示） */
export interface ParseResult {
  certificates: ParsedCertificate[];
}
