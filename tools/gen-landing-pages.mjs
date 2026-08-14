/* 都道府県・ブランド別の検索入口を、実店舗データから完全な静的HTMLとして生成する。
   URL: /area/<pref-slug>.html, /brand/<brand-slug>.html */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { PREF_SLUG, BRAND_SLUG, prefPath, brandPath, guidePath } from './seo-routes.mjs';

const ORIGIN = 'https://gacha-hiroba.com';
const STATIC_ROUTES_LAUNCHED = '2026-08-12';
const win = {};
new Function('window', readFileSync(new URL('../data/spots.js', import.meta.url), 'utf8'))(win);
new Function('window', readFileSync(new URL('../data/articles.js', import.meta.url), 'utf8'))(win);
const spots = win.GH_SPOTS || [];
const articles = win.GH_ARTICLES || [];
if (!spots.length) throw new Error('gen-landing-pages: 店舗データが空です');

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const machinesText = (n) => n == null || n === '' ? '—' : '約' + Number(n).toLocaleString('ja-JP') + '台';
const spotPath = (id) => '/spot/' + encodeURIComponent(id) + '.html';
const localArea = (area) => String(area || '').split('・').slice(1).join('・') || String(area || '');
const latestVerified = (items) => [STATIC_ROUTES_LAUNCHED, ...items.map((s) => s.verifiedAt)]
  .filter(Boolean).sort().at(-1) || '';
const jstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const isPreOpen = (store) => !!(store.opensOn && store.opensOn > jstToday);
const sortedStores = (items) => items.slice().sort((a, b) =>
  ((b.machines != null) - (a.machines != null)) || ((b.machines || 0) - (a.machines || 0)) ||
  String(a.name).localeCompare(String(b.name), 'ja'));

const REGION_LABEL = {
  kanto: '関東', kansai: '関西', tokai: '東海・北陸・甲信越',
  kyushu: '九州・沖縄', tohoku: '東北・北海道', chugoku: '中国・四国'
};

function header(active) {
  return `<header class="gh-header">
    <div class="gh-header__top"><div class="gh-container gh-header__inner">
      <a class="gh-logo" href="/index.html" aria-label="ガチャひろば トップへ">
        <img class="gh-logo__icon" src="/assets/mascot-icon.png" alt="ガチャひろばのマスコット" width="34" height="34" />
        <span class="gh-logo__text">ガチャ<em>ひろば</em></span>
      </a>
      <form class="gh-search" role="search"><input class="gh-search__input" type="search" placeholder="エリア・駅名・店名で検索" aria-label="ガチャ場所を検索" /><button class="gh-search__btn" type="submit" aria-label="検索"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></button></form>
      <button class="gh-hamburger" aria-label="メニューを開く" aria-expanded="false"><span></span><span></span><span></span></button>
    </div></div>
    <div class="gh-subnav"><div class="gh-container"><nav class="gh-nav-tabs" aria-label="メインナビゲーション">
      <a href="/index.html">トップ</a><a href="/board.html">掲示板</a><a href="/news.html">新着情報</a><a href="/ranking.html">ランキング</a><a href="/area.html"${active === 'area' ? ' class="active"' : ''}>エリア別</a><a href="/category.html"${active === 'brand' ? ' class="active"' : ''}>ブランド別</a>
    </nav></div></div>
  </header>`;
}

function footer() {
  return `<footer class="gh-footer"><div class="gh-container">
    <div class="gh-footer__main">
      <div class="gh-footer__brand"><a class="gh-logo" href="/index.html"><img class="gh-logo__icon" src="/assets/mascot-icon.png" alt="ガチャひろばのマスコット" width="34" height="34" /><span class="gh-logo__text">ガチャ<em>ひろば</em></span></a><p>全国のガチャガチャ設置場所情報を掲載。<br />あなたのガチャライフをサポートします。</p></div>
      <div class="gh-footer__links"><div><strong>サービス</strong><a href="/index.html">トップ</a><a href="/stores.html">店舗一覧</a><a href="/ranking.html">ランキング</a><a href="/map.html">マップ検索</a></div><div><strong>情報</strong><a href="/board.html">掲示板</a><a href="/news.html">新着情報</a><a href="/area.html">エリア別</a><a href="/about.html">運営情報・編集方針</a></div><div><strong>サポート</strong><a href="/contact.html">お問い合わせ</a><a href="/terms.html">利用規約</a><a href="/privacy.html">プライバシー</a><a href="/sitemap.html">サイトマップ</a></div></div>
    </div><div class="gh-footer__bottom"><span>© 2026 ガチャひろば (gacha-hiroba.com)</span><span>Powered by ガチャひろば</span></div>
  </div></footer>`;
}

function table(items, mode) {
  return `<div class="gh-table-wrap"><table class="gh-table gh-landing-table">
    <thead><tr><th>店舗名</th><th>エリア</th><th class="gh-num">設置台数</th><th>営業時間</th></tr></thead>
    <tbody>${sortedStores(items).map((s) => `<tr>
      <td><a class="gh-table__link" href="${spotPath(s.id)}">${esc(s.name)}</a>${isPreOpen(s) ? `<span class="gh-badge gh-badge--soon" data-gh-preopen="${esc(s.opensOn)}">${esc(s.opensOn)} オープン予定</span>` : ''}<small class="gh-store-brand">${esc(mode === 'pref' ? s.brand : s.pref)}</small></td>
      <td>${esc(localArea(s.area) || s.pref)}</td><td class="gh-num">${esc(machinesText(s.machines))}</td><td>${esc(s.hours || '要確認')}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function structuredData({ title, description, path, items, crumbParent, crumbParentPath, modified }) {
  const url = ORIGIN + path;
  const collection = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title,
    description, url, inLanguage: 'ja', isPartOf: { '@type': 'WebSite', name: 'ガチャひろば', url: ORIGIN + '/' },
    mainEntity: {
      '@type': 'ItemList', numberOfItems: items.length,
      itemListElement: sortedStores(items).map((s, i) => ({
        '@type': 'ListItem', position: i + 1, name: s.name, url: ORIGIN + spotPath(s.id)
      }))
    }
  };
  if (modified) collection.dateModified = modified;
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: crumbParent, item: ORIGIN + crumbParentPath },
      { '@type': 'ListItem', position: 3, name: title, item: url }
    ]
  };
  return `<script type="application/ld+json">${json(collection)}</script>\n  <script type="application/ld+json">${json(crumbs)}</script>`;
}

function documentHtml({ title, description, path, active, crumbParent, crumbParentPath, body, items, modified }) {
  const url = ORIGIN + path;
  return `<!doctype html>
<html lang="ja"><head>
  <meta charset="UTF-8" /><meta name="google-site-verification" content="YN5Q0DnCsIhwgitcXjcGqxlmfMec80Wl0uZskCNS11w" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${esc(description)}" /><title>${esc(title)} | ガチャひろば</title>
  <link rel="canonical" href="${url}" />
  <meta property="og:site_name" content="ガチャひろば" /><meta property="og:type" content="website" /><meta property="og:locale" content="ja_JP" />
  <meta property="og:title" content="${esc(title)} | ガチャひろば" /><meta property="og:description" content="${esc(description)}" /><meta property="og:url" content="${url}" /><meta property="og:image" content="${ORIGIN}/assets/ogp.png" />
  <meta name="twitter:card" content="summary_large_image" /><link rel="icon" type="image/png" href="/assets/mascot-icon.png" /><link rel="stylesheet" href="/styles.css" />
  ${structuredData({ title, description, path, items, crumbParent, crumbParentPath, modified })}
  <script src="/script.js" defer></script>
</head><body>${header(active)}
  <main class="gh-main"><div class="gh-container">
    <nav class="gh-breadcrumb" aria-label="パンくずリスト"><a href="/index.html">トップ</a><span aria-hidden="true">›</span><a href="${crumbParentPath}">${esc(crumbParent)}</a><span aria-hidden="true">›</span><span aria-current="page">${esc(title)}</span></nav>
    ${body}
  </div></main>${footer()}</body></html>\n`;
}

function prefPage(pref, items) {
  const path = prefPath(pref);
  const title = `${pref}のガチャガチャ設置場所（${items.length}店舗）｜営業時間・設置台数`;
  const areaNames = [...new Set(items.map((s) => localArea(s.area)).filter(Boolean))];
  const brandNames = [...new Set(items.map((s) => s.brand).filter(Boolean))];
  const knownMachines = items.filter((s) => s.machines != null);
  const top = sortedStores(knownMachines)[0];
  const modified = latestVerified(items);
  const description = `${pref}のガチャガチャ・カプセルトイ設置場所${items.length}店舗を一覧で比較。住所、営業時間、アクセス${knownMachines.length ? '、設置台数' : ''}を確認し、店舗別の地図・掲示板へ移動できます。`;
  const related = articles.filter((a) =>
    (a.areas || []).some((area) => items.some((s) => s.area === area)) || (a.ranking && a.ranking.pref === pref));
  const region = items[0] && items[0].region;
  const nearbyPrefs = [...new Set(spots.filter((s) => s.region === region && s.pref !== pref).map((s) => s.pref))];
  const body = `<div class="gh-page-hero"><h1 class="gh-page-hero__title">${esc(pref)}のガチャガチャ設置場所</h1><p class="gh-page-hero__desc">${esc(pref)}で掲載中のガチャガチャ・カプセルトイ専門店と設置スポットを、実店舗データからまとめています。</p></div>
    <section class="gh-section"><div class="gh-metrics gh-landing-metrics"><div class="gh-metric gh-metric--primary"><span class="gh-metric__label">掲載店舗</span><strong class="gh-metric__value">${items.length}店舗</strong><span class="gh-metric__sub">住所・地図つき</span></div><div class="gh-metric"><span class="gh-metric__label">掲載エリア</span><strong class="gh-metric__value">${areaNames.length}エリア</strong><span class="gh-metric__sub">${esc(areaNames.slice(0, 3).join('・') || pref)}</span></div><div class="gh-metric"><span class="gh-metric__label">ブランド</span><strong class="gh-metric__value">${brandNames.length}種類</strong><span class="gh-metric__sub">専門店・設置コーナー</span></div>${top ? `<div class="gh-metric"><span class="gh-metric__label">掲載台数トップ</span><strong class="gh-metric__value">${esc(machinesText(top.machines))}</strong><span class="gh-metric__sub">${esc(top.name)}</span></div>` : ''}</div>
      <p class="gh-landing-lead">${esc(pref)}内の掲載店は現在${items.length}店舗です。${knownMachines.length ? `うち${knownMachines.length}店舗で設置台数を掲載しています。` : ''}各店舗ページで住所・アクセス・営業時間・地図を確認でき、掲示板では入荷や混雑の情報を共有できます。</p>
      <div class="gh-landing-actions"><a class="gh-btn gh-btn--primary" href="/map.html">🗺️ 地図・現在地から探す</a><a class="gh-btn" href="/stores.html?q=${encodeURIComponent(pref)}">🔎 ${esc(pref)}をキーワード検索</a></div>
    </section>
    <section class="gh-section"><div class="gh-section__header"><h2 class="gh-section__title">${esc(pref)}の店舗一覧 <span class="gh-store-section__count">${items.length}件</span></h2></div>${table(items, 'pref')}<p class="gh-detail-note">営業時間・設置台数は変更される場合があります。お出かけ前に各店舗の公式情報もご確認ください。${modified ? ` 確認日が登録されている情報のうち最新：${esc(modified)}。` : ''}</p></section>
${related.length ? `<section class="gh-section"><div class="gh-section__header"><h2 class="gh-section__title">${esc(pref)}の関連記事</h2></div><div class="gh-news-list">${related.map((a) => `<a class="gh-news-item" href="${guidePath(a.slug)}"><span class="gh-badge gh-badge--new">ガイド</span><span>${esc(a.emoji + ' ' + a.title)}</span></a>`).join('')}</div></section>` : ''}
${nearbyPrefs.length ? `<section class="gh-section"><div class="gh-section__header"><h2 class="gh-section__title">${esc(REGION_LABEL[region] || '近隣')}の都道府県</h2></div><div class="gh-landing-links">${nearbyPrefs.map((p) => `<a href="${prefPath(p)}">${esc(p)}のガチャガチャ設置場所</a>`).join('')}</div></section>` : ''}`;
  return documentHtml({ title, description, path, active: 'area', crumbParent: 'エリアから探す', crumbParentPath: '/area.html', body, items, modified });
}

function brandPage(brand, items) {
  const path = brandPath(brand);
  const title = `${brand}の店舗一覧（${items.length}店舗）｜住所・営業時間・設置台数`;
  const prefs = [...new Set(items.map((s) => s.pref))];
  const knownMachines = items.filter((s) => s.machines != null);
  const modified = latestVerified(items);
  const description = `${brand}の掲載店舗${items.length}店を都道府県別に一覧で比較。住所、営業時間、アクセス${knownMachines.length ? '、設置台数' : ''}を確認し、店舗別の地図・掲示板へ移動できます。`;
  const prefCounts = prefs.map((p) => [p, items.filter((s) => s.pref === p).length]).sort((a, b) => b[1] - a[1]);
  const body = `<div class="gh-page-hero"><h1 class="gh-page-hero__title">${esc(brand)}の店舗一覧</h1><p class="gh-page-hero__desc">「${esc(brand)}」として掲載している全国のガチャガチャ・カプセルトイ店舗を、実店舗データからまとめています。</p></div>
    <section class="gh-section"><div class="gh-metrics gh-landing-metrics"><div class="gh-metric gh-metric--primary"><span class="gh-metric__label">掲載店舗</span><strong class="gh-metric__value">${items.length}店舗</strong><span class="gh-metric__sub">住所・地図つき</span></div><div class="gh-metric"><span class="gh-metric__label">掲載都道府県</span><strong class="gh-metric__value">${prefs.length}</strong><span class="gh-metric__sub">${esc(prefs.slice(0, 3).join('・'))}</span></div><div class="gh-metric"><span class="gh-metric__label">台数掲載</span><strong class="gh-metric__value">${knownMachines.length}店舗</strong><span class="gh-metric__sub">公表情報がある店舗</span></div></div>
      <p class="gh-landing-lead">${esc(brand)}の掲載店は現在${items.length}店舗です。店舗ごとの住所・アクセス・営業時間・地図と、入荷・混雑情報を共有できる掲示板を確認できます。</p>
      <div class="gh-landing-actions"><a class="gh-btn gh-btn--primary" href="/map.html">🗺️ 地図・現在地から探す</a><a class="gh-btn" href="/stores.html?q=${encodeURIComponent(brand)}">🔎 店名・エリアを検索</a></div>
    </section>
    <section class="gh-section"><div class="gh-section__header"><h2 class="gh-section__title">都道府県から絞り込む</h2></div><div class="gh-landing-links">${prefCounts.map(([p, count]) => `<a href="${prefPath(p)}">${esc(p)} <span>${count}店</span></a>`).join('')}</div></section>
    <section class="gh-section"><div class="gh-section__header"><h2 class="gh-section__title">${esc(brand)}の店舗 <span class="gh-store-section__count">${items.length}件</span></h2></div>${table(items, 'brand')}<p class="gh-detail-note">営業時間・設置台数は変更される場合があります。お出かけ前に各店舗の公式情報もご確認ください。${modified ? ` 確認日が登録されている情報のうち最新：${esc(modified)}。` : ''}</p></section>`;
  return documentHtml({ title, description, path, active: 'brand', crumbParent: 'ブランドから探す', crumbParentPath: '/category.html', body, items, modified });
}

function cleanDir(dir, valid) {
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.html') && !valid.has(file)) unlinkSync(new URL(file, dir));
  }
}

const areaDir = new URL('../area/', import.meta.url);
const areaEntries = Object.entries(PREF_SLUG).filter(([pref]) => spots.some((s) => s.pref === pref));
cleanDir(areaDir, new Set(areaEntries.map(([, slug]) => slug + '.html')));
for (const [pref, slug] of areaEntries) {
  writeFileSync(new URL(slug + '.html', areaDir), prefPage(pref, spots.filter((s) => s.pref === pref)));
}

const brandDir = new URL('../brand/', import.meta.url);
const brandEntries = Object.entries(BRAND_SLUG).filter(([brand]) => spots.filter((s) => s.brand === brand).length >= 2);
cleanDir(brandDir, new Set(brandEntries.map(([, slug]) => slug + '.html')));
for (const [brand, slug] of brandEntries) {
  writeFileSync(new URL(slug + '.html', brandDir), brandPage(brand, spots.filter((s) => s.brand === brand)));
}

console.log(`gen-landing-pages: area ${areaEntries.length}ページ / brand ${brandEntries.length}ページを生成しました`);
