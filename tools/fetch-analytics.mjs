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

/* 1) 日別（直近14日）: ユーザー・セッション・PV */
const daily = runReport(token, {
  dateRanges: [{ startDate: '14daysAgo', endDate: 'today' }],
  dimensions: [{ name: 'date' }],
  metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
  orderBys: [{ dimension: { dimensionName: 'date' } }]
});

/* 2) 人気ページ（直近7日） */
const pages = runReport(token, {
  dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
  dimensions: [{ name: 'pagePath' }],
  metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
  orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
  limit: 15
});

/* 3) 流入元（直近7日） */
const sources = runReport(token, {
  dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
  dimensions: [{ name: 'sessionDefaultChannelGroup' }],
  metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
  orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
});

console.log('════ ガチャひろば GA4レポート（プロパティ ' + PROP + '）════\n');
console.log('── 日別推移（直近14日）──');
console.log('日付        ユーザー  セッション  PV');
rows(daily).forEach((r) => {
  const d = r.dims[0];
  console.log(d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) + '   ' +
    String(r.mets[0]).padStart(6) + '   ' + String(r.mets[1]).padStart(8) + '  ' + String(r.mets[2]).padStart(5));
});
console.log('\n── 人気ページ TOP15（直近7日）──');
rows(pages).forEach((r, i) => console.log(String(i + 1).padStart(2) + '. ' + r.dims[0] + '  （PV ' + r.mets[0] + ' / ユーザー ' + r.mets[1] + '）'));
console.log('\n── 流入チャネル（直近7日）──');
rows(sources).forEach((r) => console.log('  ' + r.dims[0] + ': セッション ' + r.mets[0] + ' / ユーザー ' + r.mets[1]));
console.log('\n（データ取得: GA4 Data API / analytics.readonly）');
