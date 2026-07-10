/* 店舗ページの静的生成スクリプト
   spot.html をテンプレートに、全店舗分の実HTML（/spot/<id>.html）を生成する。
   クローラーが JS を実行しなくても店舗名・住所・営業時間・地図・構造化データを
   読めるようにするための SEO 施策。ブラウザでは従来どおり spots-ui.js が
   同じ内容を再描画し、掲示板などの動的機能もそのまま動く。

   実行: node tools/gen-pages.mjs
   （店舗追加・削除のたびに実行。daily-stores ワークフローでも毎日実行される） */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';

const ORIGIN = 'https://gacha-hiroba.com';
const outDir = new URL('../spot/', import.meta.url);

const win = {};
new Function('window', readFileSync(new URL('../data/spots.js', import.meta.url), 'utf8'))(win);
const spots = win.GH_SPOTS || [];
if (!spots.length) { console.error('gen-pages: 店舗データが空です'); process.exit(1); }

let template = readFileSync(new URL('../spot.html', import.meta.url), 'utf8');

/* サブディレクトリ配下でも壊れないように、相対URLをルート絶対に書き換える。
   （http(s):・ルート絶対・#アンカー・tel: 等は触らない） */
template = template.replace(/(href|src)="(?!https?:|\/|#|tel:|mailto:|data:)([^"]+)"/g, '$1="/$2"');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const machinesText = (n) => (n == null || n === '') ? '—' : '約' + Number(n).toLocaleString('ja-JP') + '台';
const spotPath = (id) => '/spot/' + encodeURIComponent(id) + '.html';

/* テンプレート中の一意なマーカーを置換する（見つからなければ即エラー＝壊れに気づける） */
function swap(html, marker, replacement) {
  if (!html.includes(marker)) {
    console.error('gen-pages: マーカーが見つかりません: ' + marker);
    process.exit(1);
  }
  return html.replace(marker, replacement);
}

function metric(label, value, sub, primary) {
  return '<div class="gh-metric' + (primary ? ' gh-metric--primary' : '') + '">' +
    '<span class="gh-metric__label">' + esc(label) + '</span>' +
    '<strong class="gh-metric__value">' + esc(value) + '</strong>' +
    (sub ? '<span class="gh-metric__sub">' + esc(sub) + '</span>' : '') + '</div>';
}
function row(th, td, rawTd) {
  if (td == null || td === '') return '';
  return '<tr><th>' + esc(th) + '</th><td>' + (rawTd ? td : esc(td)) + '</td></tr>';
}

function buildPage(store) {
  const pageUrl = ORIGIN + spotPath(store.id);
  const pageTitle = store.name + '｜設置台数・営業時間・掲示板 | ガチャひろば';
  const pageDesc = store.name + '（' + store.area + '）のガチャガチャ設置情報。' +
    (store.machines ? '設置台数' + machinesText(store.machines) + '、' : '') +
    (store.hours ? '営業時間 ' + store.hours + '。' : '') +
    '住所・アクセス・地図・店舗ごとの掲示板で入荷情報や混雑状況をチェック。';

  let html = template;

  /* ── head ── */
  html = swap(html, '<title>店舗詳細 | ガチャひろば</title>', '<title>' + esc(pageTitle) + '</title>');
  html = html
    .replace(/<meta name="description" content="[^"]*"/, '<meta name="description" content="' + esc(pageDesc) + '"')
    .replace(/<link rel="canonical" href="[^"]*"/, '<link rel="canonical" href="' + pageUrl + '"')
    .replace(/<meta property="og:title" content="[^"]*"/, '<meta property="og:title" content="' + esc(pageTitle) + '"')
    .replace(/<meta property="og:description" content="[^"]*"/, '<meta property="og:description" content="' + esc(pageDesc) + '"')
    .replace(/<meta property="og:url" content="[^"]*"/, '<meta property="og:url" content="' + pageUrl + '"');

  /* 構造化データ（Store / BreadcrumbList）。data-gh-static 付き＝JS側は再注入しない */
  const ld = {
    '@context': 'https://schema.org', '@type': 'Store',
    name: store.name, url: pageUrl,
    address: { '@type': 'PostalAddress', streetAddress: store.address, addressRegion: store.pref, addressCountry: 'JP' },
    description: pageDesc
  };
  if (store.zip) ld.address.postalCode = store.zip;
  if (store.tel) ld.telephone = store.tel;
  if (store.lat != null && store.lon != null) ld.geo = { '@type': 'GeoCoordinates', latitude: store.lat, longitude: store.lon };
  if (store.hours) ld.openingHours = store.hours;
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: '店舗一覧', item: ORIGIN + '/stores.html' },
      { '@type': 'ListItem', position: 3, name: store.name, item: pageUrl }
    ]
  };
  const ldTags =
    '<script type="application/ld+json" data-gh-static>' + JSON.stringify(ld) + '</script>\n' +
    '  <script type="application/ld+json" data-gh-static>' + JSON.stringify(crumbs) + '</script>\n' +
    '  <script>window.GH_SPOT_STATIC_ID=' + JSON.stringify(store.id) + ';</script>';
  html = swap(html, '<script src="/data/spots.js" defer></script>', ldTags + '\n  <script src="/data/spots.js" defer></script>');

  /* ── パンくず・ヒーロー ── */
  html = swap(html, '<a href="/area.html" id="spotCrumbArea">エリア</a>',
    '<a href="/area.html" id="spotCrumbArea">' + esc(store.pref || store.area) + '</a>');
  html = swap(html, '<span aria-current="page" id="spotCrumbName">店舗詳細</span>',
    '<span aria-current="page" id="spotCrumbName">' + esc(store.name) + '</span>');
  html = swap(html, '<h1 class="gh-quote__name" id="spotName">店舗名</h1>',
    '<h1 class="gh-quote__name" id="spotName">' + esc(store.name) + '</h1>');
  html = swap(html, '<span id="spotBadges"></span>',
    '<span id="spotBadges"><a class="gh-badge gh-badge--lg" style="text-decoration:none" href="/stores.html?brand=' +
    encodeURIComponent(store.brand) + '" title="' + esc(store.brand) + 'の店舗一覧を見る">' + esc(store.brand) + '</a>' +
    '<span class="gh-badge gh-badge--lg">' + esc(store.area) + '</span></span>');
  html = swap(html, '<div class="gh-quote__address" id="spotAddress"></div>',
    '<div class="gh-quote__address" id="spotAddress"><span>📍 ' +
    esc((store.zip ? '〒' + store.zip + ' ' : '') + store.address) + '</span>' +
    (store.access ? '<span class="gh-hero__divider">｜</span><span>🚉 ' + esc(store.access) + '</span>' : '') + '</div>');
  html = swap(html, '<strong class="gh-quote__rating-num" id="spotMachines">—</strong>',
    '<strong class="gh-quote__rating-num" id="spotMachines">' + esc(machinesText(store.machines)) + '</strong>');
  html = swap(html, '<span class="gh-quote__updated" id="spotHours"></span>',
    '<span class="gh-quote__updated" id="spotHours">' + esc(store.hours ? '営業 ' + store.hours : '営業時間はお問い合わせ') + '</span>');
  html = swap(html, '<div class="gh-metrics" id="spotMetrics"></div>',
    '<div class="gh-metrics" id="spotMetrics">' +
    metric('設置台数', machinesText(store.machines), 'ガチャマシン', true) +
    metric('営業時間', store.hours || '—', '定休日は店舗にご確認ください') +
    metric('エリア', store.area || '—', store.pref || '') +
    metric('ブランド', store.brand || '—', '公式店舗') + '</div>');

  /* ── 店舗紹介文（静的のみ。ユニークテキストで薄いページ化を防ぐ） ── */
  const intro =
    '<p class="gh-detail-note" style="margin:14px 0 0">' +
    esc(store.name) + 'は、' + esc(store.pref) + '（' + esc(store.area) + '）にあるガチャガチャ・カプセルトイの設置スポットです。' +
    (store.machines ? 'ガチャマシンの設置台数は' + esc(machinesText(store.machines)) + '。' : '') +
    (store.hours ? '営業時間は' + esc(store.hours) + '。' : '') +
    (store.access ? 'アクセスは' + esc(store.access) + '。' : '') +
    '最新の入荷状況や混雑情報は、このページの掲示板タブでチェック・共有できます。</p>';
  html = swap(html, '<div class="gh-detail-layout">', intro + '\n      <div class="gh-detail-layout">');

  /* ── 詳細テーブル・地図・掲示板見出し・同エリア店舗 ── */
  html = swap(html, '<tbody id="spotInfoBody"></tbody>',
    '<tbody id="spotInfoBody">' +
    row('ブランド', store.brand) +
    row('住所', (store.zip ? '〒' + store.zip + '　' : '') + store.address) +
    row('電話番号', store.tel ? '<a href="tel:' + esc(String(store.tel).replace(/[^0-9+]/g, '')) + '">' + esc(store.tel) + '</a>' : '', true) +
    row('営業時間', store.hours) +
    row('設置台数', machinesText(store.machines)) +
    row('アクセス', store.access) +
    row('エリア', store.area) + '</tbody>');

  let mapInner = '<div class="gh-section__header"><h2 class="gh-section__title">アクセスマップ</h2>';
  const osmSearch = 'https://www.openstreetmap.org/search?query=' + encodeURIComponent([store.name, store.address].filter(Boolean).join(' '));
  if (store.lat != null && store.lon != null) {
    const lat = Number(store.lat), lon = Number(store.lon), d = 0.006;
    const bbox = (lon - d) + '%2C' + (lat - d) + '%2C' + (lon + d) + '%2C' + (lat + d);
    const full = 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=17/' + lat + '/' + lon;
    mapInner +=
      '<a href="' + full + '" class="gh-section__more" target="_blank" rel="noopener">大きな地図で見る →</a></div>' +
      '<div class="gh-osm-embed"><iframe title="' + esc(store.name) + 'の地図（OpenStreetMap）" ' +
      'src="https://www.openstreetmap.org/export/embed.html?bbox=' + bbox +
      '&amp;layer=mapnik&amp;marker=' + lat + '%2C' + lon + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
      '<p class="gh-osm-embed__addr">📍 ' + esc((store.zip ? '〒' + store.zip + ' ' : '') + store.address) + '</p>' +
      '<a href="' + osmSearch + '" class="gh-map-link" target="_blank" rel="noopener">🗺️ 住所で検索して開く →</a>' +
      '<p class="gh-osm-embed__note">※地図のピンはおおよその位置です。正確な場所・階数は上記の住所や公式サイトでご確認ください。</p>';
  } else {
    mapInner += '</div><p class="gh-osm-embed__addr">📍 ' + esc((store.zip ? '〒' + store.zip + ' ' : '') + store.address) + '</p>' +
      '<a href="' + osmSearch + '" class="gh-map-link" target="_blank" rel="noopener">🗺️ OpenStreetMapで場所を見る →</a>';
  }
  html = swap(html, '<section class="gh-section" id="spotMapSection"></section>',
    '<section class="gh-section" id="spotMapSection">' + mapInner + '</section>');

  html = swap(html, '<h2 class="gh-bbs__title" id="bbsTitle">掲示板</h2>',
    '<h2 class="gh-bbs__title" id="bbsTitle">' + esc('【' + (store.area || store.pref || 'ガチャ') + '】' + store.name + ' 🎰') + '</h2>');

  const nearby = spots.filter((s) => s.region === store.region && s.id !== store.id).slice(0, 6);
  html = swap(html, '<div class="gh-nearby" id="spotNearby"></div>',
    '<div class="gh-nearby" id="spotNearby">' + nearby.map((s) =>
      '<a href="' + spotPath(s.id) + '" class="gh-nearby__item"><span class="gh-rank">🏬</span>' +
      '<div><strong>' + esc(s.name) + '</strong><small>' + esc(s.area) + ' ・ ' + esc(machinesText(s.machines)) + '</small></div></a>'
    ).join('') + '</div>');

  return html;
}

/* ── 出力（現存店舗ぶんを生成し、削除済み店舗のページは消す） ── */
mkdirSync(outDir, { recursive: true });
const validFiles = new Set(spots.map((s) => s.id + '.html'));
let removed = 0;
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.html') && !validFiles.has(f)) { unlinkSync(new URL(f, outDir)); removed++; }
}
spots.forEach((s) => writeFileSync(new URL(s.id + '.html', outDir), buildPage(s)));
console.log('gen-pages: ' + spots.length + ' ページを spot/ に生成しました' + (removed ? '（削除店舗のページ ' + removed + ' 件を掃除）' : ''));
