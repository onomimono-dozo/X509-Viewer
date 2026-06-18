/**
 * SSLインスペクション（中間者復号）の検出に使う、既知のプロキシ/インスペクション
 * 製品・ベンダー名の一覧。証明書の Issuer 組織名(O) や CN に含まれていれば、
 * 通信が企業プロキシ等で復号・再暗号化されている可能性が高い。
 *
 * 要件1.2 の発端事例（google.com の発行者が Zscaler だった）に対応する。
 */
export const KNOWN_INSPECTION_VENDORS: string[] = [
  'Zscaler',
  'Blue Coat',
  'Bluecoat',
  'Symantec Web Gateway',
  'Forcepoint',
  'Websense',
  'Palo Alto',
  'Fortinet',
  'FortiGate',
  'Cisco Umbrella',
  'McAfee Web Gateway',
  'Sophos',
  'Netskope',
  'Cloudflare Gateway',
  'Check Point',
  'Trend Micro',
  'Kaspersky',
  'ESET',
  'Sangfor',
  'iboss',
  'Menlo Security',
  'Squid Proxy',
  'mitmproxy',
  'Charles Proxy',
  'Fiddler',
  'BurpSuite',
  'Burp',
];

/** テキストに既知ベンダー名が含まれていれば、その名前を返す */
export function matchInspectionVendor(text: string | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const vendor of KNOWN_INSPECTION_VENDORS) {
    if (lower.includes(vendor.toLowerCase())) return vendor;
  }
  return null;
}
