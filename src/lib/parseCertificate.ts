import forge from 'node-forge';
import type {
  AiaEntry,
  CertExtension,
  DistinguishedName,
  DnAttribute,
  ExtensionKind,
  NamedOid,
  ParsedCertificate,
  PublicKeyInfo,
  SanEntry,
} from '../types/certificate';
import {
  aiaMethodName,
  certificatePolicyName,
  dnShortName,
  ecCurveName,
  extKeyUsageName,
  extensionEnglishName,
  publicKeyAlgorithmName,
  signatureAlgorithmName,
} from './oids';

const asn1 = forge.asn1;
type Asn1 = forge.asn1.Asn1;
const CONTEXT = asn1.Class.CONTEXT_SPECIFIC;

/**
 * node-forge は fromDer の第2引数にオプションオブジェクトを受け付けるが、
 * @types/node-forge は boolean しか宣言していないためラップする。
 * BIT STRING の自動デコードを無効化し、署名値・公開鍵を生バイトのまま扱う。
 */
function fromDer(der: string): Asn1 {
  return (asn1.fromDer as unknown as (b: string, o: object) => Asn1)(der, {
    decodeBitStrings: false,
  });
}

/** 解析時のエラー（UI で利用者向けメッセージに使う） */
export class CertificateParseError extends Error {}

// ---------------------------------------------------------------------------
// バイト列ユーティリティ
// ---------------------------------------------------------------------------

/** バイト列をコロン区切りの16進にする（例: 6f:6e:7b） */
function hexColon(bytes: string, upper = false): string {
  const hex = forge.util.bytesToHex(bytes);
  const grouped = hex.match(/.{1,2}/g)?.join(':') ?? '';
  return upper ? grouped.toUpperCase() : grouped;
}

/** 子ノード配列を取り出す */
function kids(node: Asn1): Asn1[] {
  return node.value as Asn1[];
}

/** 葉ノードのバイト列を取り出す */
function bytes(node: Asn1): string {
  return node.value as string;
}

/** INTEGER（バイト列）のビット長を求める（RSA鍵長算出用） */
function integerBitLength(intBytes: string): number {
  let i = 0;
  while (i < intBytes.length && intBytes.charCodeAt(i) === 0) i++;
  if (i >= intBytes.length) return 0;
  let bits = (intBytes.length - i - 1) * 8;
  let first = intBytes.charCodeAt(i);
  while (first > 0) {
    bits++;
    first >>= 1;
  }
  return bits;
}

/** 小さな INTEGER を数値にする（version など） */
function integerToNumber(intBytes: string): number {
  const hex = forge.util.bytesToHex(intBytes);
  return hex ? parseInt(hex, 16) : 0;
}

/** DER の長さフィールドを読む（pos は長さの先頭バイト位置） */
function readDerLength(der: string, pos: number): { len: number; headerLen: number } {
  const b = der.charCodeAt(pos);
  if (b < 0x80) return { len: b, headerLen: 1 };
  const numBytes = b & 0x7f;
  let len = 0;
  for (let i = 0; i < numBytes; i++) {
    len = len * 256 + der.charCodeAt(pos + 1 + i);
  }
  return { len, headerLen: 1 + numBytes };
}

/**
 * 証明書DER(外側SEQUENCE)から、先頭の子要素 tbsCertificate の TLV を
 * バイト単位でそのまま切り出す。署名検証は原本バイトに対して行う必要があるため、
 * forge での再エンコードではなく原本から切り出す。
 */
function extractTbsDer(certDer: string): string {
  const outer = readDerLength(certDer, 1); // 外側SEQの長さは index1 から
  const contentStart = 1 + outer.headerLen;
  const childLen = readDerLength(certDer, contentStart + 1); // tbs の長さ
  const childTotal = 1 + childLen.headerLen + childLen.len;
  return certDer.substr(contentStart, childTotal);
}

// ---------------------------------------------------------------------------
// 入力 → DER バイト列
// ---------------------------------------------------------------------------

/**
 * PEM テキストまたは DER バイナリ（バイト文字列）から、含まれる証明書の
 * DER バイト列を取り出す。チェーン（複数 PEM）にも対応する。
 */
export function extractCertificateDers(raw: string): string[] {
  if (raw.includes('-----BEGIN CERTIFICATE-----')) {
    let messages: { type: string; body: string }[];
    try {
      messages = forge.pem.decode(raw) as { type: string; body: string }[];
    } catch {
      throw new CertificateParseError(
        'PEM の解析に失敗しました。-----BEGIN CERTIFICATE----- 〜 -----END CERTIFICATE----- の形式を確認してください。',
      );
    }
    const ders = messages
      .filter((m) => /CERTIFICATE/.test(m.type) && !/REQUEST/.test(m.type))
      .map((m) => m.body);
    if (ders.length === 0) {
      throw new CertificateParseError(
        '証明書が見つかりませんでした。秘密鍵や証明書要求(CSR)ではなく、証明書(CERTIFICATE)を入力してください。',
      );
    }
    return ders;
  }
  // 証明書以外の PEM（秘密鍵など）が入力された場合の案内
  if (/-----BEGIN [^-]*PRIVATE KEY-----/.test(raw)) {
    throw new CertificateParseError(
      '秘密鍵が入力されています。本アプリは秘密鍵を扱いません。証明書(CERTIFICATE)を入力してください。',
    );
  }
  if (/-----BEGIN /.test(raw)) {
    throw new CertificateParseError(
      '証明書(CERTIFICATE)以外のPEMが入力されています。-----BEGIN CERTIFICATE----- で始まる証明書を入力してください。',
    );
  }
  // PEM ヘッダが無ければ DER バイナリとみなす
  return [raw];
}

// ---------------------------------------------------------------------------
// 識別名（Name）
// ---------------------------------------------------------------------------

function parseDistinguishedName(name: Asn1): DistinguishedName {
  const attributes: DnAttribute[] = [];
  for (const rdn of kids(name)) {
    for (const atv of kids(rdn)) {
      const pair = kids(atv);
      const oid = asn1.derToOid(bytes(pair[0]));
      const value = bytes(pair[1]);
      attributes.push({ oid, shortName: dnShortName(oid), value });
    }
  }
  const find = (sn: string) =>
    attributes.find((a) => a.shortName === sn)?.value;
  return {
    attributes,
    commonName: find('CN'),
    organization: find('O'),
    organizationalUnit: find('OU'),
    country: find('C'),
    state: find('ST'),
    locality: find('L'),
  };
}

function sameName(a: DistinguishedName, b: DistinguishedName): boolean {
  if (a.attributes.length !== b.attributes.length) return false;
  const key = (d: DistinguishedName) =>
    d.attributes
      .map((x) => `${x.oid}=${x.value}`)
      .sort()
      .join('|');
  return key(a) === key(b);
}

// ---------------------------------------------------------------------------
// 公開鍵
// ---------------------------------------------------------------------------

function parsePublicKey(spki: Asn1): PublicKeyInfo {
  const algId = kids(spki)[0];
  const algOid = asn1.derToOid(bytes(kids(algId)[0]));
  const algorithmName = publicKeyAlgorithmName(algOid);

  if (algOid === '1.2.840.113549.1.1.1') {
    // RSA: BIT STRING 内の RSAPublicKey SEQUENCE から modulus を読む
    const bitString = kids(spki)[1];
    const content = bytes(bitString).slice(1); // 先頭の未使用ビット数オクテットを除く
    const rsaKey = fromDer(content);
    const modulus = bytes(kids(rsaKey)[0]);
    const keySizeBits = integerBitLength(modulus);
    return {
      algorithmOid: algOid,
      algorithmName: 'RSA',
      keySizeBits,
      summary: `RSA ${keySizeBits}bit`,
    };
  }

  if (algOid === '1.2.840.10045.2.1') {
    // EC: AlgorithmIdentifier の2番目が名前付き曲線 OID
    const params = kids(algId)[1];
    const curveOid = asn1.derToOid(bytes(params));
    const curve = ecCurveName(curveOid);
    return {
      algorithmOid: algOid,
      algorithmName: 'EC',
      curve,
      summary: `EC ${curve}`,
    };
  }

  // Ed25519 / Ed448 など
  return {
    algorithmOid: algOid,
    algorithmName,
    summary: algorithmName,
  };
}

// ---------------------------------------------------------------------------
// 拡張
// ---------------------------------------------------------------------------

const KEY_USAGE_NAMES = [
  'digitalSignature（デジタル署名）',
  'nonRepudiation / contentCommitment（否認防止）',
  'keyEncipherment（鍵の暗号化）',
  'dataEncipherment（データの暗号化）',
  'keyAgreement（鍵共有）',
  'keyCertSign（証明書への署名）',
  'cRLSign（CRLへの署名）',
  'encipherOnly（暗号化のみ）',
  'decipherOnly（復号のみ）',
];

function parseKeyUsage(content: Asn1): string[] {
  const data = bytes(content).slice(1); // 未使用ビット数を除く
  const usages: string[] = [];
  let bitIndex = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      if (byte & (1 << b)) {
        if (KEY_USAGE_NAMES[bitIndex]) usages.push(KEY_USAGE_NAMES[bitIndex]);
      }
      bitIndex++;
    }
  }
  return usages;
}

function parseExtKeyUsage(content: Asn1) {
  return kids(content).map((oidNode) => {
    const oid = asn1.derToOid(bytes(oidNode));
    return { oid, name: extKeyUsageName(oid) };
  });
}

function parseBasicConstraints(content: Asn1): { ca: boolean; pathLen?: number } {
  let ca = false;
  let pathLen: number | undefined;
  for (const child of kids(content)) {
    if (child.type === asn1.Type.BOOLEAN) {
      ca = bytes(child).charCodeAt(0) !== 0;
    } else if (child.type === asn1.Type.INTEGER) {
      pathLen = integerToNumber(bytes(child));
    }
  }
  return { ca, pathLen };
}

function formatIp(raw: string): string {
  if (raw.length === 4) {
    return Array.from(raw, (c) => c.charCodeAt(0)).join('.');
  }
  if (raw.length === 16) {
    return forge.util.bytesToHex(raw).match(/.{4}/g)?.join(':') ?? raw;
  }
  return hexColon(raw);
}

function parseSan(content: Asn1): SanEntry[] {
  const entries: SanEntry[] = [];
  for (const gn of kids(content)) {
    switch (gn.type) {
      case 2:
        entries.push({ type: 'DNS', value: bytes(gn) });
        break;
      case 7:
        entries.push({ type: 'IP', value: formatIp(bytes(gn)) });
        break;
      case 1:
        entries.push({ type: 'Email', value: bytes(gn) });
        break;
      case 6:
        entries.push({ type: 'URI', value: bytes(gn) });
        break;
      default:
        entries.push({ type: 'その他', value: `[${gn.type}]` });
    }
  }
  return entries;
}

/** Subject Key Identifier: OCTET STRING の中身（keyid） */
function parseSkid(content: Asn1): string {
  return hexColon(bytes(content), true);
}

/** Authority Key Identifier: SEQUENCE 内の [0] keyIdentifier */
function parseAkid(content: Asn1): string | undefined {
  for (const child of kids(content)) {
    if (child.tagClass === CONTEXT && child.type === 0 && !child.constructed) {
      return hexColon(bytes(child), true);
    }
  }
  return undefined;
}

/** CRL Distribution Points: 構造を再帰的に走査し URI([6]) を収集 */
function collectCrlUrls(node: Asn1): string[] {
  const urls: string[] = [];
  const walk = (n: Asn1) => {
    if (n.tagClass === CONTEXT && n.type === 6 && !n.constructed) {
      urls.push(bytes(n));
      return;
    }
    if (Array.isArray(n.value)) {
      for (const c of n.value as Asn1[]) walk(c);
    }
  };
  walk(node);
  return urls;
}

/** Authority Information Access: SEQUENCE OF { accessMethod OID, accessLocation [6] URI } */
function parseAia(content: Asn1): AiaEntry[] {
  const entries: AiaEntry[] = [];
  for (const desc of kids(content)) {
    const parts = kids(desc);
    const method = aiaMethodName(asn1.derToOid(bytes(parts[0])));
    const loc = parts[1];
    // accessLocation は通常 [6] URI
    if (loc && loc.tagClass === CONTEXT && loc.type === 6) {
      entries.push({ method, url: bytes(loc) });
    }
  }
  return entries;
}

/** Certificate Policies: SEQUENCE OF PolicyInformation { policyIdentifier OID, ... } */
function parsePolicies(content: Asn1): NamedOid[] {
  return kids(content).map((info) => {
    const oid = asn1.derToOid(bytes(kids(info)[0]));
    return { oid, name: certificatePolicyName(oid) };
  });
}

const EXTENSION_KIND: Record<string, ExtensionKind> = {
  '2.5.29.17': 'subjectAltName',
  '2.5.29.15': 'keyUsage',
  '2.5.29.37': 'extKeyUsage',
  '2.5.29.19': 'basicConstraints',
  '2.5.29.14': 'subjectKeyIdentifier',
  '2.5.29.35': 'authorityKeyIdentifier',
  '2.5.29.31': 'crlDistributionPoints',
  '1.3.6.1.5.5.7.1.1': 'authorityInfoAccess',
  '2.5.29.32': 'certificatePolicies',
  '1.3.6.1.4.1.11129.2.4.2': 'sct',
};

function parseExtension(extSeq: Asn1): CertExtension {
  const parts = kids(extSeq);
  const oid = asn1.derToOid(bytes(parts[0]));
  let critical = false;
  let octet: Asn1;
  if (parts.length === 3) {
    critical = bytes(parts[1]).charCodeAt(0) !== 0;
    octet = parts[2];
  } else {
    octet = parts[1];
  }

  const kind = EXTENSION_KIND[oid] ?? 'unsupported';
  const base: CertExtension = {
    oid,
    name: extensionEnglishName(oid),
    englishName: extensionEnglishName(oid),
    critical,
    kind,
    supported: kind !== 'unsupported',
  };

  if (kind === 'unsupported') {
    base.rawHex = hexColon(bytes(octet));
    return base;
  }

  // extnValue（OCTET STRING）の中身を DER として解析
  const content = fromDer(bytes(octet));
  switch (kind) {
    case 'subjectAltName':
      base.sanEntries = parseSan(content);
      break;
    case 'keyUsage':
      base.keyUsages = parseKeyUsage(content);
      break;
    case 'extKeyUsage':
      base.extKeyUsages = parseExtKeyUsage(content);
      break;
    case 'basicConstraints':
      base.basicConstraints = parseBasicConstraints(content);
      break;
    case 'subjectKeyIdentifier':
      base.keyIdentifier = parseSkid(content);
      break;
    case 'authorityKeyIdentifier':
      base.keyIdentifier = parseAkid(content);
      break;
    case 'crlDistributionPoints':
      base.crlUrls = collectCrlUrls(content);
      break;
    case 'authorityInfoAccess':
      base.aiaEntries = parseAia(content);
      break;
    case 'certificatePolicies':
      base.policies = parsePolicies(content);
      break;
    case 'sct':
      // SCTリストはTLSエンコードのため詳細解析はせず、存在の検出に留める
      base.sctCount = 1;
      break;
  }
  return base;
}

// ---------------------------------------------------------------------------
// 証明書本体
// ---------------------------------------------------------------------------

function parseTime(node: Asn1): Date {
  if (node.type === asn1.Type.UTCTIME) {
    return asn1.utcTimeToDate(bytes(node));
  }
  return asn1.generalizedTimeToDate(bytes(node));
}

/** 1枚の証明書（DER バイト列）を解析する */
export function parseCertificateDer(der: string): ParsedCertificate {
  let root: Asn1;
  try {
    root = fromDer(der);
  } catch {
    throw new CertificateParseError(
      '証明書を解析できませんでした。DER/PEM 形式の X.509 証明書か確認してください。',
    );
  }

  try {
    const tbs = kids(root)[0];
    const tbsChildren = kids(tbs);

    // version は [0] EXPLICIT（省略時は v1）
    let offset = 0;
    let version = 1;
    const first = tbsChildren[0];
    if (first.tagClass === CONTEXT && first.type === 0) {
      version = integerToNumber(bytes(kids(first)[0])) + 1;
      offset = 1;
    }

    const serialNumber = hexColon(bytes(tbsChildren[offset]));
    const issuer = parseDistinguishedName(tbsChildren[offset + 2]);
    const validitySeq = kids(tbsChildren[offset + 3]);
    const validity = {
      notBefore: parseTime(validitySeq[0]),
      notAfter: parseTime(validitySeq[1]),
    };
    const subject = parseDistinguishedName(tbsChildren[offset + 4]);
    const spkiNode = tbsChildren[offset + 5];
    const publicKey = parsePublicKey(spkiNode);
    const rawSpki = forge.asn1.toDer(spkiNode).getBytes();

    // 拡張: [3] EXPLICIT（存在すれば）
    const extensions: CertExtension[] = [];
    for (let i = offset + 6; i < tbsChildren.length; i++) {
      const node = tbsChildren[i];
      if (node.tagClass === CONTEXT && node.type === 3) {
        for (const extSeq of kids(kids(node)[0])) {
          extensions.push(parseExtension(extSeq));
        }
      }
    }

    // 署名アルゴリズム（外側）と署名値
    const sigAlgOid = asn1.derToOid(bytes(kids(kids(root)[1])[0]));
    const signatureAlgorithm = {
      oid: sigAlgOid,
      name: signatureAlgorithmName(sigAlgOid),
    };
    const sigBitString = kids(root)[2];
    const rawSignature = bytes(sigBitString).slice(1);
    const signatureValue = hexColon(rawSignature);

    // フィンガープリント（証明書全体の SHA-256）
    const md = forge.md.sha256.create();
    md.update(der);
    const fingerprintSha256 = hexColon(md.digest().getBytes(), true);

    return {
      version,
      serialNumber,
      signatureAlgorithm,
      issuer,
      subject,
      validity,
      publicKey,
      extensions,
      signatureValue,
      fingerprintSha256,
      isSelfSigned: sameName(subject, issuer),
      rawTbs: extractTbsDer(der),
      rawSignature,
      rawSpki,
    };
  } catch (e) {
    if (e instanceof CertificateParseError) throw e;
    throw new CertificateParseError(
      '証明書の構造を読み取れませんでした。対応していない形式の可能性があります。',
    );
  }
}

/** 入力（PEM/DER）から全証明書を解析する */
export function parseCertificates(raw: string): ParsedCertificate[] {
  return extractCertificateDers(raw).map(parseCertificateDer);
}
