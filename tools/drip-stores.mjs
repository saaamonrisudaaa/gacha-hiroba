/* 店舗の自動追加（ドリップ）スクリプト
   data/spots-queue.json の先頭から数件を取り出し、data/spots.js の配列末尾へ
   追記する。使った分はキューから消し込む。毎日 GitHub Actions から実行される。

   追加件数の決め方： 環境変数 DRIP_COUNT > queue の dripPerDay > 既定値 2
   キューが空、または追加できる新規店舗が無い場合は何もせず正常終了（no-op）。

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

const drip =
  parseInt(process.env.DRIP_COUNT, 10) ||
  parseInt(queueData.dripPerDay, 10) ||
  2;

/* 追加対象を先頭から選ぶ（id 重複はスキップして消し込む） */
const toAdd = [];
const remaining = [];
for (const item of queue) {
  if (toAdd.length < drip && item && item.id && !existingIds.has(item.id)) {
    toAdd.push(item);
    existingIds.add(item.id);
  } else if (item && item.id && existingIds.has(item.id)) {
    /* すでにサイトにある → キューから捨てる（remaining に入れない） */
  } else {
    remaining.push(item);
  }
}

if (toAdd.length === 0) {
  console.log('drip-stores: 追加できる新規店舗がありません（キュー残 ' + queue.length + ' 件）。何もしません。');
  process.exit(0);
}

/* ── オブジェクトを spots.js と同じ体裁の JS リテラルに整形 ── */
const FIELD_ORDER = ['id', 'brand', 'name', 'region', 'pref', 'area', 'zip', 'address', 'tel', 'hours', 'machines', 'closedAfter'];
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
writeFileSync(queueUrl, JSON.stringify(queueData, null, 2) + '\n');

console.log('drip-stores: ' + toAdd.length + ' 件を追加しました → ' + toAdd.map((e) => e.id + '（' + e.name + '）').join(' / '));
console.log('drip-stores: 総店舗数 ' + (win.GH_SPOTS.length + toAdd.length) + ' 件 / キュー残 ' + remaining.length + ' 件');
