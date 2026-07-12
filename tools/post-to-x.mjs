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

const ORIGIN = 'https://gacha-hiroba.com';

/* ---------- データ読み込み ---------- */
const win = {};
new Function('window', readFileSync(new URL('../data/spots.js', import.meta.url), 'utf8'))(win);
new Function('window', readFileSync(new URL('../data/articles.js', import.meta.url), 'utf8'))(win);
const spots = win.GH_SPOTS || [];
const articles = win.GH_ARTICLES || [];

/* ---------- 現在時刻（JST）と時間帯スロット ---------- */
const now = new Date(Date.now() + 9 * 3600 * 1000); // UTC→JST
const jstHour = now.getUTCHours();
const dayKey = Math.floor((Date.now() + 9 * 3600 * 1000) / 86400000); // JST日単位の通し番号
const DRY = process.env.X_DRY_RUN === '1';
const KEY = process.env.X_API_KEY, KSEC = process.env.X_API_SECRET;
const TOK = process.env.X_ACCESS_TOKEN, TSEC = process.env.X_ACCESS_SECRET;
/* 実際に投稿できるときだけキューを消費する（ドライラン・キー未設定時は温存） */
const CAN_POST = !DRY && KEY && KSEC && TOK && TSEC;
const slot = process.env.X_SLOT || (
  jstHour >= 5 && jstHour < 10 ? 'morning' :
  jstHour >= 10 && jstHour < 14 ? 'noon' :
  jstHour >= 14 && jstHour < 18 ? 'afternoon' : 'evening');

/* ---------- ユーティリティ ---------- */
const pick = (arr, seed) => arr[seed % arr.length];
const machinesText = n => '約' + Number(n).toLocaleString('ja-JP') + '台';
const spotUrl = s => ORIGIN + '/spot/' + encodeURIComponent(s.id) + '.html';
const articleUrl = a => ORIGIN + '/article.html?area=' + encodeURIComponent(a.slug);

/* ---------- 投稿済みログ（過去にツイートした文面の再投稿を防ぐ） ---------- */
const logPath = new URL('../data/x-posted-log.json', import.meta.url);
const postedLog = existsSync(logPath)
  ? JSON.parse(readFileSync(logPath, 'utf8'))
  : { note: '投稿済み文面ログ。投稿成功時に追記し、同一文面の再投稿を防ぐ（API/Chrome共用）。', posts: [] };
const norm = t => String(t || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, '');
const alreadyPosted = t => (postedLog.posts || []).some(p => norm(p.text) === norm(t));
/* 本文の長さ＝URLを除いた文字数（ルール: 50文字以内） */
const bodyLen = t => [...norm(t)].length;

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
      `朝ガチャ情報🎰\n${shortName(s2)}\n週末の予定にどうぞ\n` + spotUrl(s2)
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
      `今日のガチャスポット🎰\n${shortName(s1)}\n${s1.machines ? machinesText(s1.machines) + '設置' : ''}\n` + spotUrl(s1),
      `ランチついでに1回どうですか🎰\n${a.label}のスポット一覧👇\n` + articleUrl(a)
    ];
  }
  /* afternoon（16時）: 豆知識と店舗紹介を織り交ぜる */
  return [
    `午後のガチャ情報🎰\n${shortName(s2)}\n${s2.machines ? machinesText(s2.machines) + '設置' : ''}\n` + spotUrl(s2),
    `ガチャは1回300〜500円が中心💡\n小銭の準備はお忘れなく`,
    `空カプセルは回収ボックスへ♻️\n専門店ならだいたいあります`,
    `夜まで回せる店もあります🌙\n${shortName(late)}\n` + spotUrl(late),
    `100円玉は多めが安心💡\n両替機がない店もあります`
  ];
}
function generate() {
  const cands = candidates();
  /* 50文字以内 かつ 未投稿のものを優先。無ければ50字以内の先頭 → それも無ければ先頭 */
  const ok = cands.filter(t => bodyLen(t) <= 50);
  const fresh = ok.filter(t => !alreadyPosted(t));
  const list = fresh.length ? fresh : (ok.length ? ok : cands);
  return pick(list, dayKey);
}

/* ---------- キューから取得（あれば優先） ---------- */
const queuePath = new URL('../data/x-posts.json', import.meta.url);
let text = null;
let queueChanged = false;
if (existsSync(queuePath)) {
  const data = JSON.parse(readFileSync(queuePath, 'utf8'));
  const q = data.queue || [];
  const usable = p => !alreadyPosted(p.text) && bodyLen(p.text) <= 50;
  let idx = q.findIndex(p => p.slot === slot && usable(p));
  if (idx === -1) idx = q.findIndex(p => !p.slot && usable(p));
  if (idx !== -1) {
    text = q[idx].text;
    if (CAN_POST) {
      q.splice(idx, 1);
      writeFileSync(queuePath, JSON.stringify(data, null, 2) + '\n');
      queueChanged = true;
    }
  }
}
if (!text) text = generate();

console.log('slot:', slot, '| queue使用:', queueChanged);
console.log('---- 投稿文 ----\n' + text + '\n----------------');

/* ---------- 投稿（OAuth 1.0a User Context / X API v2） ---------- */
if (DRY) {
  console.log('[DRY RUN] 投稿はスキップしました');
  process.exit(0);
}
if (!KEY || !KSEC || !TOK || !TSEC) {
  console.log('X API のシークレット未設定のため投稿をスキップしました（GitHub Secrets に X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET を設定してください）');
  process.exit(0);
}

const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const url = 'https://api.x.com/2/tweets';
const oauth = {
  oauth_consumer_key: KEY,
  oauth_nonce: randomBytes(16).toString('hex'),
  oauth_signature_method: 'HMAC-SHA1',
  oauth_timestamp: String(Math.floor(Date.now() / 1000)),
  oauth_token: TOK,
  oauth_version: '1.0'
};
const paramStr = Object.keys(oauth).sort().map(k => enc(k) + '=' + enc(oauth[k])).join('&');
const base = ['POST', enc(url), enc(paramStr)].join('&');
const signingKey = enc(KSEC) + '&' + enc(TSEC);
oauth.oauth_signature = createHmac('sha1', signingKey).update(base).digest('base64');
const authHeader = 'OAuth ' + Object.keys(oauth).sort()
  .map(k => enc(k) + '="' + enc(oauth[k]) + '"').join(', ');

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text })
});
const body = await res.json().catch(() => ({}));
if (res.ok) {
  console.log('投稿成功 🎉 tweet id:', body.data && body.data.id);
  postedLog.posts.push({ date: new Date().toISOString(), slot, text });
  writeFileSync(logPath, JSON.stringify(postedLog, null, 2) + '\n');
} else {
  console.error('投稿失敗:', res.status, JSON.stringify(body));
  process.exit(1);
}
