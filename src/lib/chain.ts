import type { CertExtension, ParsedCertificate } from '../types/certificate';

export type CertRole = 'root' | 'intermediate' | 'leaf';

export interface ChainNode {
  cert: ParsedCertificate;
  /** 入力時の元インデックス（初期選択の判定に使う） */
  inputIndex: number;
  role: CertRole;
  /** この証明書を署名・発行した親（チェーン内）の並び順インデックス。なければ null */
  parentIndex: number | null;
  /** 押印者ラベル（朱印に記す）例: '自己署名' / 'Example Root CA が押印' */
  sealedByLabel: string;
  /** 親がこの入力セットに含まれているか */
  hasIssuerInSet: boolean;
}

function ext(
  cert: ParsedCertificate,
  kind: CertExtension['kind'],
): CertExtension | undefined {
  return cert.extensions.find((e) => e.kind === kind);
}

/** Subject Key Identifier（自身の鍵ID） */
function skid(cert: ParsedCertificate): string | undefined {
  return ext(cert, 'subjectKeyIdentifier')?.keyIdentifier;
}

/** Authority Key Identifier（発行者の鍵ID） */
function akid(cert: ParsedCertificate): string | undefined {
  return ext(cert, 'authorityKeyIdentifier')?.keyIdentifier;
}

/** BasicConstraints の CA フラグ。拡張が無ければ end-entity 扱い（false） */
export function isCa(cert: ParsedCertificate): boolean {
  return ext(cert, 'basicConstraints')?.basicConstraints?.ca ?? false;
}

/** 識別名を比較用の正規化キーにする */
function dnKey(cert: ParsedCertificate, which: 'subject' | 'issuer'): string {
  return cert[which].attributes
    .map((a) => `${a.oid}=${a.value.trim().toLowerCase()}`)
    .sort()
    .join('|');
}

function role(cert: ParsedCertificate): CertRole {
  if (cert.isSelfSigned && isCa(cert)) return 'root';
  if (isCa(cert)) return 'intermediate';
  return 'leaf';
}

/**
 * 親（発行者）証明書を入力セット内から探す。
 * 優先度: ① AKID == 親のSKID、② 自身のissuer DN == 親のsubject DN。
 * 自己署名はスキップ（自分自身を親にしない）。
 */
function findParent(
  cert: ParsedCertificate,
  index: number,
  certs: ParsedCertificate[],
): number | null {
  const myAkid = akid(cert);
  const myIssuer = dnKey(cert, 'issuer');

  // ① AKID/SKID 照合
  if (myAkid) {
    const byKid = certs.findIndex(
      (c, i) => i !== index && skid(c) === myAkid,
    );
    if (byKid >= 0) return byKid;
  }
  // ② 名義(subject) と発行者(issuer) の DN 照合
  const byName = certs.findIndex(
    (c, i) => i !== index && dnKey(c, 'subject') === myIssuer,
  );
  return byName >= 0 ? byName : null;
}

/**
 * 入力された証明書群を、起点（end-entity）からルートへと並べたチェーンに整列する。
 * 親子関係は AKID/SKID と DN 照合で判定する（要件6.2）。
 *
 * 並び順: 配列の先頭をルート、末尾を end-entity とする（上位が下位に署名・発行する
 * 関係を上から下へ表現するため）。
 */
export function buildChain(certs: ParsedCertificate[]): ChainNode[] {
  // 元インデックス → 親の元インデックス
  const parentOf = certs.map((c, i) => findParent(c, i, certs));

  // 起点 leaf を決める: 他の証明書の親になっていない（誰も発行していない）もの。
  // 該当が複数あれば、入力の先頭に近いものを優先（取り込みの起点＝サーバ証明書）。
  const isParentOfSomeone = certs.map((_, i) => parentOf.includes(i));
  let startIndex = certs.findIndex((_, i) => !isParentOfSomeone[i]);
  if (startIndex < 0) startIndex = 0;

  // leaf から親をたどって順序を作る（[leaf, ..., root]）
  const orderLeafToRoot: number[] = [];
  const visited = new Set<number>();
  let cur: number | null = startIndex;
  while (cur !== null && !visited.has(cur)) {
    visited.add(cur);
    orderLeafToRoot.push(cur);
    cur = parentOf[cur];
  }
  // チェーンに繋がらなかった証明書も末尾に加える（取りこぼし防止）
  certs.forEach((_, i) => {
    if (!visited.has(i)) orderLeafToRoot.push(i);
  });

  // 上=ルート、下=leaf にするため反転
  const orderRootToLeaf = [...orderLeafToRoot].reverse();
  const positionByInput = new Map<number, number>();
  orderRootToLeaf.forEach((inputIdx, pos) => positionByInput.set(inputIdx, pos));

  return orderRootToLeaf.map((inputIdx) => {
    const cert = certs[inputIdx];
    const parentInput = parentOf[inputIdx];
    const r = role(cert);

    let sealedByLabel: string;
    let hasIssuerInSet = false;
    if (cert.isSelfSigned) {
      sealedByLabel = '自己署名';
    } else if (parentInput !== null) {
      hasIssuerInSet = true;
      const parentCn =
        certs[parentInput].subject.commonName ??
        certs[parentInput].subject.organization ??
        '上位CA';
      sealedByLabel = `${parentCn} が押印`;
    } else {
      sealedByLabel = '上位CAが押印（チェーン外）';
    }

    return {
      cert,
      inputIndex: inputIdx,
      role: r,
      parentIndex:
        parentInput !== null ? (positionByInput.get(parentInput) ?? null) : null,
      sealedByLabel,
      hasIssuerInSet,
    } satisfies ChainNode;
  });
}

/** 朱印に記す文字（発行者名 or「自己署名」） */
export function sealText(node: ChainNode): string {
  if (node.cert.isSelfSigned) return '自己署名';
  if (!node.hasIssuerInSet) return '上位CA';
  return node.sealedByLabel.replace(/ が押印$/, '');
}

/** 役割の日本語表記 */
export function roleLabel(role: CertRole): string {
  switch (role) {
    case 'root':
      return 'ルート認証局 (Root CA)';
    case 'intermediate':
      return '中間認証局 (Intermediate CA)';
    case 'leaf':
      return 'サーバ証明書 (End-entity)';
  }
}
