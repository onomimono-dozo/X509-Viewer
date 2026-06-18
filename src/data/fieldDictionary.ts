/**
 * 各 X.509 フィールドの「日本語名・原語フィールド名・補足アナロジー」対訳辞書。
 * 要件定義書 4章・3.3 の表現を基準とする。UI はここを参照してラベルを描画する。
 */

export interface FieldMeta {
  /** 日本語名（大きく表示） */
  ja: string;
  /** 原語フィールド名（小・等幅で添える） */
  en: string;
  /** 補足アナロジー（「パスポートの氏名欄に相当」等） */
  note?: string;
  /** 行頭アイコン */
  icon?: string;
}

export const FIELD: Record<string, FieldMeta> = {
  // 基本領域
  version: { ja: '規格バージョン', en: 'Version', note: '書類の様式。現行はv3。', icon: '📄' },
  serialNumber: {
    ja: 'シリアル番号',
    en: 'Serial Number',
    note: '認証局が割り振る証明書の通し番号。',
    icon: '#️⃣',
  },
  subject: {
    ja: 'この証明書の名義',
    en: 'Subject',
    note: 'パスポートの氏名欄に相当。誰のための証明書か。',
    icon: '🪪',
  },
  issuer: {
    ja: '発行した認証局',
    en: 'Issuer',
    note: '押印した公証役場に相当。誰が発行したか。',
    icon: '🏛️',
  },
  validity: {
    ja: '有効期間',
    en: 'Validity',
    note: '証明書が有効な期間。パスポートの有効期限に相当。',
    icon: '📆',
  },
  publicKey: {
    ja: '公開鍵の種類と強度',
    en: 'Subject Public Key Info',
    note: '鍵の頑丈さ。錠前の複雑さに相当。',
    icon: '🔑',
  },

  // 拡張領域
  subjectAltName: {
    ja: '有効なドメイン名',
    en: 'Subject Alternative Name (SAN)',
    note: 'この証明書が有効なドメイン名の一覧。実際の照合はSANで行う。',
    icon: '🌐',
  },
  extKeyUsage: {
    ja: 'この証明書の用途',
    en: 'Extended Key Usage (EKU)',
    note: '何に使ってよい証明書か（例: TLSサーバ認証のみ）。',
    icon: '🎯',
  },
  keyUsage: {
    ja: '鍵の使用目的',
    en: 'Key Usage',
    note: '鍵を何に使ってよいか（署名・暗号化など）。',
    icon: '🔧',
  },
  basicConstraints: {
    ja: 'CAとしての権限',
    en: 'Basic Constraints',
    note: 'この証明書自体が認証局(CA)かどうか。',
    icon: '⚖️',
  },
  subjectKeyIdentifier: {
    ja: '自身の公開鍵ID',
    en: 'Subject Key Identifier (SKID)',
    note: 'この証明書の公開鍵を識別する指紋。',
    icon: '🆔',
  },
  authorityKeyIdentifier: {
    ja: '発行者の公開鍵ID',
    en: 'Authority Key Identifier (AKID)',
    note: '署名に使われた発行者の鍵を指す。チェーンの照合に使う。',
    icon: '🔗',
  },
  crlDistributionPoints: {
    ja: '失効リスト公開先',
    en: 'CRL Distribution Points',
    note: '失効した証明書の一覧(CRL)の公開先URL。',
    icon: '📋',
  },

  // 発行・運用情報（Phase3 追加）
  authorityInfoAccess: {
    ja: '機関情報アクセス',
    en: 'Authority Information Access (AIA)',
    note: '失効確認(OCSP)や発行者証明書の入手先URL。',
    icon: '📡',
  },
  certificatePolicies: {
    ja: '証明書ポリシー',
    en: 'Certificate Policies',
    note: 'どの審査基準で発行されたか（DV/OV/EV）。',
    icon: '📜',
  },
  sct: {
    ja: '証明書透明性ログ',
    en: 'Signed Certificate Timestamps (SCT)',
    note: '公開ログ(CT)に登録された証跡。改ざん検知に役立つ。',
    icon: '📰',
  },

  // 署名領域
  signatureAlgorithm: {
    ja: '押印アルゴリズム',
    en: 'Signature Algorithm',
    note: 'どの方式で押印（署名）したか。',
    icon: '🖊️',
  },
  signatureValue: {
    ja: '押印の実体（署名値）',
    en: 'Signature Value',
    note: '中身のハッシュを発行者の秘密鍵で署名した値。朱印の実体。',
    icon: '🔴',
  },
  fingerprint: {
    ja: 'フィンガープリント',
    en: 'SHA-256 Fingerprint',
    note: '証明書全体のハッシュ。証明書の指紋。',
    icon: '🫆',
  },
};
