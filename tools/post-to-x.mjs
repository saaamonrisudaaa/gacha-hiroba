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
const spotUrl = s => ORIGIN + '/spot.html?id=' + encodeURIComponent(s.id);
const articleUrl = a => ORIGIN + '/article.html?area=' + encodeURIComponent(a.slug);

/* 投稿対象としておいしい店（台数公表・座標あり＝主要店） */
const bigSpots = spots.filter(s => s.machines >= 300).sort((a, b) => (b.machines || 0) - (a.machines || 0));
const lateSpots = spots.filter(s => /2[234]:/.test(s.hours || '') || /〜2[234]時/.test(s.hours || ''));
const areaArts = articles.filter(a => !a.type && !a.ranking);

/* ---------- 自動生成（時間帯別・日替わりローテーション） ---------- */
function generate() {
  if (slot === 'morning') {
    const s = pick(bigSpots, dayKey);
    const opens = [
      `おはようございます☀️ 今日の一店は「${s.name}」。${s.machines ? machinesText(s.machines) + 'のマシンが並ぶ' : ''}${s.area.split('・')[1] || s.area}の人気スポットです。`,
      `☀️今日のガチャスポット：${s.name}（${s.area.split('・')[1] || s.area}）。${s.machines ? machinesText(s.machines) + '設置。' : ''}${s.access ? '' : ''}週末の予定にどうぞ。`,
      `朝のガチャ紹介🎰 ${s.area.split('・')[1] || s.area}の「${s.name}」${s.machines ? '、' + machinesText(s.machines) : ''}。詳しい場所と営業時間はこちら👇`
    ];
    return pick(opens, dayKey) + '\n' + spotUrl(s);
  }
  if (slot === 'noon') {
    const a = pick(areaArts, dayKey);
    const opens = [
      `お昼休みにサクッと読める${a.label}のガチャガチャまとめ🎰 駅からの行き方も載せてます`,
      `${a.label}でガチャ回すならこの記事をどうぞ📍 掲載店の台数・営業時間つきです`,
      `ランチのついでに1回どうですか？${a.label}のガチャスポットまとめました🎰`
    ];
    return pick(opens, dayKey) + '\n' + articleUrl(a) + '\n#ガチャガチャ';
  }
  if (slot === 'afternoon') {
    const tips = [
      `ガチャの価格、いまは1回300〜500円が中心。マシン正面のパネルに書いてあるので回す前にチェックです💡`,
      `専門店には両替機がある店が多いですが、駅ナカの小さいコーナーにはないことも。100円玉は多めに持っていくのが安心です💡`,
      `キャッシュレス対応のガチャ筐体、大型店を中心に増えてます。それでも硬貨式が主流なので現金は忘れずに💡`,
      `空カプセルは店内の回収ボックスへ。最近はどの専門店にもだいたい置いてあります♻️`,
      `メーカー公式の「発売日」は問屋出荷日。店頭に並ぶのは数日〜数週間ズレるので、見つからなくても焦らないでOK💡`
    ];
    const closers = ['', '\nはじめての専門店ガイドはこちら👇\n' + ORIGIN + '/article.html?area=guide-first-visit'];
    return pick(tips, dayKey) + pick(closers, dayKey % 2);
  }
  // evening
  const s = pick(lateSpots.length ? lateSpots : bigSpots, dayKey);
  const opens = [
    `仕事帰りに寄れるガチャスポット🌙 「${s.name}」は${(s.hours || '').replace(/（.*?）/g, '')}営業。`,
    `今日もおつかれさまです🌙 ${s.area.split('・')[1] || s.area}の「${s.name}」なら夜でも回せます（${(s.hours || '').replace(/（.*?）/g, '')}）。`,
    `夜ガチャ派に🌙 ${s.name}、${(s.hours || '').replace(/（.*?）/g, '')}まで開いてます。`
  ];
  return pick(opens, dayKey) + '\n' + spotUrl(s);
}

/* ---------- キューから取得（あれば優先） ---------- */
const queuePath = new URL('../data/x-posts.json', import.meta.url);
let text = null;
let queueChanged = false;
if (existsSync(queuePath)) {
  const data = JSON.parse(readFileSync(queuePath, 'utf8'));
  const q = data.queue || [];
  let idx = q.findIndex(p => p.slot === slot);
  if (idx === -1) idx = q.findIndex(p => !p.slot);
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
} else {
  console.error('投稿失敗:', res.status, JSON.stringify(body));
  process.exit(1);
}
