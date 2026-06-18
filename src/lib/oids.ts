/**
 * OID 辞書。node-forge の oids には EC 系・EKU・一部拡張が含まれないため、
 * 表示に必要な OID を補う。原語名を返し、UI 側で日本語を添える。
 */

/** 署名アルゴリズム OID → 表示名 */
export const SIGNATURE_ALGORITHMS: Record<string, string> = {
  '1.2.840.113549.1.1.5': 'SHA-1 + RSA (sha1WithRSAEncryption)',
  '1.2.840.113549.1.1.11': 'SHA-256 + RSA (sha256WithRSAEncryption)',
  '1.2.840.113549.1.1.12': 'SHA-384 + RSA (sha384WithRSAEncryption)',
  '1.2.840.113549.1.1.13': 'SHA-512 + RSA (sha512WithRSAEncryption)',
  '1.2.840.113549.1.1.4': 'MD5 + RSA (md5WithRSAEncryption)',
  '1.2.840.10045.4.3.2': 'SHA-256 + ECDSA (ecdsa-with-SHA256)',
  '1.2.840.10045.4.3.3': 'SHA-384 + ECDSA (ecdsa-with-SHA384)',
  '1.2.840.10045.4.3.4': 'SHA-512 + ECDSA (ecdsa-with-SHA512)',
  '1.2.840.10045.4.1': 'SHA-1 + ECDSA (ecdsa-with-SHA1)',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
};

/** 公開鍵アルゴリズム OID → 名称 */
export const PUBLIC_KEY_ALGORITHMS: Record<string, string> = {
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.10045.2.1': 'EC',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
};

/** EC 名前付き曲線 OID → 名称 */
export const EC_CURVES: Record<string, string> = {
  '1.2.840.10045.3.1.7': 'P-256 (prime256v1 / secp256r1)',
  '1.3.132.0.34': 'P-384 (secp384r1)',
  '1.3.132.0.35': 'P-521 (secp521r1)',
  '1.3.132.0.10': 'secp256k1',
  '1.2.840.10045.3.1.1': 'P-192 (prime192v1)',
};

/** Extended Key Usage OID → 名称 */
export const EXT_KEY_USAGES: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': 'serverAuth（TLSサーバ認証）',
  '1.3.6.1.5.5.7.3.2': 'clientAuth（TLSクライアント認証）',
  '1.3.6.1.5.5.7.3.3': 'codeSigning（コード署名）',
  '1.3.6.1.5.5.7.3.4': 'emailProtection（メール保護）',
  '1.3.6.1.5.5.7.3.8': 'timeStamping（タイムスタンプ）',
  '1.3.6.1.5.5.7.3.9': 'OCSPSigning（OCSP署名）',
  '2.5.29.37.0': 'anyExtendedKeyUsage（任意）',
};

/** 拡張 OID → 原語フィールド名 */
export const EXTENSION_NAMES: Record<string, string> = {
  '2.5.29.14': 'Subject Key Identifier',
  '2.5.29.15': 'Key Usage',
  '2.5.29.17': 'Subject Alternative Name',
  '2.5.29.19': 'Basic Constraints',
  '2.5.29.31': 'CRL Distribution Points',
  '2.5.29.32': 'Certificate Policies',
  '2.5.29.35': 'Authority Key Identifier',
  '2.5.29.37': 'Extended Key Usage',
  '1.3.6.1.5.5.7.1.1': 'Authority Information Access',
  '1.3.6.1.4.1.11129.2.4.2': 'Signed Certificate Timestamps (SCT)',
};

/** DN 属性 OID → 短縮名 */
export const DN_ATTRIBUTES: Record<string, string> = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.5': 'serialNumber',
  '2.5.4.4': 'SN',
  '2.5.4.42': 'GN',
  '1.2.840.113549.1.9.1': 'E',
};

export function signatureAlgorithmName(oid: string): string {
  return SIGNATURE_ALGORITHMS[oid] ?? oid;
}

export function publicKeyAlgorithmName(oid: string): string {
  return PUBLIC_KEY_ALGORITHMS[oid] ?? oid;
}

export function extKeyUsageName(oid: string): string {
  return EXT_KEY_USAGES[oid] ?? oid;
}

export function ecCurveName(oid: string): string {
  return EC_CURVES[oid] ?? oid;
}

export function extensionEnglishName(oid: string): string {
  return EXTENSION_NAMES[oid] ?? oid;
}

export function dnShortName(oid: string): string {
  return DN_ATTRIBUTES[oid] ?? oid;
}
