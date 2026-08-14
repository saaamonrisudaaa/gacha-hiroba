/* JavaScript で強化する一覧ページに、実データ由来の初期HTMLを書き込む。

   JSが無効・遅延・取得失敗でもページの主題が読め、主要な詳細ページへ移動できるようにする。
   ブラウザでは従来どおり data-* 属性を見た spots-ui.js / script.js が同じコンテナを
   最新状態へ置き換える。投稿本文やアクセス数など、ビルド時に確認できない値は作らない。

   埋め込み先は各HTMLの
     <!-- GH:<BLOCK>:START --> … <!-- GH:<BLOCK>:END -->
   の間。店舗・記事・発売情報を更新したら `node tools/gen-static-blocks.mjs` を実行する
   （daily-stores.yml では gen-pages / gen-sitemap と一緒に自動実行される）。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { guidePath, prefPath, spotPath } from './seo-routes.mjs';

const win = {};
for (const rel of ['../data/spots.js', '../data/articles.js', '../data/releases.js']) {
  new Function('window', readFileSync(new URL(rel, import.meta.url), 'utf8'))(win);
}
const spots = win.GH_SPOTS || [];
const articles = win.GH_ARTICLES || [];
const releases = win.GH_RELEASES || [];

const REGION_LABEL = {
  kanto: '関東', kansai: '関西', tokai: '東海',
  kyushu: '九州・沖縄', tohoku: '東北・北海道', chugoku: '中国・四国'
};
const REGION_ORDER = ['kanto', 'kansai', 'tokai', 'kyushu', 'tohoku', 'chugoku'];

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const machinesText = n => (n == null || n === '') ? '—' : '約' + Number(n).toLocaleString('ja-JP') + '台';
const isVerified = s => !!(s && s.sourceUrl && s.verifiedAt);
const publicSpots = spots.filter(isVerified);
const todayJst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const isOpen = s => !(s.opensOn && s.opensOn > todayJst);
const storePath = (s, board = false) => spotPath(s.id, board ? '#board' : '');

/* マーカーと同じ字下げを保って差し替える。既存JSが置換する data-* コンテナ自体は残す。 */
function fillMarker(html, name, content) {
  const start = '<!-- GH:' + name + ':START -->';
  const end = '<!-- GH:' + name + ':END -->';
  const re = new RegExp('([ \\t]*)' + start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[\\s\\S]*?' + end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!re.test(html)) return { html, found: false };
  const body = String(content || '').split('\n').map(line => line ? '  ' + line : '').join('\n');
  return {
    html: html.replace(re, (_all, indent) => indent + start + '\n' +
      body.split('\n').map(line => indent + line).join('\n') + '\n' + indent + end),
    found: true
  };
}

function replaceElementText(html, id, value) {
  const re = new RegExp('(<(?:strong|span)[^>]*\\bid="' + id + '"[^>]*>)[^<]*(</(?:strong|span)>)');
  return html.replace(re, '$1' + esc(value) + '$2');
}

function updateMarkedPage(rel, blocks, mutate) {
  const url = new URL(rel, import.meta.url);
  let html;
  try { html = readFileSync(url, 'utf8'); } catch { return 0; }
  let found = 0;
  Object.entries(blocks).forEach(([name, content]) => {
    const out = fillMarker(html, name, content);
    html = out.html;
    if (out.found) found++;
    else console.warn('skip (マーカーなし):', rel, name);
  });
  if (mutate) html = mutate(html);
  writeFileSync(url, html);
  return found;
}

/* 地方 → 都道府県 → 件数 */
const byRegion = {};
publicSpots.forEach(s => {
  (byRegion[s.region] ||= {})[s.pref] = (byRegion[s.region][s.pref] || 0) + 1;
});

/* 各都道府県の代表店（設置台数が最も多い店）を1件添えると、リンク先の中身が想像できる */
const topOf = pref => publicSpots
  .filter(s => s.pref === pref && s.machines != null)
  .sort((a, b) => (b.machines || 0) - (a.machines || 0))[0];

const prefCount = new Set(publicSpots.map(s => s.pref)).size;

const regionBlocks = REGION_ORDER.filter(r => byRegion[r]).map(r => {
  const prefs = Object.keys(byRegion[r]).sort((a, b) => byRegion[r][b] - byRegion[r][a]);
  const total = prefs.reduce((n, p) => n + byRegion[r][p], 0);
  const items = prefs.map(p => {
    const top = topOf(p);
    return '        <li class="gh-prefindex__item">' +
      '<a href="' + prefPath(p) + '">' + esc(p) + '</a>' +
      '<span class="gh-prefindex__count">' + byRegion[r][p] + '店</span>' +
      (top ? '<small class="gh-prefindex__top">' + esc(top.name) + '</small>' : '') +
      '</li>';
  }).join('\n');
  return '    <div class="gh-prefindex__group">\n' +
    '      <h3 class="gh-prefindex__region">' + esc(REGION_LABEL[r]) + '<span>' + total + '店</span></h3>\n' +
    '      <ul class="gh-prefindex__list">\n' + items + '\n      </ul>\n' +
    '    </div>';
}).join('\n');

const block =
  '\n  <div class="gh-prefindex">\n' +
  '    <p class="gh-prefindex__lead">' +
  '「ガチャひろば」では、掲載根拠URLと確認日のある全国' + prefCount + '都道府県・' + publicSpots.length + '店舗を公開しています。' +
  'ガチャガチャの森・ガシャポンのデパート・#C-pla・カプセル楽局などの専門店に加え、' +
  '家電量販店や商業施設の設置コーナーも対象です。掲載根拠URLと確認日がそろう店舗では、住所・アクセス・営業時間・' +
  '確認できた設置台数を参照先とともに案内します。確認待ちの候補は公開検索から外し、根拠を確認できてから追加します。' +
  '下記の都道府県から探すか、ページ上部の検索ボックスに駅名・エリア名・店名を入力してください。</p>\n' +
  regionBlocks + '\n  </div>\n';

const TARGETS = ['../stores.html', '../area.html', '../map.html'];
let done = 0;
for (const rel of TARGETS) {
  const url = new URL(rel, import.meta.url);
  let html;
  try { html = readFileSync(url, 'utf8'); } catch { continue; }
  const re = /(<!-- GH:PREF-INDEX:START -->)[\s\S]*?(<!-- GH:PREF-INDEX:END -->)/;
  if (!re.test(html)) { console.log('skip (マーカーなし):', rel); continue; }
  writeFileSync(url, html.replace(re, (_m, a, b) => a + block + '  ' + b));
  done++;
}

/* ── 共通の静的一覧パーツ ─────────────────────────────────────────── */
const ranked = spots.filter(s => isOpen(s) && isVerified(s) && s.machines != null)
  .slice().sort((a, b) => (b.machines || 0) - (a.machines || 0));

function rankingRows(limit) {
  return ranked.slice(0, limit).map((s, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? ' gh-rank--1' : rank === 2 ? ' gh-rank--2' : rank === 3 ? ' gh-rank--3' : '';
    return '<tr' + (rank === 1 ? ' class="gh-table__row--top"' : '') + '>' +
      '<td><span class="gh-rank' + rankClass + '">' + rank + '</span></td>' +
      '<td><a href="' + storePath(s) + '" class="gh-table__link">' + esc(s.name) + '</a></td>' +
      '<td>' + esc(s.area) + '</td>' +
      '<td class="gh-num">' + machinesText(s.machines) + '</td>' +
      '<td><a href="' + storePath(s) + '" class="gh-btn gh-btn--xs">詳細</a></td>' +
      '</tr>';
  }).join('\n');
}

function articleStoreCount(article) {
  if (article.ranking) {
    return spots.filter(s => {
      if (article.ranking.pref && s.pref !== article.ranking.pref) return false;
      if (article.ranking.region && s.region !== article.ranking.region) return false;
      return isVerified(s) && s.machines != null;
    }).sort((a, b) => (b.machines || 0) - (a.machines || 0))
      .slice(0, article.ranking.limit || 10).length;
  }
  return spots.filter(s => isVerified(s) && (article.areas || []).includes(s.area)).length;
}

function articleLinks(limit = 0) {
  const indexable = articles.filter(a => a.type === 'guide').slice().sort((a, b) =>
    (Number(b.featured || 0) - Number(a.featured || 0)) ||
    String(b.updated || '').localeCompare(String(a.updated || '')) ||
    String(a.title || '').localeCompare(String(b.title || ''), 'ja'));
  const list = limit > 0 ? indexable.slice(0, limit) : indexable;
  return list.map(a => {
    const badge = a.ranking ? 'ランキング' : a.type === 'guide' ? 'ガイド' : 'まとめ';
    const count = articleStoreCount(a);
    return '<a href="' + guidePath(a.slug) + '" class="gh-news-item">' +
      '<time class="gh-news-item__date">' + esc(a.updated) + '</time>' +
      '<span class="gh-badge gh-badge--new">' + badge + '</span>' +
      '<span>' + esc((a.emoji || '') + ' ' + a.title) + (count ? '（' + count + '店舗掲載）' : '') + '</span>' +
      '</a>';
  }).join('\n');
}

const PREF_ICON = {
  '東京都': '🗼', '神奈川県': '⚓', '埼玉県': '🌸', '千葉県': '🌊',
  '群馬県': '♨️', '栃木県': '🍓', '茨城県': '🌰', '大阪府': '🏯', '愛知県': '🏭'
};
const prefGroups = [...new Set(publicSpots.map(s => s.pref))].map(pref => {
  const list = publicSpots.filter(s => s.pref === pref).sort((a, b) => (b.machines || 0) - (a.machines || 0));
  return { pref, count: list.length };
}).sort((a, b) => b.count - a.count || a.pref.localeCompare(b.pref, 'ja'));
const areaLinks = prefGroups.slice(0, 12).map(g =>
  '<a href="' + prefPath(g.pref) + '" class="gh-area-card">' +
    '<span class="gh-area-card__icon">' + (PREF_ICON[g.pref] || '📍') + '</span>' +
    '<strong>' + esc(g.pref) + '</strong><small>' + g.count + '店舗</small>' +
  '</a>'
).join('\n');

function releaseOrder(release) {
  const d = Math.round((new Date(release.date + 'T00:00:00+09:00').getTime() -
    new Date(todayJst + 'T00:00:00+09:00').getTime()) / 86400000);
  return { d, rank: d === 0 ? [0, 0] : d > 0 ? [1, d] : [2, -d] };
}
const sortedReleases = releases.filter(r => r && r.date && r.title).slice().sort((a, b) => {
  const x = releaseOrder(a).rank, y = releaseOrder(b).rank;
  return (x[0] - y[0]) || (x[1] - y[1]);
});
function releaseBadge(r, cls) {
  const d = releaseOrder(r).d;
  const stateClass = d === 0 ? ' ' + cls + '--today' : d > 0 ? ' ' + cls + '--soon' : '';
  const text = r.label || (d === 0 ? '本日発売' : r.date.slice(5).replace('-', '/') + ' 発売');
  return '<span class="' + cls + stateClass + '">' + esc(text) + '</span>';
}
function releaseCells(kind, limit = 7) {
  const shown = sortedReleases.slice(0, limit);
  if (!shown.length) return '';
  const base = kind === 'hot' ? 'gh-hot' : 'gh-rel';
  const restClass = kind === 'hot' ? 'gh-hot-rest' : 'gh-rel-rest';
  const cell = (r, lead) => {
    const tag = r.source ? 'a' : 'div';
    const attrs = r.source ? ' href="' + esc(r.source) + '" target="_blank" rel="noopener"' : '';
    return '<' + tag + ' class="' + base + (lead ? ' ' + base + '--lead' : ' ' + base + '--row') +
      (kind === 'hot' && r.source ? ' gh-official-source' : '') + '"' + attrs + '>' +
      releaseBadge(r, base + '__badge') +
      '<strong class="' + base + '__title">' + esc(r.title) + '</strong>' +
      '<small class="' + base + '__meta">' + esc(r.maker || '') +
        (r.price ? '<span class="' + base + '__price">' + esc(r.price) + '</span>' : '') +
        (lead && r.note ? '<span class="' + base + '__note">' + esc(r.note) + '</span>' : '') +
      '</small></' + tag + '>';
  };
  return cell(shown[0], true) + (shown.length > 1
    ? '\n<div class="' + restClass + '">\n' + shown.slice(1).map(r => '  ' + cell(r, false)).join('\n') + '\n</div>'
    : '');
}

function currentReleaseLabel() {
  if (!sortedReleases.length) return '新作ガチャ';
  const days = sortedReleases.map(releaseOrder).map(x => x.d);
  if (days.includes(0)) return '本日発売';
  if (days.some(d => d >= -7 && d <= 10)) return '今週の新作';
  if (days.some(d => d > 0)) return '発売予定';
  return '最近発売の新作';
}

function boardRows(limit = 20) {
  return ranked.slice(0, limit).map((s, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? ' gh-rank--1' : rank === 2 ? ' gh-rank--2' : rank === 3 ? ' gh-rank--3' : '';
    return '<tr' + (rank === 1 ? ' class="gh-table__row--top"' : '') + '>' +
      '<td><span class="gh-rank' + rankClass + '">' + rank + '</span></td>' +
      '<td><a href="' + storePath(s, true) + '" class="gh-table__link">' + esc(s.name) + '</a></td>' +
      '<td>' + esc(s.area) + '</td>' +
      '<td class="gh-num">' + machinesText(s.machines) + '</td>' +
      '<td><a href="' + storePath(s, true) + '" class="gh-btn gh-btn--xs">見る</a></td>' +
      '</tr>';
  }).join('\n');
}
const boardSide = ranked.slice(0, 5).map(s =>
  '<li><a href="' + storePath(s, true) + '">' + esc(s.name) + '</a>' +
  '<span class="gh-category-item__count">' + machinesText(s.machines) + '</span></li>'
).join('\n');

let staticDone = 0;
staticDone += updateMarkedPage('../index.html', {
  'HOME-HOT': releaseCells('hot'),
  'HOME-RANKING': rankingRows(12),
  'HOME-ARTICLES': articleLinks(5),
  'HOME-AREAS': areaLinks
}, html => {
  const totalMachines = ranked.reduce((n, s) => n + (Number(s.machines) || 0), 0);
  html = replaceElementText(html, 'statStores', publicSpots.length.toLocaleString('ja-JP') + '店舗');
  html = replaceElementText(html, 'statMachines', '約' + totalMachines.toLocaleString('ja-JP') + '台');
  html = replaceElementText(html, 'statMachinesNote', '台数を確認できた' + ranked.length + '店舗の合計');
  html = replaceElementText(html, 'statPrefs', prefCount + '都道府県');
  if (ranked[0]) {
    html = replaceElementText(html, 'statTop', machinesText(ranked[0].machines));
    html = replaceElementText(html, 'statTopName', ranked[0].name);
  }
  return html;
});
staticDone += updateMarkedPage('../ranking.html', { 'RANKING-LIST': rankingRows(30) });
staticDone += updateMarkedPage('../news.html', {
  'NEWS-RELEASES': releaseCells('rel'),
  'NEWS-ARTICLES': articleLinks()
}, html => html.replace(/(<span data-gh-releases-label>)[^<]*(<\/span>)/,
  '$1' + currentReleaseLabel() + '$2'));
staticDone += updateMarkedPage('../board.html', {
  'BOARD-LIST': boardRows(20),
  'BOARD-SIDE': boardSide
}, html => {
  const totalMachines = ranked.reduce((n, s) => n + (Number(s.machines) || 0), 0);
  html = replaceElementText(html, 'boardStatBoards', publicSpots.length + '板');
  html = replaceElementText(html, 'boardStatPrefs', prefCount + '都道府県');
  html = replaceElementText(html, 'boardStatMachines', '約' + totalMachines.toLocaleString('ja-JP') + '台');
  html = replaceElementText(html, 'boardStatMachinesNote', '台数を確認できた' + ranked.length + '店舗の合計');
  if (ranked[0]) {
    html = replaceElementText(html, 'boardStatTop', ranked[0].name);
    html = replaceElementText(html, 'boardStatTopSub', machinesText(ranked[0].machines) + '（台数1位）');
  }
  return html;
});

/* ブランド一覧の素HTML件数も更新し、JavaScript未実行時に古い数を残さない。 */
try {
  const categoryUrl = new URL('../category.html', import.meta.url);
  let category = readFileSync(categoryUrl, 'utf8');
  const brandCounts = {};
  publicSpots.forEach((s) => { brandCounts[s.brand] = (brandCounts[s.brand] || 0) + 1; });
  category = category.replace(/(<span data-total-spots>)[^<]*(<\/span>)/g, '$1' + publicSpots.length + '$2');
  category = category.replace(/<a([^>]*data-brand="([^"]+)"[^>]*)>/g, (_all, attrs, brand) => {
    const cleanAttrs = attrs.replace(/\s+hidden(?:="")?/g, '');
    return '<a' + cleanAttrs + ((brandCounts[brand] || 0) > 0 ? '' : ' hidden') + '>';
  });
  category = category.replace(/(<a[^>]*data-brand="([^"]+)"[\s\S]*?<span class="gh-cat-card__count" data-brand-count>)[^<]*(<\/span>)/g,
    (_all, before, brand, after) => before + (brandCounts[brand] || 0) + '店舗掲載' + after);
  writeFileSync(categoryUrl, category);
  console.log('gen-static-blocks: category.html のブランド件数を更新しました');
} catch (error) {
  console.warn('gen-static-blocks: category.html の更新をスキップ:', error.message);
}

/* 方法ページの監査件数も元データと同期する。詳細な欠損率は監査レポートで生成する。 */
try {
  const methodologyUrl = new URL('../methodology.html', import.meta.url);
  let methodology = readFileSync(methodologyUrl, 'utf8');
  const verifiedCount = spots.filter(isVerified).length;
  const pendingCount = spots.length - verifiedCount;
  const percent = (value) => spots.length ? (value / spots.length * 100).toFixed(1) + '%' : '0.0%';
  for (const [id, value] of [
    ['methodTotal', spots.length], ['methodVerified', verifiedCount], ['methodPending', pendingCount],
    ['methodVerifiedRate', percent(verifiedCount)], ['methodPendingRate', percent(pendingCount)],
    ['methodTotalTable', spots.length], ['methodVerifiedTable', verifiedCount], ['methodPendingTable', pendingCount]
  ]) methodology = replaceElementText(methodology, id, String(value));
  writeFileSync(methodologyUrl, methodology);
  console.log('gen-static-blocks: methodology.html の監査件数を更新しました');
} catch (error) {
  console.warn('gen-static-blocks: methodology.html の更新をスキップ:', error.message);
}

/* 英語入口のJS未実行時も、公開対象だけの件数を表示する。 */
try {
  const englishUrl = new URL('../english.html', import.meta.url);
  let english = readFileSync(englishUrl, 'utf8');
  english = replaceElementText(english, 'enStatStores', String(publicSpots.length));
  writeFileSync(englishUrl, english);
  console.log('gen-static-blocks: english.html の公開店舗件数を更新しました');
} catch (error) {
  console.warn('gen-static-blocks: english.html の更新をスキップ:', error.message);
}
console.log('gen-static-blocks: ' + done + ' ページに都道府県インデックスを埋め込みました（' +
  prefCount + '都道府県 / 公開' + publicSpots.length + '店舗）');
console.log('gen-static-blocks: 一覧4ページの静的フォールバックを更新しました（' + staticDone + 'ブロック）');
