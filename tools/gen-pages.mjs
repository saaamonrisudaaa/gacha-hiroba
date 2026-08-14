/* 店舗ページの静的生成スクリプト
   spot.html をテンプレートに、全店舗分の実HTML（/spot/<id>.html）を生成する。
   クローラーが JS を実行しなくても店舗名・住所・営業時間・地図・構造化データを
   読めるようにするための SEO 施策。ブラウザでは従来どおり spots-ui.js が
   同じ内容を再描画し、掲示板などの動的機能もそのまま動く。

   実行: node tools/gen-pages.mjs
   （店舗追加・削除のたびに実行。daily-stores ワークフローでも毎日実行される） */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { prefPath, brandPath } from './seo-routes.mjs';

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
const isVerified = (store) => Boolean(store && store.sourceUrl && store.verifiedAt);
const spotPath = (id) => '/spot/' + encodeURIComponent(id) + '.html';
const distanceKm = (a, b) => {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return Number.POSITIVE_INFINITY;
  const rad = (n) => Number(n) * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};
const nearbyFor = (store) => spots.filter((s) => s.id !== store.id && isVerified(s)).sort((a, b) => {
  const tier = (s) => s.area === store.area ? 0 : s.pref === store.pref ? 1 : 2;
  return (tier(a) - tier(b)) || (distanceKm(store, a) - distanceKm(store, b)) ||
    String(a.name).localeCompare(String(b.name), 'ja');
}).slice(0, 6);

/* ── オープン予定（opensOn）の店舗 ──
   まだ開いていない店舗を「営業中」と誤認させないための表示を組み立てる。
   生成時点の判定なので、開業日を過ぎたぶんは script.js が
   [data-gh-preopen] を見てクライアント側で取り除く（再生成待ちにしない）。 */
const JST_TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const WDAY = ['日', '月', '火', '水', '木', '金', '土'];
const isPreOpen = (store) => !!(store.opensOn && store.opensOn > JST_TODAY);
function openLabel(iso, long) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  if (!long) return Number(m[2]) + '/' + Number(m[3]);
  /* 曜日はカレンダー日付そのものから出す（Date.UTC ならタイムゾーンでズレない） */
  const w = WDAY[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  return Number(m[1]) + '年' + Number(m[2]) + '月' + Number(m[3]) + '日（' + w + '）';
}
function daysUntil(iso) {
  return Math.round((new Date(iso + 'T00:00:00+09:00').getTime() -
    new Date(JST_TODAY + 'T00:00:00+09:00').getTime()) / 86400000);
}

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
  const verified = isVerified(store);
  const soon = isPreOpen(store);
  const verifiedTitleParts = [
    store.machines != null ? '設置台数' : '',
    store.hours ? '営業時間' : '',
    '店舗情報',
    '掲示板'
  ].filter(Boolean);
  const pageTitle = soon
    ? store.name + '｜' + openLabel(store.opensOn, true) + 'オープン予定・アクセス・掲示板 | ガチャひろば'
    : store.name + (verified
      ? '｜' + verifiedTitleParts.join('・') + ' | ガチャひろば'
      : '｜店舗情報の確認状況・アクセス・掲示板 | ガチャひろば');
  const pageDesc = soon
    ? store.name + '（' + store.area + '）は' + openLabel(store.opensOn, true) + 'オープン予定のガチャガチャ・カプセルトイ専門店です。' +
      (store.hours ? '営業時間 ' + store.hours + '。' : '') +
      '住所・アクセス・地図に加えて、オープン初日の混雑や入荷情報を掲示板で共有できます。'
    : store.name + '（' + store.area + '）のガチャガチャ設置情報。' +
      (verified && store.machines ? '設置台数' + machinesText(store.machines) + '、' : '') +
      (verified && store.hours ? '営業時間 ' + store.hours + '。' : '') +
      (verified
        ? '住所・アクセス・地図・店舗ごとの掲示板で入荷情報や混雑状況をチェック。'
        : '掲載情報は一次情報の確認作業中で、検索エンジンの掲載対象から外しています。');

  let html = template;

  /* 一次情報のURLと確認日が揃うページだけを検索対象にする。 */
  html = html.replace(
    '<meta name="robots" content="noindex,follow" />',
    verified
      ? '<meta name="robots" content="index,follow,max-image-preview:large" />'
      : '<meta name="robots" content="noindex,follow" />'
  );

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
  if (verified && store.tel) ld.telephone = store.tel;
  if (verified && store.lat != null && store.lon != null) ld.geo = { '@type': 'GeoCoordinates', latitude: store.lat, longitude: store.lon };
  /* 営業時間は店舗ごとに曜日・例外表記が異なるため、表示文字列を
     schema.org の openingHours へ誤って転記せず、本文だけに掲載する。 */
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: '店舗一覧', item: ORIGIN + '/stores.html' },
      { '@type': 'ListItem', position: 3, name: store.pref + 'のガチャガチャ設置場所', item: ORIGIN + prefPath(store.pref) },
      { '@type': 'ListItem', position: 4, name: store.name, item: pageUrl }
    ]
  };
  const ldTags =
    (verified ? '<script type="application/ld+json" data-gh-static>' + JSON.stringify(ld) + '</script>\n  ' : '') +
    '<script type="application/ld+json" data-gh-static>' + JSON.stringify(crumbs) + '</script>\n' +
    '  <script>window.GH_SPOT_STATIC_ID=' + JSON.stringify(store.id) + ';</script>';
  html = swap(html, '<script src="/data/spots.js" defer></script>', ldTags + '\n  <script src="/data/spots.js" defer></script>');

  /* ── パンくず・ヒーロー ── */
  html = swap(html, '<a href="/area.html" id="spotCrumbArea">エリア</a>',
    '<a href="' + prefPath(store.pref) + '" id="spotCrumbArea">' + esc(store.pref || store.area) + '</a>');
  html = swap(html, '<span aria-current="page" id="spotCrumbName">店舗詳細</span>',
    '<span aria-current="page" id="spotCrumbName">' + esc(store.name) + '</span>');
  html = swap(html, '<h1 class="gh-quote__name" id="spotName">店舗名</h1>',
    '<h1 class="gh-quote__name" id="spotName">' + esc(store.name) + '</h1>');
  html = swap(html, '<span id="spotBadges"></span>',
    '<span id="spotBadges">' +
    (soon ? '<span class="gh-badge gh-badge--lg gh-badge--soon" data-gh-preopen="' + store.opensOn + '">' +
      esc(openLabel(store.opensOn, false)) + ' オープン予定</span>' : '') +
    '<a class="gh-badge gh-badge--lg" style="text-decoration:none" href="' + brandPath(store.brand) +
    '" title="' + esc(store.brand) + 'の店舗一覧を見る">' + esc(store.brand) + '</a>' +
    '<span class="gh-badge gh-badge--lg">' + esc(store.area) + '</span>' +
    '<span class="gh-badge gh-badge--lg">' + (verified ? '一次情報確認済み' : '一次情報未確認') + '</span></span>');
  html = swap(html, '<div class="gh-quote__address" id="spotAddress"></div>',
    '<div class="gh-quote__address" id="spotAddress"><span>📍 ' +
    esc((store.zip ? '〒' + store.zip + ' ' : '') + store.address) + '</span>' +
    (verified && store.access ? '<span class="gh-hero__divider">｜</span><span>🚉 ' + esc(store.access) + '</span>' : '') + '</div>');
  html = swap(html, '<strong class="gh-quote__rating-num" id="spotMachines">—</strong>',
    '<strong class="gh-quote__rating-num" id="spotMachines">' + esc(verified ? machinesText(store.machines) : '一次情報未確認') + '</strong>');
  html = swap(html, '<span class="gh-quote__updated" id="spotHours"></span>',
    '<span class="gh-quote__updated" id="spotHours">' +
    esc(verified
      ? (store.hours ? (soon ? 'オープン後 ' + store.hours : '営業 ' + store.hours) : '営業時間は公式情報をご確認ください')
      : '営業時間は一次情報未確認') + '</span>');
  html = swap(html, '<div class="gh-metrics" id="spotMetrics"></div>',
    '<div class="gh-metrics" id="spotMetrics">' +
    (soon
      ? metric('オープン予定', openLabel(store.opensOn, false), 'あと' + daysUntil(store.opensOn) + '日', true)
      : metric('設置台数', verified ? machinesText(store.machines) : '一次情報未確認',
        verified ? '確認元を掲載しています' : '参考値は一次情報確認後に掲載', true)) +
    metric('営業時間', verified ? (store.hours || '要確認') : '一次情報未確認',
      verified ? (soon ? 'オープン後の予定' : '定休日は店舗にご確認ください') : '確認完了後に掲載') +
    metric('エリア', store.area || '—', store.pref || '') +
    metric('ブランド', store.brand || '—', verified ? '一次情報確認済み' : '一次情報未確認') + '</div>');

  /* ── 店舗紹介文（静的のみ。ユニークテキストで薄いページ化を防ぐ） ── */
  const samePref = spots.filter((x) => x.pref === store.pref && isVerified(x));
  const sameArea = spots.filter((x) => x.area === store.area && x.id !== store.id && isVerified(x));
  const prefLink = '<a href="' + prefPath(store.pref) + '">' +
    esc(store.pref) + 'の一次情報確認済み店舗（' + samePref.length + '件）</a>';
  const brandLink = '<a href="' + brandPath(store.brand) + '">' +
    esc(store.brand) + 'の店舗一覧</a>';
  /* オープン前は、本文より先に「まだ開いていない」ことを伝える */
  const preOpenNotice = soon
    ? '<div class="gh-preopen" data-gh-preopen="' + store.opensOn + '">' +
        '<strong class="gh-preopen__title">🎉 ' + esc(openLabel(store.opensOn, true)) + ' オープン予定</strong>' +
        '<p class="gh-preopen__text">' + esc(store.name) + 'は<strong>まだオープンしていません</strong>（あと' + daysUntil(store.opensOn) + '日）。' +
          '下記の営業時間・電話番号はオープン後の情報です。お出かけの際はご注意ください。' +
          (store.sourceUrl ? ' 最新情報は<a class="gh-official-source" href="' + esc(store.sourceUrl) + '" target="_blank" rel="noopener">情報の確認元</a>でもご確認ください。' : '') +
        '</p>' +
        '<p class="gh-preopen__text">オープン初日の混雑や品揃えは、このページの掲示板で共有できます。行った人のレポートをお待ちしています。</p>' +
      '</div>'
    : '';
  const verificationNotice = verified
    ? '<div class="gh-preopen"><strong class="gh-preopen__title">✅ 一次情報確認済み</strong>' +
        '<p class="gh-preopen__text">店舗情報は<a class="gh-official-source" href="' + esc(store.sourceUrl) +
        '" target="_blank" rel="noopener noreferrer">確認元のページ</a>を参照し、' + esc(store.verifiedAt) +
        'に掲載内容を確認しました。変更される場合があるため、お出かけ前にも確認元をご覧ください。</p></div>'
    : '<div class="gh-preopen"><strong class="gh-preopen__title">⚠️ 一次情報未確認・検索対象外</strong>' +
        '<p class="gh-preopen__text">この店舗は、確認元URLと確認日の登録がまだ揃っていません。掲載中の店舗名・住所は確認作業中の候補情報であり、' +
        '確認が完了するまで検索エンジンの掲載対象から外しています。最新情報は店舗・施設へ直接ご確認ください。' +
        '<a href="/contact.html">確認元や訂正情報を連絡する</a></p></div>';
  const intro =
    preOpenNotice +
    verificationNotice +
    '<div class="gh-spot-intro">' +
    '<p>' +
      (soon
        ? esc(store.name) + 'は、' + esc(store.pref) + '（' + esc(store.area) + '）に' + esc(openLabel(store.opensOn, true)) +
          'オープン予定のガチャガチャ・カプセルトイ専門店です。'
        : esc(store.name) + 'は、' + esc(store.pref) + '（' + esc(store.area) + '）にあるガチャガチャ・カプセルトイの設置スポットです。') +
      (verified && store.machines ? 'ガチャマシンの設置台数は' + esc(machinesText(store.machines)) + '。' : '') +
      (verified && store.hours ? (soon ? 'オープン後の営業時間は' : '営業時間は') + esc(store.hours) + '。' : '') +
      (verified && store.access ? 'アクセスは' + esc(store.access) + '。' : '') +
    '</p>' +
    '<p>' +
      (sameArea.length || verified
        ? esc(store.area) + 'エリアでは、一次情報確認済みのガチャスポットを' +
          (sameArea.length + (verified ? 1 : 0)) + '件掲載しています。'
        : '') +
      '同じ地域のお店は' + prefLink + '、同じブランドのお店は' + brandLink + 'からも探せます。' +
    '</p>' +
    '<p>' + (verified
      ? '掲載内容は上記の確認元をもとにしています。'
      : '掲載内容は一次情報の確認作業中です。') + '最新の入荷状況・混雑・在庫については、' +
      'このページの掲示板タブで情報をチェック・共有できます。' +
      '営業時間や設置台数は変更される場合があるため、お出かけ前に店舗・施設の最新情報もあわせてご確認ください。</p>' +
    '</div>';
  html = swap(html, '<div class="gh-detail-layout">', intro + '\n      <div class="gh-detail-layout">');

  /* ── 詳細テーブル・地図・掲示板見出し・同エリア店舗 ── */
  html = swap(html, '<tbody id="spotInfoBody"></tbody>',
    '<tbody id="spotInfoBody">' +
    (soon ? '<tr data-gh-preopen="' + store.opensOn + '"><th>オープン予定日</th><td><strong>' +
      esc(openLabel(store.opensOn, true)) + '</strong></td></tr>' : '') +
    row('ブランド', store.brand) +
    row('住所', (store.zip ? '〒' + store.zip + '　' : '') + store.address) +
    row('電話番号', verified && store.tel ? '<a href="tel:' + esc(String(store.tel).replace(/[^0-9+]/g, '')) + '">' + esc(store.tel) + '</a>' : '', true) +
    row('営業時間', verified ? store.hours : '一次情報未確認') +
    row('設置台数', verified ? machinesText(store.machines) : '一次情報未確認') +
    row('アクセス', verified ? store.access : '一次情報未確認') +
    row('エリア', store.area) +
    row('情報の確認元', store.sourceUrl
      ? '<a class="gh-official-source" href="' + esc(store.sourceUrl) + '" target="_blank" rel="noopener">確認元を開く ↗</a>'
      : '', true) +
    row('情報確認日', store.verifiedAt) + '</tbody>');

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

  const nearby = nearbyFor(store);
  html = swap(html, '<div class="gh-nearby" id="spotNearby"></div>',
    '<div class="gh-nearby" id="spotNearby">' + nearby.map((s) =>
      '<a href="' + spotPath(s.id) + '" class="gh-nearby__item"><span class="gh-rank">🏬</span>' +
      '<div><strong>' + esc(s.name) + '</strong><small>' + esc(s.area) + ' ・ ' +
      esc(isVerified(s) ? machinesText(s.machines) : '一次情報未確認') + '</small></div></a>'
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
