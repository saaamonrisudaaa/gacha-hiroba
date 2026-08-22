/* GA4運営者除外の状態判定を、外部通信なしのブラウザ模擬環境で検証する。 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(join(root, 'script.js'), 'utf8');
const start = source.indexOf('var GHAnalyticsControl =');
const end = source.indexOf('/* ── Google Analytics 4 ──');
const runtimeEnd = source.indexOf('/* ── Hamburger menu ──');
if (start < 0 || end < 0 || start >= end) throw new Error('GA4 runtime guardを抽出できません');
if (runtimeEnd < 0 || end >= runtimeEnd) throw new Error('GA4 runtimeを抽出できません');
const guardSource = source.slice(start, end);
const runtimeSource = source.slice(start, runtimeEnd);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function queued(runtime, command, action) {
  return (runtime.context.dataLayer || []).map((entry) => Array.from(entry))
    .filter((entry) => entry[0] === command && (!action || entry[1] === action));
}

function storageFrom(initial = {}, throwOnWrite = false) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (throwOnWrite) throw new Error('storage blocked');
      values.set(key, String(value));
    },
    removeItem(key) {
      if (throwOnWrite) throw new Error('storage blocked');
      values.delete(key);
    },
    values
  };
}

function runScenario({ protocol = 'https:', hostname = 'gacha-hiroba.com', pathname = '/', owner, noTracking = false, throwOnWrite = false } = {}) {
  const key = 'gh-analytics-owner-excluded-v1';
  const localStorage = storageFrom(owner ? { [key]: JSON.stringify(owner) } : {}, throwOnWrite);
  const cookieWrites = [];
  const document = {
    body: { hasAttribute(name) { return name === 'data-gh-no-tracking' && noTracking; } },
    get cookie() { return '_ga=old; _ga_6KSGDTM1VJ=old; site_setting=keep'; },
    set cookie(value) { cookieWrites.push(value); }
  };
  const listeners = {};
  const window = {
    addEventListener(name, handler) { listeners[name] = handler; }
  };
  const location = { protocol, hostname, pathname, origin: protocol + '//' + hostname };
  const context = { window, document, location, localStorage, Date, JSON, Boolean, Error };
  vm.runInNewContext(guardSource, context, { filename: 'script.js#analytics-guard' });
  return { control: window.GHAnalyticsControl, window, localStorage, cookieWrites, listeners };
}

function runRuntimeScenario({ protocol = 'https:', hostname = 'gacha-hiroba.com', pathname = '/', owner, consent = 'accepted', noTracking = false } = {}) {
  const ownerKey = 'gh-analytics-owner-excluded-v1';
  const initial = {};
  if (owner) initial[ownerKey] = JSON.stringify(owner);
  if (consent) initial['gh-analytics-consent-v1'] = consent;
  const localStorage = storageFrom(initial);
  const appendedScripts = [];
  const cookieWrites = [];
  const listeners = {};
  const document = {
    body: {
      hasAttribute(name) { return name === 'data-gh-no-tracking' && noTracking; },
      appendChild() {}
    },
    head: { appendChild(node) { appendedScripts.push(node); } },
    createElement(tagName) {
      return {
        tagName, async: false, src: '', className: '', innerHTML: '',
        setAttribute() {},
        querySelector() { return { addEventListener() {} }; }
      };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    get cookie() { return '_ga=old; _ga_6KSGDTM1VJ=old'; },
    set cookie(value) { cookieWrites.push(value); }
  };
  const location = {
    protocol,
    hostname,
    pathname,
    origin: protocol + '//' + hostname,
    href: protocol + '//' + hostname + pathname,
    search: ''
  };
  const context = {
    document, location, localStorage, Date, JSON, Boolean, Error, Array, URL, encodeURIComponent,
    addEventListener(name, handler) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(handler);
    }
  };
  context.window = context;
  vm.runInNewContext(runtimeSource, context, { filename: 'script.js#analytics-runtime' });
  return { context, appendedScripts, cookieWrites, localStorage, listeners };
}

const production = runScenario();
assert(production.control.shouldBlock() === false, '本番の通常ブラウザが誤って除外されています');
assert(production.window['ga-disable-G-6KSGDTM1VJ'] === false, '本番の通常ブラウザでGA4が無効です');
assert(production.control.setOwnerExcluded(true) === true, '運営者除外を保存できません');
assert(production.control.isOwnerExcluded() === true, '保存後も運営者除外が無効です');
assert(production.window['ga-disable-G-6KSGDTM1VJ'] === true, '保存直後にGA4が停止していません');
assert(production.cookieWrites.some((value) => value.startsWith('_ga=')), '_ga Cookieを削除していません');
assert(production.cookieWrites.some((value) => value.startsWith('_ga_6KSGDTM1VJ=')), '測定ID別Cookieを削除していません');
const saved = JSON.parse(production.localStorage.values.get(production.control.storageKey));
assert(Object.keys(saved).sort().join(',') === 'excluded,setAt', '除外設定に不要な端末情報が保存されています');
assert(production.control.setOwnerExcluded(false) === true, '運営者除外を解除できません');
assert(production.control.isOwnerExcluded() === false, '解除後も運営者除外が残っています');
assert(production.window['ga-disable-G-6KSGDTM1VJ'] === false, '解除後も通常ページのGA4が停止しています');

const excluded = runScenario({ owner: { excluded: true, setAt: '2026-08-17T00:00:00.000Z' } });
assert(excluded.control.shouldBlock() === true, '保存済み運営者端末が除外されていません');
assert(excluded.window['ga-disable-G-6KSGDTM1VJ'] === true, '保存済み運営者端末でGA4が有効です');

const otherTab = runScenario();
otherTab.localStorage.values.set(otherTab.control.storageKey, JSON.stringify({ excluded: true, setAt: '2026-08-17T00:00:00.000Z' }));
otherTab.listeners.storage({ key: otherTab.control.storageKey });
assert(otherTab.window['ga-disable-G-6KSGDTM1VJ'] === true, '別タブで有効化した除外が即時反映されません');

const nonProduction = runScenario({ protocol: 'http:', hostname: '127.0.0.1' });
assert(nonProduction.control.shouldBlock() === true, 'localhostが計測対象になっています');
assert(nonProduction.window['ga-disable-G-6KSGDTM1VJ'] === true, 'localhostでGA4が有効です');

const blockedStorage = runScenario({ throwOnWrite: true });
assert(blockedStorage.control.setOwnerExcluded(true) === false, '保存失敗を除外成功として扱っています');
assert(blockedStorage.window['ga-disable-G-6KSGDTM1VJ'] === true, '保存失敗時に安全側へ停止していません');

const normalRuntime = runRuntimeScenario();
assert(normalRuntime.appendedScripts.length === 1, '本番・同意済みでもgtag.jsが読み込まれません');
assert(normalRuntime.appendedScripts[0].src === 'https://www.googletagmanager.com/gtag/js?id=G-6KSGDTM1VJ', 'gtag.jsの測定IDが不正です');
const acceptedDefault = queued(normalRuntime, 'consent', 'default')[0];
const acceptedUpdate = queued(normalRuntime, 'consent', 'update').at(-1);
assert(acceptedDefault && acceptedDefault[2].analytics_storage === 'denied', '同意済みでも既定拒否をタグ設定より先に送っていません');
assert(acceptedDefault[2].ad_storage === 'denied' && acceptedDefault[2].ad_user_data === 'denied' && acceptedDefault[2].ad_personalization === 'denied', 'Consent Mode v2の広告関連既定値が拒否になっていません');
assert(acceptedUpdate && acceptedUpdate[2].analytics_storage === 'granted', '保存済みの解析Cookie許可が反映されていません');
assert(queued(normalRuntime, 'config')[0][2].allow_google_signals === false, 'Googleシグナルを無効化していません');
const initialQueueLength = normalRuntime.context.dataLayer.length;
normalRuntime.context.ghTrack('test_event');
assert(normalRuntime.context.dataLayer.length === initialQueueLength + 1, '通常イベントがgtagへ渡されません');
normalRuntime.localStorage.values.set('gh-analytics-consent-v1', 'rejected');
normalRuntime.listeners.storage.forEach((handler) => handler({ key: 'gh-analytics-consent-v1', newValue: 'rejected' }));
const deniedUpdate = queued(normalRuntime, 'consent', 'update').at(-1);
assert(deniedUpdate && deniedUpdate[2].analytics_storage === 'denied', '別タブでの解析Cookie拒否が反映されません');
assert(normalRuntime.context['ga-disable-G-6KSGDTM1VJ'] === false, 'Cookieなし測定まで誤って停止しています');
assert(normalRuntime.cookieWrites.some((value) => value.startsWith('_ga=')), '同意撤回時に解析Cookieを削除していません');
const deniedQueueLength = normalRuntime.context.dataLayer.length;
normalRuntime.context.ghTrack('cookieless_event');
assert(normalRuntime.context.dataLayer.length === deniedQueueLength + 1, 'Cookie拒否後のCookieなしイベントがgtagへ渡されません');
normalRuntime.localStorage.values.set('gh-analytics-consent-v1', 'accepted');
normalRuntime.listeners.storage.forEach((handler) => handler({ key: 'gh-analytics-consent-v1', newValue: 'accepted' }));
const resumedQueueLength = normalRuntime.context.dataLayer.length;
normalRuntime.context.ghTrack('resumed_event');
assert(normalRuntime.context.dataLayer.length === resumedQueueLength + 1, '別タブでの再同意が反映されません');
assert(queued(normalRuntime, 'consent', 'update').at(-1)[2].analytics_storage === 'granted', '再同意後も解析Cookieが許可されていません');
normalRuntime.localStorage.values.set('gh-analytics-owner-excluded-v1', JSON.stringify({ excluded: true, setAt: '2026-08-17T00:00:00.000Z' }));
normalRuntime.listeners.storage.forEach((handler) => handler({ key: 'gh-analytics-owner-excluded-v1', newValue: 'excluded' }));
const ownerStoppedQueueLength = normalRuntime.context.dataLayer.length;
normalRuntime.context.ghTrack('owner_must_not_queue');
assert(normalRuntime.context.dataLayer.length === ownerStoppedQueueLength, '別タブでの運営者除外後もイベントがgtagへ渡されています');
normalRuntime.localStorage.values.delete('gh-analytics-owner-excluded-v1');
normalRuntime.listeners.storage.forEach((handler) => handler({ key: 'gh-analytics-owner-excluded-v1', newValue: null }));
const ownerResumedQueueLength = normalRuntime.context.dataLayer.length;
normalRuntime.context.ghTrack('owner_resumed_event');
assert(normalRuntime.context.dataLayer.length === ownerResumedQueueLength + 1, '別タブでの運営者除外解除が反映されません');
normalRuntime.localStorage.values.clear();
normalRuntime.listeners.storage.forEach((handler) => handler({ key: null, newValue: null }));
const clearedQueueLength = normalRuntime.context.dataLayer.length;
normalRuntime.context.ghTrack('storage_clear_cookieless_event');
assert(normalRuntime.context.dataLayer.length === clearedQueueLength + 1, 'サイトデータ消去後のCookieなし測定が再開しません');
assert(normalRuntime.context['ga-disable-G-6KSGDTM1VJ'] === false, 'サイトデータ消去後にCookieなし測定まで停止しています');
assert(queued(normalRuntime, 'consent', 'update').at(-1)[2].analytics_storage === 'denied', 'サイトデータ消去後に既定拒否へ戻っていません');

const ownerRuntime = runRuntimeScenario({ owner: { excluded: true, setAt: '2026-08-17T00:00:00.000Z' } });
assert(ownerRuntime.appendedScripts.length === 0, '運営者端末でgtag.jsを読み込んでいます');
assert(typeof ownerRuntime.context.gtag === 'undefined', '運営者端末でgtag関数を作成しています');

const previewRuntime = runRuntimeScenario({ protocol: 'http:', hostname: '127.0.0.1' });
assert(previewRuntime.appendedScripts.length === 0, '非本番環境でgtag.jsを読み込んでいます');

const rejectedRuntime = runRuntimeScenario({ consent: 'rejected' });
assert(rejectedRuntime.appendedScripts.length === 1, '同意拒否済みの通常訪問でCookieなし測定を初期化していません');
assert(queued(rejectedRuntime, 'consent', 'default')[0][2].analytics_storage === 'denied', '拒否済み訪問の既定同意が拒否ではありません');
assert(queued(rejectedRuntime, 'consent', 'update').at(-1)[2].analytics_storage === 'denied', '拒否済み訪問の選択が反映されません');
assert(rejectedRuntime.cookieWrites.some((value) => value.startsWith('_ga=')), '拒否済み訪問の解析Cookieを削除していません');

const undecidedRuntime = runRuntimeScenario({ consent: null });
assert(undecidedRuntime.appendedScripts.length === 1, '未選択の通常訪問でCookieなし測定を初期化していません');
assert(queued(undecidedRuntime, 'consent', 'default')[0][2].analytics_storage === 'denied', '未選択訪問の既定同意が拒否ではありません');
assert(queued(undecidedRuntime, 'consent', 'update').length === 0, '未選択訪問を許可済みとして更新しています');

const noTrackingRuntime = runRuntimeScenario({ pathname: '/privacy.html', noTracking: true });
assert(noTrackingRuntime.appendedScripts.length === 0, '計測対象外ページでgtag.jsを読み込んでいます');

console.log('test-analytics-exclusion: OK / Consent Mode v2・Cookieなし測定・運営者・非本番・保存失敗を検証');
