import forge from 'node-forge';
import type { ParsedCertificate } from '../types/certificate';
import type { ChainNode } from './chain';

export type VerifyStatus = 'verified' | 'failed' | 'unsupported' | 'no-issuer';

export interface NodeVerification {
  status: VerifyStatus;
  /** 利用者向けの説明 */
  detail: string;
}

const RSA_HASH: Record<string, string> = {
  '1.2.840.113549.1.1.5': 'SHA-1',
  '1.2.840.113549.1.1.11': 'SHA-256',
  '1.2.840.113549.1.1.12': 'SHA-384',
  '1.2.840.113549.1.1.13': 'SHA-512',
};

const ECDSA_HASH: Record<string, string> = {
  '1.2.840.10045.4.3.2': 'SHA-256',
  '1.2.840.10045.4.3.3': 'SHA-384',
  '1.2.840.10045.4.3.4': 'SHA-512',
  '1.2.840.10045.4.1': 'SHA-1',
};

/** バイナリ文字列を ArrayBuffer に変換 */
function toBuffer(bin: string): ArrayBuffer {
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** EC 曲線名 → 鍵の成分サイズ（バイト） と WebCrypto の namedCurve */
function curveParams(
  curve: string | undefined,
): { namedCurve: string; size: number } | null {
  if (!curve) return null;
  if (curve.includes('P-256')) return { namedCurve: 'P-256', size: 32 };
  if (curve.includes('P-384')) return { namedCurve: 'P-384', size: 48 };
  if (curve.includes('P-521')) return { namedCurve: 'P-521', size: 66 };
  return null;
}

/** INTEGER（バイナリ文字列）を符号バイト除去のうえ固定長へ左ゼロ詰め */
function toFixedLength(intBin: string, size: number): Uint8Array {
  let start = 0;
  while (start < intBin.length - 1 && intBin.charCodeAt(start) === 0) start++;
  const trimmed = intBin.slice(start);
  const out = new Uint8Array(size);
  const offset = size - trimmed.length;
  for (let i = 0; i < trimmed.length; i++) {
    out[offset + i] = trimmed.charCodeAt(i);
  }
  return out;
}

/** X.509 の DER エンコードされた ECDSA 署名(SEQUENCE{r,s}) を raw r||s へ変換 */
function ecdsaDerToRaw(derSig: string, size: number): ArrayBuffer {
  const seq = forge.asn1.fromDer(derSig);
  const parts = seq.value as forge.asn1.Asn1[];
  const r = toFixedLength(parts[0].value as string, size);
  const s = toFixedLength(parts[1].value as string, size);
  const out = new Uint8Array(size * 2);
  out.set(r, 0);
  out.set(s, size);
  return out.buffer;
}

/**
 * child の署名を issuer の公開鍵で暗号的に検証する。
 * 対応していない鍵種・曲線では例外を投げ、呼び出し側で 'unsupported' とする。
 */
async function verifySignature(
  child: ParsedCertificate,
  issuer: ParsedCertificate,
): Promise<boolean> {
  const oid = child.signatureAlgorithm.oid;
  const spki = toBuffer(issuer.rawSpki);
  const tbs = toBuffer(child.rawTbs);
  const subtle = globalThis.crypto.subtle;

  if (RSA_HASH[oid]) {
    const hash = RSA_HASH[oid];
    const key = await subtle.importKey(
      'spki',
      spki,
      { name: 'RSASSA-PKCS1-v1_5', hash },
      false,
      ['verify'],
    );
    return subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      toBuffer(child.rawSignature),
      tbs,
    );
  }

  if (ECDSA_HASH[oid]) {
    const hash = ECDSA_HASH[oid];
    const params = curveParams(issuer.publicKey.curve);
    if (!params) throw new Error('未対応のEC曲線');
    const key = await subtle.importKey(
      'spki',
      spki,
      { name: 'ECDSA', namedCurve: params.namedCurve },
      false,
      ['verify'],
    );
    return subtle.verify(
      { name: 'ECDSA', hash },
      key,
      ecdsaDerToRaw(child.rawSignature, params.size),
      tbs,
    );
  }

  if (oid === '1.3.101.112') {
    // Ed25519（ブラウザ対応は環境依存）
    const key = await subtle.importKey('spki', spki, { name: 'Ed25519' }, false, [
      'verify',
    ]);
    return subtle.verify(
      { name: 'Ed25519' },
      key,
      toBuffer(child.rawSignature),
      tbs,
    );
  }

  throw new Error('未対応の署名アルゴリズム');
}

/**
 * チェーン各証明書について、発行者の公開鍵で署名を検証する。
 * 戻り値は並び順インデックス → 検証結果。
 */
export async function verifyChain(
  nodes: ChainNode[],
): Promise<Map<number, NodeVerification>> {
  const results = new Map<number, NodeVerification>();

  await Promise.all(
    nodes.map(async (node, pos) => {
      let issuer: ParsedCertificate | undefined;
      if (node.cert.isSelfSigned) {
        issuer = node.cert;
      } else if (node.parentIndex !== null) {
        issuer = nodes[node.parentIndex].cert;
      }

      if (!issuer) {
        results.set(pos, {
          status: 'no-issuer',
          detail:
            '発行者の証明書が入力に含まれていないため、署名を検証できません。',
        });
        return;
      }

      try {
        const ok = await verifySignature(node.cert, issuer);
        results.set(pos, {
          status: ok ? 'verified' : 'failed',
          detail: ok
            ? node.cert.isSelfSigned
              ? '自身の公開鍵で署名を検証しました（自己署名として正当）。'
              : '発行者の公開鍵で署名を暗号的に検証しました。'
            : '署名の検証に失敗しました。発行者の鍵と一致しません。',
        });
      } catch (e) {
        results.set(pos, {
          status: 'unsupported',
          detail: `この鍵種別の自動検証には未対応です（${
            e instanceof Error ? e.message : '不明'
          }）。`,
        });
      }
    }),
  );

  return results;
}
