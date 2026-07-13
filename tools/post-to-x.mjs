/* ===========================================================================
   X（旧Twitter）自動投稿スクリプト
   GitHub Actions から 1日4回（7:30 / 12:30 / 15:30 / 19:30 JST）呼ばれる。

   仕組み：
   1) data/x-posts.json の queue に手書きの投稿があれば、現在の時間帯
      （slot）に合うものを1件取り出して投稿し、queue から削除する
      （削除はワークフロー側が git commit して確定）。
   2) queue に該当がなければ、data/spots.js / data/articles.js の実データから
      時間帯に合った投稿文を自動生成する（日付ベースのローテーションで
      同じ文面が続かないようにする）。

   必要な環境変数（GitHub Secrets から渡す）:
     X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET
   X_DRY_RUN=1 を付けると投稿せずに文面を表示するだけ（動作確認用）。
   =========================================================================== */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import {
  POST_SLOTS,
  duplicateKey,
  jstDateKey,
  validatePost,
  wasLaterSlotPosted,
  wasSlotPosted
} from './x-post-rules.mjs';

const ORIGIN = 'https://gacha-hiroba.com';

/* ---------- データ読み込み ---------- */
const win = {};
new Function('window', readFileSync(new URL('../data/spots.js', import.meta.url), 'utf8'))(win);
new Function('window', readFileSync(new URL('../data/articles.js', import.meta.url), 'utf8'))(win);
const spots = win.GH_SPOTS || [];
const articles = win.GH_ARTICLES || [];

/* ---------- 現在時刻（JST）と時間帯スロット ---------- */
const runtimeNow = new Date();
const now = new Date(runtimeNow.getTime() + 9 * 3600 * 1000); // UTC→JST
const jstHour = now.getUTCHours();
const jstMinutes = jstHour * 60 + now.getUTCMinutes();
const dayKey = Math.floor(now.getTime() / 86400000); // JST日単位の通し番号
const DRY = process.env.X_DRY_RUN === '1';
const VERIFY_ONLY = process.env.X_VERIFY_ONLY === '1';
const KEY = process.env.X_API_KEY, KSEC = process.env.X_API_SECRET;
const TOK = process.env.X_ACCESS_TOKEN, TSEC = process.env.X_ACCESS_SECRET;

/* ---------- ユーティリティ ---------- */
const pick = (arr, seed) => arr.length ? arr[((seed % arr.length) + arr.length) % arr.length] : null;
const machinesText = n => '約' + Number(n).toLocaleString('ja-JP') + '台';
const spotUrl = s => ORIGIN + '/spot/' + encodeURIComponent(s.id) + '.html';
const articleUrl = a => ORIGIN + '/article.html?area=' + encodeURIComponent(a.slug);

/* ---------- 投稿済みログ（過去にツイートした文面の再投稿を防ぐ） ---------- */
const logPath = new URL('../data/x-posted-log.json', import.meta.url);
const postedLog = existsSync(logPath)
  ? JSON.parse(readFileSync(logPath, 'utf8'))
  : { note: '投稿済み文面ログ。投稿成功時に追記し、同一文面の再投稿を防ぐ（API/Chrome共用）。', posts: [] };
const posts = postedLog.posts || [];
const postedKeys = new Set(posts.map(post => duplicateKey(post.text)).filter(Boolean));
const alreadyPosted = text => postedKeys.has(duplicateKey(text));
const currentJstDate = jstDateKey(runtimeNow);
const dueSlots = [
  { slot: 'morning', minute: 7 * 60 + 30 },
  { slot: 'noon', minute: 12 * 60 + 30 },
  { slot: 'afternoon', minute: 15 * 60 + 30 },
  { slot: 'evening', minute: 19 * 60 + 30 }
];
const latestDueSlot = dueSlots.filter(item => jstMinutes >= item.minute).at(-1)?.slot || null;
const timeBasedSlot = jstHour >= 5 && jstHour < 10 ? 'morning'
  : jstHour >= 10 && jstHour < 14 ? 'noon'
    : jstHour >= 14 && jstHour < 18 ? 'afternoon' : 'evening';
const requestedSlot = process.env.X_SLOT || timeBasedSlot;
const slot = requestedSlot === 'due' ? latestDueSlot : requestedSlot;

if (!slot) {
  console.log('まだ本日の最初の投稿時刻前なので、投稿をスキップしました');
  process.exit(0);
}
if (!POST_SLOTS.includes(slot)) {
  console.error(`不正なX_SLOTです: ${slot}`);
  process.exit(1);
}
if (!DRY && !VERIFY_ONLY && wasSlotPosted(posts, currentJstDate, slot)) {
  console.log(`${currentJstDate} の ${slot} 枠は投稿済みのためスキップしました`);
  process.exit(0);
}
if (!DRY && !VERIFY_ONLY && wasLaterSlotPosted(posts, currentJstDate, slot)) {
  console.log(`${currentJstDate} の後続枠が投稿済みのため、遅延した ${slot} 枠をスキップしました`);
  process.exit(0);
}

/* 投稿対象としておいしい店（台数公表・座標あり＝主要店） */
const bigSpots = spots.filter(s => s.machines >= 300).sort((a, b) => (b.machines || 0) - (a.machines || 0));
const lateSpots = spots.filter(s => /2[234]:/.test(s.hours || '') || /〜2[234]時/.test(s.hours || ''));
const areaArts = articles.filter(a => !a.type && !a.ranking);

/* ---------- 自動生成 ----------
   ルール: 本文（URL除く）50文字以内・改行で段落分け・投稿済みログと重複しない。
   候補を複数作り、条件を満たす最初のものを選ぶ。 ---------- */
function candidates() {
  const s1 = pick(bigSpots, dayKey);
  const s2 = pick(bigSpots, dayKey + 3);
  const a = pick(areaArts, dayKey);
  const late = pick(lateSpots.length ? lateSpots : bigSpots, dayKey);
  const shortName = (x) => [...x.name].length <= 22 ? x.name : (x.area.split('・')[1] || x.area) + 'の大型店';
  if (slot === 'morning') {
    return [
      `おはようございます☀️\n今日の一店：${shortName(s1)}\n` + spotUrl(s1),
      `☀️今日のガチャスポット\n${shortName(s1)}${s1.machines ? '（' + machinesText(s1.machines) + '）' : ''}\n` + spotUrl(s1),
      `朝ガチャ情報🎰\n${shortName(s2)}をチェック\n` + spotUrl(s2)
    ];
  }
  if (slot === 'evening') {
    return [
      `今日もおつかれさまです🌙\n${shortName(late)}は夜も回せます\n` + spotUrl(late),
      `仕事帰りの1回に🌙\n${shortName(late)}\n` + spotUrl(late),
      `夜ガチャ派へ🌙\n${shortName(late)}が開いてます\n` + spotUrl(late)
    ];
  }
  if (slot === 'noon') {
    return [
      `お昼のガチャ情報🎰\n${a.label}のまとめはこちら👇\n` + articleUrl(a),
      `${a.label}でガチャ回すなら📍\n台数・営業時間つきでまとめてます\n` + articleUrl(a),
      `今日のガチャスポット🎰\n${shortName(s1)}${s1.machines ? '・' + machinesText(s1.machines) : ''}\n` + spotUrl(s1),
      `ランチついでに1回どうですか🎰\n${a.label}のスポット一覧👇\n` + articleUrl(a)
    ];
  }
  /* afternoon（15:30）: 実データに結び付く3行投稿 */
  return [
    `午後のガチャ情報🎰\n${shortName(s2)}${s2.machines ? '・' + machinesText(s2.machines) : ''}\n` + spotUrl(s2),
    `午後の新作チェック🎰\n${a.label}の探し方はこちら\n` + articleUrl(a),
    `週末のガチャ候補に📍\n${shortName(s1)}をチェック\n` + spotUrl(s1),
    `夜まで回せる店もあります🌙\n${shortName(late)}\n` + spotUrl(late),
    `次に回す店を探そう🎰\n${a.label}のスポット一覧はこちら\n` + articleUrl(a)
  ];
}
function generate() {
  const cands = candidates();
  const seen = new Set();
  const fresh = cands.filter(text => {
    const result = validatePost(text);
    if (!result.valid || alreadyPosted(text) || seen.has(result.key)) return false;
    seen.add(result.key);
    return true;
  });
  return pick(fresh, dayKey);
}

/* ---------- キューから取得（あれば優先） ---------- */
const queuePath = new URL('../data/x-posts.json', import.meta.url);
let text = null;
let queueData = null;
let queueIndex = -1;
if (existsSync(queuePath)) {
  const data = JSON.parse(readFileSync(queuePath, 'utf8'));
  const q = data.queue || [];
  const seen = new Set();
  const eligible = [];
  for (const [index, item] of q.entries()) {
    const result = validatePost(item?.text);
    if (!result.valid || alreadyPosted(item?.text) || seen.has(result.key)) continue;
    seen.add(result.key);
    eligible.push(index);
  }
  let idx = eligible.find(index => q[index].slot === slot);
  if (idx === undefined) idx = eligible.find(index => !q[index].slot);
  if (idx !== undefined && idx !== -1) {
    text = q[idx].text;
    queueData = data;
    queueIndex = idx;
  }
}
if (!text) text = generate();

if (!text) {
  console.warn('有効な未投稿候補がないため、重複投稿せずにスキップしました');
  process.exit(0);
}

const selected = validatePost(text);
if (!selected.valid) {
  console.error('投稿直前検証に失敗しました:', selected.errors.join(' / '));
  process.exit(1);
}
if (alreadyPosted(text)) {
  console.log('投稿済み文面のためスキップしました');
  process.exit(0);
}

console.log('slot:', slot, '| queue使用:', queueIndex >= 0, '| 本文文字数:', selected.bodyLength);
console.log('---- 投稿文 ----\n' + text + '\n----------------');

/* ---------- 投稿（OAuth 1.0a User Context / X API v2） ---------- */
if (DRY && !VERIFY_ONLY) {
  console.log('[DRY RUN] 投稿はスキップしました');
  process.exit(0);
}
if (!KEY || !KSEC || !TOK || !TSEC) {
  console.error('X API のシークレットが不足しています');
  process.exit(1);
}

const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function oauthHeader(method, requestUrl) {
  const oauth = {
    oauth_consumer_key: KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: TOK,
    oauth_version: '1.0'
  };
  const paramStr = Object.keys(oauth).sort().map(key => enc(key) + '=' + enc(oauth[key])).join('&');
  const base = [method, enc(requestUrl), enc(paramStr)].join('&');
  const signingKey = enc(KSEC) + '&' + enc(TSEC);
  oauth.oauth_signature = createHmac('sha1', signingKey).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort()
    .map(key => enc(key) + '="' + enc(oauth[key]) + '"').join(', ');
}

const expectedUsername = (process.env.X_EXPECTED_USERNAME || 'gachahiroba').replace(/^@/u, '').toLowerCase();
const meUrl = 'https://api.x.com/2/users/me';
const meRes = await fetch(meUrl, { headers: { Authorization: oauthHeader('GET', meUrl) } });
const meBody = await meRes.json().catch(() => ({}));
if (!meRes.ok) {
  console.error('X投稿先アカウントの確認に失敗:', meRes.status, JSON.stringify(meBody));
  process.exit(1);
}
const actualUsername = String(meBody?.data?.username || '').toLowerCase();
if (actualUsername !== expectedUsername) {
  console.error(`投稿を停止: Xアカウントが @${actualUsername || '不明'} です（期待値 @${expectedUsername}）`);
  process.exit(1);
}
console.log(`投稿先アカウント確認OK: @${actualUsername}`);
if (VERIFY_ONLY) {
  console.log('[VERIFY ONLY] アカウント確認のみで終了しました');
  process.exit(0);
}

const url = 'https://api.x.com/2/tweets';
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Authorization': oauthHeader('POST', url), 'Content-Type': 'application/json' },
  body: JSON.stringify({ text })
});
const body = await res.json().catch(() => ({}));
if (res.ok) {
  console.log('投稿成功 🎉 tweet id:', body.data && body.data.id);
  const tweetId = body.data && body.data.id;
  postedLog.posts.push({
    date: new Date().toISOString(),
    jstDate: currentJstDate,
    slot,
    text,
    tweetId,
    postUrl: `https://x.com/${actualUsername}/status/${tweetId}`
  });
  writeFileSync(logPath, JSON.stringify(postedLog, null, 2) + '\n');
  if (queueData && queueIndex >= 0) {
    queueData.queue.splice(queueIndex, 1);
    writeFileSync(queuePath, JSON.stringify(queueData, null, 2) + '\n');
  }
} else if (res.status === 403 && /duplicate content/iu.test(JSON.stringify(body))) {
  console.warn('X側で既存文面と判定されたため、再投稿せず投稿済みログへ移しました');
  postedLog.posts.push({
    date: new Date().toISOString(),
    jstDate: currentJstDate,
    slot,
    text,
    status: 'already-present-on-x'
  });
  writeFileSync(logPath, JSON.stringify(postedLog, null, 2) + '\n');
  if (queueData && queueIndex >= 0) {
    queueData.queue.splice(queueIndex, 1);
    writeFileSync(queuePath, JSON.stringify(queueData, null, 2) + '\n');
  }
} else {
  console.error('投稿失敗:', res.status, JSON.stringify(body));
  process.exit(1);
}
