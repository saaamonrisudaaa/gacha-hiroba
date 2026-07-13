/* 店舗の自動追加（ドリップ）スクリプト
   data/spots-queue.json の先頭から数件を取り出し、data/spots.js の配列末尾へ
   追記する。使った分はキューから消し込む。毎日 GitHub Actions から実行される。

   追加件数は常に4件。環境変数 DRIP_COUNT または queue の dripPerDay が
   4以外なら設定ミスとして中断する。
   同日二重実行を除き、必要件数を満たせない場合は何も変更せず失敗する。
   DRIP_DRY_RUN=1 なら選定結果だけを表示し、ファイルは変更しない。

   実行後は必ず `node tools/gen-sitemap.mjs` で sitemap を更新すること
   （ワークフロー側で連続実行している）。 */
import { readFileSync, writeFileSync } from 'node:fs';

const spotsUrl = new URL('../data/spots.js', import.meta.url);
const queueUrl = new URL('../data/spots-queue.json', import.meta.url);

/* 既存の店舗 id を取得（重複追加を防ぐ） */
const spotsText = readFileSync(spotsUrl, 'utf8');
const win = {};
new Function('window', spotsText)(win);
const existingIds = new Set((win.GH_SPOTS || []).map((s) => s.id));

/* キュー読み込み */
const queueData = JSON.parse(readFileSync(queueUrl, 'utf8'));
const queue = Array.isArray(queueData.queue) ? queueData.queue : [];

/* 同日二重実行ガード：手動追加やcron遅延で1日に2回走っても追加は1日1回まで。
   （lastRunDate は JST の日付。手動で当日分を入れた日はここを更新しておく） */
const todayJst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
if (queueData.lastRunDate === todayJst && process.env.DRIP_FORCE !== '1') {
  console.log('drip-stores: 本日(' + todayJst + ')分は追加済みです。何もしません（DRIP_FORCE=1 で強制実行可）。');
  process.exit(0);
}

const configuredDrip = process.env.DRIP_COUNT || queueData.dripPerDay || 4;
const drip = Number(configuredDrip);
if (!Number.isInteger(drip) || drip !== 4) {
  console.error('drip-stores: 追加件数は必ず4にしてください: ' + configuredDrip);
  process.exit(1);
}

/* 追加対象の選び方：
   dailyMix（例: ["北海道","東京都","大阪府","愛知県"]）が設定されていれば、
   各都道府県からキュー先頭の1件ずつを優先して選ぶ。該当が無い県はスキップし、
   枠が余れば残りのキュー先頭から補充する。id 重複は常にスキップして消し込む。 */
const candidates = queue.filter((it) => it && it.id && !existingIds.has(it.id));
const stale = queue.filter((it) => it && it.id && existingIds.has(it.id)); // 既掲載→捨てる
const toAdd = [];
const picked = new Set();

const mix = Array.isArray(queueData.dailyMix) ? queueData.dailyMix : null;
if (mix) {
  for (const pref of mix) {
    if (toAdd.length >= drip) break;
    const hit = candidates.find((it) => it.pref === pref && !picked.has(it.id));
    if (hit) { toAdd.push(hit); picked.add(hit.id); }
  }
}
for (const it of candidates) {
  if (toAdd.length >= drip) break;
  if (!picked.has(it.id)) { toAdd.push(it); picked.add(it.id); }
}
toAdd.forEach((it) => existingIds.add(it.id));
const remaining = candidates.filter((it) => !picked.has(it.id));
if (stale.length) console.log('drip-stores: 既掲載のためキューから削除: ' + stale.map((s) => s.id).join(', '));

if (toAdd.length < drip) {
  console.error('drip-stores: 追加可能な店舗が不足しています。変更しません（候補 ' + toAdd.length + ' 件 / 必要 ' + drip + ' 件 / キュー ' + queue.length + ' 件）。');
  process.exit(1);
}
if (process.env.DRIP_DRY_RUN === '1') {
  console.log('drip-stores: dry-run / ' + toAdd.length + ' 件を追加予定 → ' + toAdd.map((e) => e.id + '（' + e.name + '）').join(' / '));
  console.log('drip-stores: dry-run / 追加後の総店舗数 ' + (win.GH_SPOTS.length + toAdd.length) + ' 件 / キュー残 ' + remaining.length + ' 件');
  process.exit(0);
}

/* ── オブジェクトを spots.js と同じ体裁の JS リテラルに整形 ── */
const FIELD_ORDER = ['id', 'brand', 'name', 'region', 'pref', 'area', 'zip', 'address', 'tel', 'hours', 'machines', 'closedAfter', 'sourceUrl', 'verifiedAt'];
const q = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

function fmt(e) {
  const lines = [];
  for (const key of FIELD_ORDER) {
    if (e[key] === undefined || e[key] === null) continue;
    const val = typeof e[key] === 'number' ? e[key] : q(e[key]);
    lines.push('    ' + key + ': ' + val);
  }
  if (typeof e.lat === 'number' && typeof e.lon === 'number') {
    lines.push('    lat: ' + e.lat + ', lon: ' + e.lon);
  }
  if (e.access !== undefined && e.access !== null) {
    lines.push('    access: ' + q(e.access));
  }
  return '  {\n' + lines.join(',\n') + '\n  }';
}

/* 配列を閉じる "\n];" の直前へ挿入する */
const marker = '\n];';
const closeIdx = spotsText.indexOf(marker);
if (closeIdx === -1) {
  console.error('drip-stores: spots.js の配列終端 "\\n];" が見つかりません。中断します。');
  process.exit(1);
}
const head = spotsText.slice(0, closeIdx).replace(/\s*$/, ''); // 最後の店舗の "}" まで
const tail = spotsText.slice(closeIdx + marker.length);        // "];" 以降（closedAfter フィルタ等）

const insertion = toAdd.map((e) => ',\n\n' + fmt(e)).join('');
const out = head + insertion + '\n\n];' + tail;
writeFileSync(spotsUrl, out);

/* キューを更新（追加した分＋既存だった分を消し込み、残りを書き戻す） */
queueData.queue = remaining;
queueData.lastRunDate = todayJst;
writeFileSync(queueUrl, JSON.stringify(queueData, null, 2) + '\n');

console.log('drip-stores: ' + toAdd.length + ' 件を追加しました → ' + toAdd.map((e) => e.id + '（' + e.name + '）').join(' / '));
console.log('drip-stores: 総店舗数 ' + (win.GH_SPOTS.length + toAdd.length) + ' 件 / キュー残 ' + remaining.length + ' 件');
