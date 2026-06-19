/**
 * バックグラウンド Service Worker（MV3）。
 *
 * ツールバーのボタンが押されたら、`chrome.debugger`（DevTools Protocol）で
 * 現在タブの TLS サーバ証明書チェーンを捕捉し、PEM に変換して storage.session に
 * 保存、同梱ビューア(viewer.html)を開いて表示する。
 *
 * 取得は次の順で試みる（最初に成功した方式を使う）:
 *   A. Security ドメイン … 表示中ページの証明書チェーンを再読込なしで取得（主方式）
 *   B. Network.getCertificate … SSLキャッシュから取得（直近にリクエストがあれば）
 *   C. 再読込してから Network.getCertificate … 上記が空の場合のフォールバック
 */

const CDP_VERSION = '1.3';

type Debuggee = chrome.debugger.Debuggee;

interface CaptureRecord {
  pem?: string;
  origin?: string;
  capturedAt?: number;
  method?: string;
  error?: string;
}

interface SecurityStateParams {
  visibleSecurityState?: {
    certificateSecurityState?: { certificate?: string[] };
  };
}

interface GetCertificateResult {
  tableNames?: string[];
}

interface ResponseReceivedParams {
  type?: string;
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

  const target: Debuggee = { tabId: tab.id };
  try {
    await chrome.debugger.attach(target, CDP_VERSION);

    let derList: string[] | null = null;
    let method = '';

    // A. Security ドメイン（再読込なし）
    derList = await viaSecurityDomain(target);
    if (derList?.length) method = 'Security';

    // B. Network.getCertificate（キャッシュ）
    if (!derList?.length) {
      derList = await viaGetCertificate(target, origin);
      if (derList?.length) method = 'Network.getCertificate';
    }

    // C. 再読込してから取得（フォールバック）
    if (!derList?.length) {
      derList = await viaReload(target, origin);
      if (derList?.length) method = 'reload';
    }

    if (!derList?.length) {
      await openViewerWith({
        error:
          '証明書を取得できませんでした。ページが完全に読み込まれた状態で、もう一度お試しください。',
      });
      return;
    }

    const pem = derList.map(base64DerToPem).join('\n');
    await openViewerWith({ pem, origin, capturedAt: Date.now(), method });
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

async function send<T>(
  target: Debuggee,
  method: string,
  params?: object,
): Promise<T> {
  return (await chrome.debugger.sendCommand(target, method, params)) as T;
}

/** A. Security ドメインで表示中ページの証明書チェーン(base64 DER)を取得 */
function viaSecurityDomain(target: Debuggee): Promise<string[] | null> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (value: string[] | null) => {
      if (settled) return;
      settled = true;
      chrome.debugger.onEvent.removeListener(onEvent);
      void chrome.debugger.sendCommand(target, 'Security.disable').catch(() => {});
      resolve(value);
    };

    const onEvent = (
      source: Debuggee,
      eventMethod: string,
      params?: object,
    ) => {
      if (source.tabId !== target.tabId) return;
      if (eventMethod === 'Security.visibleSecurityStateChanged') {
        const certs = (params as SecurityStateParams)?.visibleSecurityState
          ?.certificateSecurityState?.certificate;
        if (certs && certs.length) finish(certs);
      }
    };

    chrome.debugger.onEvent.addListener(onEvent);
    chrome.debugger
      .sendCommand(target, 'Security.enable')
      .catch(() => finish(null));
    // enable で現在状態が通知されない場合に備えてタイムアウト
    setTimeout(() => finish(null), 2500);
  });
}

/** B. Network.getCertificate でSSLキャッシュから取得 */
async function viaGetCertificate(
  target: Debuggee,
  origin: string,
): Promise<string[] | null> {
  try {
    await send(target, 'Network.enable');
    const res = await send<GetCertificateResult>(target, 'Network.getCertificate', {
      origin,
    });
    return res?.tableNames ?? null;
  } catch {
    return null;
  }
}

/** C. ページを再読込し、ドキュメント応答後に Network.getCertificate */
async function viaReload(
  target: Debuggee,
  origin: string,
): Promise<string[] | null> {
  try {
    await send(target, 'Network.enable');
    const gotDocument = new Promise<boolean>((resolve) => {
      let done = false;
      const onEvent = (
        source: Debuggee,
        eventMethod: string,
        params?: object,
      ) => {
        if (source.tabId !== target.tabId) return;
        if (
          eventMethod === 'Network.responseReceived' &&
          (params as ResponseReceivedParams)?.type === 'Document'
        ) {
          if (!done) {
            done = true;
            chrome.debugger.onEvent.removeListener(onEvent);
            resolve(true);
          }
        }
      };
      chrome.debugger.onEvent.addListener(onEvent);
      setTimeout(() => {
        if (!done) {
          done = true;
          chrome.debugger.onEvent.removeListener(onEvent);
          resolve(false);
        }
      }, 8000);
    });

    await send(target, 'Page.enable');
    await send(target, 'Page.reload', { ignoreCache: false });
    await gotDocument;
    // 応答後はSSLキャッシュが埋まっているはず
    const res = await send<GetCertificateResult>(target, 'Network.getCertificate', {
      origin,
    });
    return res?.tableNames ?? null;
  } catch {
    return null;
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
