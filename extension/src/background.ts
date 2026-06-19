/**
 * バックグラウンド Service Worker（MV3）。
 *
 * ツールバーのボタンが押されたら、`chrome.debugger`（DevTools Protocol）で
 * 現在タブの TLS サーバ証明書を捕捉し、PEM に変換して `storage.session` に保存、
 * 同梱ビューア(viewer.html)を開いて表示する。
 *
 * Chromium には拡張向けの証明書取得APIが無いため、`Network.getCertificate` を用いる。
 * これはブラウザが検証したチェーン（リーフ＋中間、場合によりルート）を DER で返す。
 */

const CDP_VERSION = '1.3';

/** Network.getCertificate の戻り（DERのbase64配列。フィールド名はプロトコル上 tableNames） */
interface GetCertificateResult {
  tableNames?: string[];
}

interface CaptureRecord {
  pem?: string;
  origin?: string;
  capturedAt?: number;
  error?: string;
}

chrome.action.onClicked.addListener((tab) => {
  void handleClick(tab);
});

async function handleClick(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined || !tab.url) {
    await openViewerWith({ error: 'アクティブなタブを取得できませんでした。' });
    return;
  }

  let origin: string;
  try {
    origin = new URL(tab.url).origin;
  } catch {
    await openViewerWith({ error: 'このページのURLを解釈できませんでした。' });
    return;
  }

  if (!origin.startsWith('https://')) {
    await openViewerWith({
      error:
        'このページはHTTPSではないため、サーバ証明書がありません。https:// のサイトで実行してください。',
    });
    return;
  }

  const target: chrome.debugger.Debuggee = { tabId: tab.id };
  try {
    await chrome.debugger.attach(target, CDP_VERSION);
    await chrome.debugger.sendCommand(target, 'Network.enable');
    const result = (await chrome.debugger.sendCommand(target, 'Network.getCertificate', {
      origin,
    })) as GetCertificateResult;

    const derList = result?.tableNames ?? [];
    if (derList.length === 0) {
      await openViewerWith({
        error:
          '証明書を取得できませんでした。ページを再読み込みしてからもう一度お試しください。',
      });
      return;
    }

    const pem = derList.map(base64DerToPem).join('\n');
    await openViewerWith({ pem, origin, capturedAt: Date.now() });
  } catch (e) {
    await openViewerWith({
      error: '証明書の取得に失敗しました: ' + (e instanceof Error ? e.message : String(e)),
    });
  } finally {
    try {
      await chrome.debugger.detach(target);
    } catch {
      // 既にデタッチ済み等は無視
    }
  }
}

/** base64 の DER を PEM の CERTIFICATE ブロックに変換 */
function base64DerToPem(base64: string): string {
  const body = base64.match(/.{1,64}/g)?.join('\n') ?? base64;
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
}

async function openViewerWith(record: CaptureRecord): Promise<void> {
  await chrome.storage.session.set({ capture: record });
  await chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
}
