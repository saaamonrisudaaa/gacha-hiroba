/* GA4（Googleアナリティクス）レポート取得スクリプト
   サービスアカウントで GA4 Data API を叩き、直近のアクセス状況を表示する。

   必要な環境変数:
     GA4_SA_KEY      … サービスアカウントのJSONキー（JSONそのまま or base64）
     GA4_PROPERTY_ID … GA4のプロパティID（数字のみ。例: 123456789）

   使い方:  GA4_SA_KEY='{"type":...}' GA4_PROPERTY_ID=123456789 node tools/fetch-analytics.mjs
   （このリポジトリのコンテナ環境は googleapis.com への直接アクセスが可能。
     HTTPSはプロキシ経由のため、通信は curl で行う） */
import { execFileSync } from 'node:child_process';
import { createSign, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

const PROP = (process.env.GA4_PROPERTY_ID || '').trim();
const RAW_KEY = (process.env.GA4_SA_KEY || '').trim();

if (!PROP || !RAW_KEY) {
  console.error('GA4_PROPERTY_ID と GA4_SA_KEY を環境変数で指定してください。');
  console.error('例: GA4_SA_KEY=\'<サービスアカウントJSON>\' GA4_PROPERTY_ID=123456789 node tools/fetch-analytics.mjs');
  process.exit(1);
}

/* キーは JSON そのまま／base64 の両対応 */
let sa;
try {
  sa = JSON.parse(RAW_KEY.startsWith('{') ? RAW_KEY : Buffer.from(RAW_KEY, 'base64').toString('utf8'));
} catch (e) {
  console.error('GA4_SA_KEY を JSON として解釈できません（JSON文字列 か base64 を指定）:', e.message);
  process.exit(1);
}
if (!sa.client_email || !sa.private_key) {
  console.error('GA4_SA_KEY に client_email / private_key がありません。サービスアカウントの「JSONキー」を使ってください。');
  process.exit(1);
}

/* ── curl ラッパー（プロキシ環境でも動くHTTPS。CAバンドルがあれば使う） ── */
const CA = '/root/.ccr/ca-bundle.crt';
function curlJson(url, { method = 'GET', headers = {}, body } = {}) {
  const args = ['-sS', '--max-time', '30', '-X', method, url];
  if (existsSync(CA)) args.push('--cacert', CA);
  for (const [k, v] of Object.entries(headers)) args.push('-H', k + ': ' + v);
  if (body !== undefined) args.push('--data-binary', body);
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  try { return JSON.parse(out); }
  catch (e) { throw new Error('APIレスポンスをJSONとして解釈できません: ' + out.slice(0, 300)); }
}

/* ── サービスアカウント → アクセストークン（JWT Bearer フロー） ── */
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    jti: randomUUID()
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(header + '.' + claims);
  const jwt = header + '.' + claims + '.' + b64url(signer.sign(sa.private_key));

  const res = curlJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt
  });
  if (!res.access_token) {
    throw new Error('アクセストークン取得に失敗: ' + JSON.stringify(res));
  }
  return res.access_token;
}

/* ── GA4 Data API: runReport ── */
function runReport(token, body) {
  const res = curlJson(
    'https://analyticsdata.googleapis.com/v1beta/properties/' + PROP + ':runReport',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );
  if (res.error) throw new Error('runReport 失敗: ' + JSON.stringify(res.error));
  return res;
}
const rows = (r) => (r.rows || []).map((row) => ({
  dims: (row.dimensionValues || []).map((d) => d.value),
  mets: (row.metricValues || []).map((m) => m.value)
}));

/* ── レポート本体 ── */
const token = getAccessToken();

const CURRENT = { startDate: '28daysAgo', endDate: 'yesterday' };
const PREVIOUS = { startDate: '56daysAgo', endDate: '29daysAgo' };
const reportMetrics = [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'engagedSessions' }];

/* 1) 日別（直近28日）: ユーザー・セッション・PV */
const daily = runReport(token, {
  dateRanges: [CURRENT],
  dimensions: [{ name: 'date' }],
  metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
  orderBys: [{ dimension: { dimensionName: 'date' } }]
});

/* 2) 人気ページ（直近28日） */
const pages = runReport(token, {
  dateRanges: [CURRENT],
  dimensions: [{ name: 'pagePathPlusQueryString' }],
  metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
  orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
  limit: 15
});

/* 3) 直近28日 vs 前28日の全体比較 */
const currentSummary = runReport(token, { dateRanges: [CURRENT], metrics: reportMetrics });
const previousSummary = runReport(token, { dateRanges: [PREVIOUS], metrics: reportMetrics });

/* 4) チャネル比較 */
const channelBody = (dateRange) => ({
  dateRanges: [dateRange],
  dimensions: [{ name: 'sessionDefaultChannelGroup' }],
  metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'engagedSessions' }],
  orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
});
const currentChannels = runReport(token, channelBody(CURRENT));
const previousChannels = runReport(token, channelBody(PREVIOUS));

/* 5) 自然検索のランディングページ比較 */
const organicBody = (dateRange) => ({
  dateRanges: [dateRange],
  dimensions: [{ name: 'landingPagePlusQueryString' }],
  metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'engagedSessions' }],
  dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } },
  orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  limit: 30
});
const currentOrganic = runReport(token, organicBody(CURRENT));
const previousOrganic = runReport(token, organicBody(PREVIOUS));

/* 6) アフィリエイト導線（広告を50%以上・1秒表示した回数とクリック数） */
const affiliateEvents = runReport(token, {
  dateRanges: [CURRENT],
  dimensions: [{ name: 'eventName' }],
  metrics: [{ name: 'eventCount' }],
  dimensionFilter: {
    filter: {
      fieldName: 'eventName',
      inListFilter: { values: ['ad_impression', 'ad_click'] }
    }
  }
});

const firstMetrics = (report) => rows(report)[0]?.mets.map(Number) || [];
const pct = (current, previous) => previous
  ? (((current - previous) / previous) * 100).toFixed(1) + '%'
  : (current ? '新規' : '0.0%');
const byDimension = (report) => new Map(rows(report).map((row) => [row.dims[0], row.mets.map(Number)]));

console.log('════ ガチャひろば GA4レポート（プロパティ ' + PROP + '）════\n');
const cur = firstMetrics(currentSummary);
const prev = firstMetrics(previousSummary);
console.log('── 全体比較（直近28日 vs 前28日）──');
['ユーザー', 'セッション', 'PV', 'エンゲージドセッション'].forEach((label, i) => {
  console.log(label.padEnd(12) + String(cur[i] || 0).padStart(8) + '  前期 ' + String(prev[i] || 0).padStart(8) + '  ' + pct(cur[i] || 0, prev[i] || 0));
});

console.log('\n── 日別推移（直近28日）──');
console.log('日付        ユーザー  セッション  PV');
rows(daily).forEach((r) => {
  const d = r.dims[0];
  console.log(d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) + '   ' +
    String(r.mets[0]).padStart(6) + '   ' + String(r.mets[1]).padStart(8) + '  ' + String(r.mets[2]).padStart(5));
});
console.log('\n── 人気ページ TOP15（直近28日）──');
rows(pages).forEach((r, i) => console.log(String(i + 1).padStart(2) + '. ' + r.dims[0] + '  （PV ' + r.mets[0] + ' / ユーザー ' + r.mets[1] + '）'));
console.log('\n── 流入チャネル（直近28日 vs 前28日）──');
const curChannel = byDimension(currentChannels);
const prevChannel = byDimension(previousChannels);
for (const name of new Set([...curChannel.keys(), ...prevChannel.keys()])) {
  const current = curChannel.get(name) || [0, 0, 0];
  const previous = prevChannel.get(name) || [0, 0, 0];
  console.log('  ' + name + ': セッション ' + current[0] + '（前期 ' + previous[0] + ' / ' + pct(current[0], previous[0]) + '）');
}

console.log('\n── 自然検索ランディング TOP30（直近28日 / 前28日比較）──');
const curOrganic = byDimension(currentOrganic);
const prevOrganic = byDimension(previousOrganic);
let rank = 0;
for (const [path, current] of curOrganic) {
  const previous = prevOrganic.get(path) || [0, 0, 0];
  console.log(String(++rank).padStart(2) + '. ' + path + '  セッション ' + current[0] + '（前期 ' + previous[0] + ' / ' + pct(current[0], previous[0]) + '）');
}

/* 今期0件まで落ちたページも含め、減少セッションの大きい順に出す。 */
const organicDrops = [...new Set([...curOrganic.keys(), ...prevOrganic.keys()])]
  .map((path) => {
    const current = curOrganic.get(path) || [0, 0, 0];
    const previous = prevOrganic.get(path) || [0, 0, 0];
    return { path, current, previous, delta: current[0] - previous[0] };
  })
  .filter((row) => row.delta < 0)
  .sort((a, b) => a.delta - b.delta)
  .slice(0, 30);
console.log('\n── 自然検索の流入減ページ TOP30（今期0件も含む）──');
if (!organicDrops.length) console.log('  減少ページなし');
organicDrops.forEach((row, index) => {
  console.log(String(index + 1).padStart(2) + '. ' + row.path + '  セッション ' + row.current[0] +
    '（前期 ' + row.previous[0] + ' / ' + pct(row.current[0], row.previous[0]) + ' / 差 ' + row.delta + '）');
});

const affiliateByEvent = byDimension(affiliateEvents);
const impressions = affiliateByEvent.get('ad_impression')?.[0] || 0;
const clicks = affiliateByEvent.get('ad_click')?.[0] || 0;
const affiliateCtr = impressions ? ((clicks / impressions) * 100).toFixed(2) + '%' : '算出待ち';
console.log('\n── アフィリエイト導線（直近28日）──');
console.log('  表示 ' + impressions + ' / クリック ' + clicks + ' / CTR ' + affiliateCtr);
console.log('  ※案件別の注文数は楽天管理画面で確認し、ad_click と照合してください。');
console.log('\n（データ取得: GA4 Data API / analytics.readonly）');
