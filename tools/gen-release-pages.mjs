/* 月別の新作ガチャ発売情報ページを静的生成する。
   data/releases.js の一次情報確認済みデータを、JavaScriptを実行しない
   クローラーにも読める /releases/YYYY-MM.html として出力する。

   実行: node tools/gen-release-pages.mjs
   過去月のHTMLは消さない。data/releases.js から古い項目が整理されたあとも、
   すでに公開した月別アーカイブを残すため。 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { isIndexableReleaseCount } from './release-policy.mjs';

const ORIGIN = 'https://gacha-hiroba.com';
const releasesFile = new URL('../data/releases.js', import.meta.url);
const outDir = new URL('../releases/', import.meta.url);

/* releases.js はブラウザ用スクリプトなので、一時的な window に読み込む。
   文字列評価は使わず、Node のモジュールローダーで通常のJSとして検証する。 */
const previousWindow = globalThis.window;
const releasesWindow = {};
globalThis.window = releasesWindow;
await import(releasesFile.href + '?generated=' + Date.now());
if (previousWindow === undefined) delete globalThis.window;
else globalThis.window = previousWindow;
const releases = releasesWindow.GH_RELEASES;

if (!Array.isArray(releases) || !releases.length) {
  throw new Error('gen-release-pages: data/releases.js の掲載データが空です');
}

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const checkedOn = releasesWindow.GH_RELEASES_CHECKED_ON;

if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) {
  throw new Error('gen-release-pages: data/releases.js の GH_RELEASES_CHECKED_ON を YYYY-MM-DD 形式で指定してください');
}
const checkedDate = new Date(checkedOn + 'T00:00:00Z');
const todayJst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
if (Number.isNaN(checkedDate.getTime()) || checkedDate.toISOString().slice(0, 10) !== checkedOn || checkedOn > todayJst) {
  throw new Error('gen-release-pages: GH_RELEASES_CHECKED_ON が実在しない日付または未来日です');
}

const formatMonth = (month) => {
  const [year, number] = month.split('-').map(Number);
  return year + '年' + number + '月';
};
const formatDate = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return year + '年' + month + '月' + day + '日';
};
const countValues = (values) => {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'ja'));
};
const priceAmount = (price) => {
  const match = String(price || '').match(/([0-9][0-9,]*)\s*円/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
};

const byMonth = new Map();
for (const [index, release] of releases.entries()) {
  const at = index + 1 + '件目';
  if (!release || typeof release !== 'object') {
    throw new Error('gen-release-pages: ' + at + 'がオブジェクトではありません');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(release.date || '')) {
    throw new Error('gen-release-pages: ' + at + 'のdateが YYYY-MM-DD 形式ではありません');
  }
  if (!release.title || !release.source) {
    throw new Error('gen-release-pages: ' + at + 'のtitleまたはsourceが空です');
  }
  const source = new URL(release.source);
  if (source.protocol !== 'https:') {
    throw new Error('gen-release-pages: ' + at + 'のsourceはHTTPS URLではありません');
  }
  const month = release.date.slice(0, 7);
  if (!byMonth.has(month)) byMonth.set(month, []);
  byMonth.get(month).push(release);
}

function header() {
  return `<header class="gh-header">
    <div class="gh-header__top">
      <div class="gh-container gh-header__inner">
        <a class="gh-logo" href="/index.html" aria-label="ガチャひろば トップへ">
          <img class="gh-logo__icon" src="/assets/mascot-icon.png" alt="ガチャひろばのマスコット" width="34" height="34" />
          <span class="gh-logo__text">ガチャ<em>ひろば</em></span>
        </a>
        <form class="gh-search" role="search">
          <input class="gh-search__input" type="search" placeholder="エリア・駅名・店名で検索" aria-label="ガチャ場所を検索" />
          <button class="gh-search__btn" type="submit" aria-label="検索">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
        </form>
        <button class="gh-hamburger" aria-label="メニューを開く" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
    <div class="gh-subnav">
      <div class="gh-container">
        <nav class="gh-nav-tabs" aria-label="メインナビゲーション">
          <a href="/index.html">トップ</a>
          <a href="/board.html">掲示板</a>
          <a href="/news.html" class="active">新着情報</a>
          <a href="/ranking.html">ランキング</a>
          <a href="/area.html">エリア別</a>
          <a href="/category.html">ブランド別</a>
        </nav>
      </div>
    </div>
  </header>`;
}

function footer() {
  return `<footer class="gh-footer">
    <div class="gh-container">
      <div class="gh-footer__main">
        <div class="gh-footer__brand">
          <a class="gh-logo" href="/index.html"><img class="gh-logo__icon" src="/assets/mascot-icon.png" alt="ガチャひろばのマスコット" width="34" height="34" /><span class="gh-logo__text">ガチャ<em>ひろば</em></span></a>
          <p>全国のガチャガチャ設置場所情報を掲載。<br />あなたのガチャライフをサポートします。</p>
        </div>
        <div class="gh-footer__links">
          <div><strong>サービス</strong><a href="/index.html">トップ</a><a href="/ranking.html">ランキング</a><a href="/news.html">新着情報</a><a href="/map.html">マップ検索</a></div>
          <div><strong>情報</strong><a href="/guide/guide-first-visit.html">ガチャとは</a><a href="/board.html">掲示板を探す</a><a href="/contact.html">未掲載店舗を連絡</a><a href="/about.html">運営情報・編集方針</a><a href="/methodology.html">データ確認方法</a></div>
          <div><strong>サポート</strong><a href="/contact.html">お問い合わせ</a><a href="/terms.html">利用規約</a><a href="/privacy.html">プライバシー</a><a href="/sitemap.html">サイトマップ</a><a href="/english.html">English</a><a href="/advertising.html">広告掲載</a></div>
        </div>
      </div>
      <div class="gh-footer__bottom">
        <span>© 2026 ガチャひろば (gacha-hiroba.com)</span>
        <span>Powered by ガチャひろば</span>
      </div>
    </div>
  </footer>`;
}

function productCard(release, index) {
  const dateLabel = release.label || formatDate(release.date) + ' 発売';
  return `<article class="gh-rel" id="release-${index + 1}">
    ${release.label
      ? `<span class="gh-rel__badge">${esc(dateLabel)}</span>`
      : `<time class="gh-rel__badge" datetime="${esc(release.date)}">${esc(dateLabel)}</time>`}
    <h2 class="gh-rel__title">${esc(release.title)}</h2>
    <div class="gh-rel__meta">
      ${release.maker ? `<span>メーカー：${esc(release.maker)}</span>` : '<span>メーカー：公式情報参照</span>'}
      ${release.price ? `<span class="gh-rel__price">${esc(release.price)}</span>` : ''}
      ${release.note ? `<span class="gh-rel__note">${esc(release.note)}</span>` : ''}
    </div>
    <a class="gh-rel__src gh-official-source" href="${esc(release.source)}" target="_blank" rel="noopener noreferrer">出典：メーカー公式情報 ↗</a>
  </article>`;
}

function buildPage(month, monthReleases) {
  const monthText = formatMonth(month);
  const sorted = [...monthReleases].sort((a, b) =>
    a.date.localeCompare(b.date, 'ja') || a.title.localeCompare(b.title, 'ja')
  );
  const count = sorted.length;
  const robots = isIndexableReleaseCount(count)
    ? 'index,follow,max-image-preview:large'
    : 'noindex,follow';
  const pagePath = '/releases/' + month + '.html';
  const pageUrl = ORIGIN + pagePath;
  const pageTitle = monthText + 'の新作ガチャ' + count + '商品｜発売時期・価格・メーカー | ガチャひろば';
  const pageDesc = monthText + 'に発売される新作ガチャ' + count + '商品をメーカー公式情報にもとづき一覧で紹介。商品名・発売時期・メーカー・価格・確認できた種類数を掲載します。';
  const checkedText = formatDate(checkedOn);

  /* ページ内の集計は、公開データにある値だけから毎回再計算する。 */
  const makerBreakdown = countValues(sorted.map((release) => release.maker || 'メーカー表記なし'));
  const priced = sorted.map((release) => priceAmount(release.price)).filter((value) => value != null);
  const priceBreakdown = countValues(priced).sort((a, b) => Number(a[0]) - Number(b[0]));
  const scheduleBreakdown = [];
  const scheduleByLabel = new Map();
  sorted.forEach((release, index) => {
    const label = release.label || formatDate(release.date) + ' 発売';
    if (!scheduleByLabel.has(label)) {
      const group = { label, count: 0, firstIndex: index };
      scheduleByLabel.set(label, group);
      scheduleBreakdown.push(group);
    }
    scheduleByLabel.get(label).count++;
  });
  const makerSummary = makerBreakdown.map(([maker, makerCount]) => maker + ' ' + makerCount + '商品').join('、');
  const priceSummary = priceBreakdown.length
    ? priceBreakdown.map(([price, priceCount]) => Number(price).toLocaleString('ja-JP') + '円 ' + priceCount + '商品').join('、')
    : '価格を確認できた商品なし';
  const scheduleLinks = scheduleBreakdown.map((group) =>
    '<a href="#release-' + (group.firstIndex + 1) + '">' + esc(group.label) + '<span>' + group.count + '商品</span></a>'
  ).join('\n                ');

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': pageUrl + '#item-list',
    name: monthText + 'の新作ガチャ一覧',
    numberOfItems: count,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: sorted.map((release, index) => {
      const itemUrl = pageUrl + '#release-' + (index + 1);
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: itemUrl,
        name: release.title,
        item: {
          '@type': 'Product',
          name: release.title,
          url: itemUrl,
          sameAs: release.source,
          ...(release.label
            ? { additionalProperty: { '@type': 'PropertyValue', name: '発売時期', value: release.label } }
            : { releaseDate: release.date }),
          ...(release.note ? { description: release.note } : {}),
          ...(release.maker ? { brand: { '@type': 'Brand', name: release.maker } } : {})
        }
      };
    })
  };
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl + '#webpage',
    url: pageUrl,
    name: pageTitle,
    headline: monthText + 'の新作ガチャ' + count + '商品',
    description: pageDesc,
    dateModified: checkedOn,
    inLanguage: 'ja-JP',
    mainEntity: { '@id': itemList['@id'] }
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: '新着情報', item: ORIGIN + '/news.html' },
      { '@type': 'ListItem', position: 3, name: monthText + 'の新作ガチャ', item: pageUrl }
    ]
  };

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="google-site-verification" content="YN5Q0DnCsIhwgitcXjcGqxlmfMec80Wl0uZskCNS11w" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="${robots}" />
  <meta name="description" content="${esc(pageDesc)}" />
  <title>${esc(pageTitle)}</title>
  <link rel="canonical" href="${pageUrl}" />
  <meta property="og:site_name" content="ガチャひろば" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="ja_JP" />
  <meta property="og:title" content="${esc(pageTitle)}" />
  <meta property="og:description" content="${esc(pageDesc)}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${ORIGIN}/assets/ogp.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" type="image/png" href="/assets/mascot-icon.png" />
  <link rel="stylesheet" href="/styles.css" />
  <script type="application/ld+json">${safeJson(collection)}</script>
  <script type="application/ld+json">${safeJson(itemList)}</script>
  <script type="application/ld+json">${safeJson(breadcrumbs)}</script>
  <script src="/script.js" defer></script>
</head>
<body>
  ${header()}

  <main id="main" class="gh-main">
    <div class="gh-container">
      <nav class="gh-breadcrumb" aria-label="パンくずリスト">
        <a href="/index.html">トップ</a>
        <span aria-hidden="true">›</span>
        <a href="/news.html">新着情報</a>
        <span aria-hidden="true">›</span>
        <span aria-current="page">${monthText}の新作ガチャ</span>
      </nav>

      <div class="gh-page-hero">
        <h1 class="gh-page-hero__title">${monthText}の新作ガチャ・カプセルトイ発売情報</h1>
        <p class="gh-page-hero__desc">メーカー公式情報で確認できた${count}商品を、発売時期順にまとめています。価格や種類数は確認できた商品のみ掲載しています。</p>
        <p class="gh-page-hero__desc">メーカー公式情報の最終確認：<time datetime="${checkedOn}">${checkedText}</time></p>
      </div>

      <div class="gh-main__layout">
        <div class="gh-main__content">
          <section class="gh-section" aria-labelledby="release-summary-title">
            <div class="gh-section__header">
              <h2 class="gh-section__title" id="release-summary-title">掲載データの内訳</h2>
              <span class="gh-section__sub">${count}商品を元データから集計</span>
            </div>
            <div class="gh-summary-bar gh-landing-metrics">
              <div class="gh-summary-card">
                <span class="gh-summary-card__label">掲載商品</span>
                <strong class="gh-summary-card__value">${count}商品</strong>
                <small class="gh-summary-card__change">公式ページを確認済み</small>
              </div>
              <div class="gh-summary-card">
                <span class="gh-summary-card__label">メーカー表記</span>
                <strong class="gh-summary-card__value">${makerBreakdown.length}区分</strong>
                <small class="gh-summary-card__change">${esc(makerSummary)}</small>
              </div>
              <div class="gh-summary-card">
                <span class="gh-summary-card__label">価格を確認できた商品</span>
                <strong class="gh-summary-card__value">${priced.length} / ${count}商品</strong>
                <small class="gh-summary-card__change">${esc(priceSummary)}</small>
              </div>
              <div class="gh-summary-card">
                <span class="gh-summary-card__label">発売時期の表記</span>
                <strong class="gh-summary-card__value">${scheduleBreakdown.length}区分</strong>
                <small class="gh-summary-card__change">日付またはメーカー公表の週単位</small>
              </div>
            </div>
            <p class="gh-landing-lead">メーカー公式ページで確認できた商品だけを掲載しています。この月に発売されるすべての商品を網羅した一覧ではありません。週単位で告知された商品の日付は並び替え用の代表日で、実際の入荷日は地域・店舗によって異なります。</p>
            <div class="gh-landing-links" aria-label="発売時期からページ内を移動">
              ${scheduleLinks}
            </div>
            <div class="gh-landing-actions">
              <a class="gh-btn gh-btn--primary" href="/stores.html">エリア・駅名から店舗を探す</a>
              <a class="gh-btn" href="/map.html">現在地の近くをマップで探す</a>
              <a class="gh-btn" href="/board.html">入荷情報を掲示板で確認する</a>
            </div>
          </section>

          <section class="gh-section gh-release-sec" aria-labelledby="release-list-title">
            <div class="gh-section__header">
              <h2 class="gh-section__title" id="release-list-title">${monthText}発売の${count}商品</h2>
              <span class="gh-section__sub">発売時期順</span>
            </div>
            <div class="gh-rel-list">
              ${sorted.map(productCard).join('\n              ')}
            </div>
            <p class="gh-rel-note">発売時期・価格・種類数は、<time datetime="${checkedOn}">${checkedText}</time>までに確認したメーカー公式情報にもとづきます。店舗や地域により入荷日・取り扱い・在庫状況が異なり、発売時期や価格が変更される場合があります。在庫を保証するページではありません。</p>
          </section>

          <a class="gh-store-cta" href="/map.html">
            <span class="gh-store-cta__icon" aria-hidden="true">🗺️</span>
            <span class="gh-store-cta__body"><strong>近くのガチャ設置場所をマップで探す</strong><small>現在地や表示中のエリアから、取り扱い店舗候補を見つけられます。</small></span>
            <span class="gh-store-cta__arrow" aria-hidden="true">›</span>
          </a>
          <a class="gh-store-cta" href="/stores.html">
            <span class="gh-store-cta__icon" aria-hidden="true">🏬</span>
            <span class="gh-store-cta__body"><strong>全国のガチャ専門店・設置店舗を見る</strong><small>エリア・駅名・店名から店舗情報を検索できます。</small></span>
            <span class="gh-store-cta__arrow" aria-hidden="true">›</span>
          </a>
        </div>

        <aside class="gh-sidebar">
          <div class="gh-widget">
            <h2 class="gh-widget__title">商品を探しに行く</h2>
            <ul class="gh-category-list">
              <li><a href="/map.html" class="gh-category-item"><span class="gh-category-item__icon">🗺️</span><span>マップから探す</span></a></li>
              <li><a href="/stores.html" class="gh-category-item"><span class="gh-category-item__icon">🏬</span><span>店舗一覧から探す</span></a></li>
              <li><a href="/ranking.html" class="gh-category-item"><span class="gh-category-item__icon">📊</span><span>設置台数ランキング</span></a></li>
              <li><a href="/board.html" class="gh-category-item"><span class="gh-category-item__icon">💬</span><span>入荷情報を聞く</span></a></li>
            </ul>
          </div>
          <div class="gh-widget">
            <h2 class="gh-widget__title">情報について</h2>
            <p class="gh-widget__text">発売情報の出典リンクは各メーカーの公式ページです。掲載内容は確認日以降に変更される場合があります。</p>
          </div>
        </aside>
      </div>
    </div>
  </main>

  ${footer()}
</body>
</html>\n`;
}

mkdirSync(outDir, { recursive: true });
const months = [...byMonth.keys()].sort().reverse();
for (const month of months) {
  const html = buildPage(month, byMonth.get(month));
  writeFileSync(new URL(month + '.html', outDir), html, 'utf8');
}

console.log('gen-release-pages: OK / ' + months.length + 'か月分（' + months.join(', ') + '）');
