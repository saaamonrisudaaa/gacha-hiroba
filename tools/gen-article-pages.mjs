/* 特集・ガイド記事の静的HTML生成スクリプト
   data/articles.js と data/spots.js を読み込み、全記事を /guide/<slug>.html に
   出力する。本文・店舗比較・構造化データまでHTMLへ焼き込み、JavaScriptを
   実行しないクローラーにも記事の内容がそのまま伝わるようにする。

   実行: node tools/gen-article-pages.mjs */
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';

const ORIGIN = 'https://gacha-hiroba.com';
const STATIC_ROUTES_LAUNCHED = '2026-08-12';
const outDir = new URL('../guide/', import.meta.url);

function loadWindowData(relativePath, property) {
  const win = {};
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  new Function('window', source)(win);
  const value = win[property];
  if (!Array.isArray(value)) {
    throw new Error(`${relativePath}: window.${property} が配列ではありません`);
  }
  return value;
}

const articles = loadWindowData('../data/articles.js', 'GH_ARTICLES');
const spots = loadWindowData('../data/spots.js', 'GH_SPOTS');

if (!articles.length) throw new Error('gen-article-pages: 記事データが空です');

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const ldJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const machinesText = (value) => (value == null || value === '')
  ? '—'
  : `約${Number(value).toLocaleString('ja-JP')}台`;
const guidePath = (slug) => `/guide/${encodeURIComponent(slug)}.html`;
const spotPath = (id) => `/spot/${encodeURIComponent(id)}.html`;
const latestDate = (values) => values
  .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value || ''))
  .sort().at(-1) || '';

function resolveStores(article) {
  if (article.ranking) {
    return spots.filter((spot) => {
      if (article.ranking.pref && spot.pref !== article.ranking.pref) return false;
      if (article.ranking.region && spot.region !== article.ranking.region) return false;
      return spot.machines != null;
    }).sort((a, b) => (b.machines || 0) - (a.machines || 0))
      .slice(0, article.ranking.limit || 10);
  }

  const areas = Array.isArray(article.areas) ? article.areas : [];
  return spots.filter((spot) => areas.includes(spot.area))
    .sort((a, b) => (b.machines || 0) - (a.machines || 0));
}

function relatedLabel(article) {
  return (article.type === 'guide' || article.ranking)
    ? article.label
    : `${article.label}のガチャガチャまとめ`;
}

function buildStructuredData(article, stores, pageUrl, description, modified) {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': `${pageUrl}#article`,
      headline: article.title,
      description,
      image: `${ORIGIN}/assets/ogp.png`,
      datePublished: article.updated,
      dateModified: modified,
      inLanguage: 'ja',
      mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
      author: { '@type': 'Organization', name: 'ガチャひろば', url: `${ORIGIN}/` },
      publisher: {
        '@type': 'Organization',
        name: 'ガチャひろば',
        url: `${ORIGIN}/`,
        logo: { '@type': 'ImageObject', url: `${ORIGIN}/assets/mascot-icon.png` }
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'トップ', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: '新着情報・特集記事', item: `${ORIGIN}/news.html` },
        { '@type': 'ListItem', position: 3, name: article.title, item: pageUrl }
      ]
    }
  ];

  if (stores.length) {
    data.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${article.label}の掲載店舗`,
      numberOfItems: stores.length,
      itemListElement: stores.map((store, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: store.name,
        url: `${ORIGIN}${spotPath(store.id)}`
      }))
    });
  }

  if (Array.isArray(article.faq) && article.faq.length) {
    data.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: article.faq.map((entry) => ({
        '@type': 'Question',
        name: entry.q,
        acceptedAnswer: { '@type': 'Answer', text: entry.a }
      }))
    });
  }

  return data.map((entry) =>
    `  <script type="application/ld+json">${ldJson(entry)}</script>`
  ).join('\n');
}

function buildTable(stores) {
  if (!stores.length) return '';
  return `
            <h2 class="gh-article__h2">掲載店舗の一覧・比較</h2>
            <div class="gh-table-wrap">
              <table class="gh-table">
                <thead><tr><th>店舗名</th><th class="gh-num">設置台数</th><th>営業時間</th><th></th></tr></thead>
                <tbody>
${stores.map((store) => {
  const url = spotPath(store.id);
  return `                  <tr><td><a class="gh-table__link" href="${url}">${esc(store.name)}</a></td><td class="gh-num">${esc(machinesText(store.machines))}</td><td>${esc(store.hours || '—')}</td><td><a href="${url}" class="gh-btn gh-btn--xs">詳細</a></td></tr>`;
}).join('\n')}
                </tbody>
              </table>
            </div>`;
}

function buildStoreDetails(stores) {
  if (!stores.length) return '';
  return `
            <h2 class="gh-article__h2">各店舗の詳細</h2>
${stores.map((store, index) => {
  const url = spotPath(store.id);
  const rows = [
    `<tr><th>住所</th><td>${esc(`${store.zip ? `〒${store.zip}　` : ''}${store.address || ''}`)}</td></tr>`,
    store.machines ? `<tr><th>設置台数</th><td>${esc(machinesText(store.machines))}</td></tr>` : '',
    store.hours ? `<tr><th>営業時間</th><td>${esc(store.hours)}</td></tr>` : '',
    store.access ? `<tr><th>アクセス</th><td>${esc(store.access)}</td></tr>` : ''
  ].filter(Boolean).join('');
  return `            <section class="gh-article-store">
              <h3 class="gh-article-store__name">${index + 1}. <a href="${url}">${esc(store.name)}</a></h3>
              <table class="gh-info-table gh-info-table--full"><tbody>${rows}</tbody></table>
              <div class="gh-article-store__actions">
                <a href="${url}" class="gh-btn gh-btn--primary gh-btn--sm">店舗ページ・地図を見る</a>
                <a href="${url}#board" class="gh-btn gh-btn--sm">💬 掲示板を見る</a>
              </div>
            </section>`;
}).join('\n')}`;
}

function buildArticleBody(article, stores, modified) {
  const intro = (article.intro || []).map((paragraph) =>
    `              <p>${esc(paragraph)}</p>`
  ).join('\n');
  const sections = (article.sections || []).map((section) => `
              <h2 class="gh-article-h2">${esc(section.h)}</h2>
${(section.body || []).map((paragraph) => `              <p>${esc(paragraph)}</p>`).join('\n')}`
  ).join('');
  const tips = Array.isArray(article.tips) && article.tips.length
    ? `
            <div class="gh-article__tips">
              <h2 class="gh-article__h2">編集部メモ（回り方のコツ）</h2>
              <ul>${article.tips.map((tip) => `<li>${esc(tip)}</li>`).join('')}</ul>
            </div>`
    : '';
  const faq = Array.isArray(article.faq) && article.faq.length
    ? `
            <div>
              <h2 class="gh-article__h2">❓ よくある質問</h2>
              ${article.faq.map((entry) => `<details class="gh-faq"><summary class="gh-faq__q">${esc(entry.q)}</summary><p class="gh-faq__a">${esc(entry.a)}</p></details>`).join('\n              ')}
            </div>`
    : '';

  return `
            <h1 class="gh-article__title">${esc(`${article.emoji} ${article.title}`)}</h1>
            <div class="gh-article__meta">最終更新：<time datetime="${esc(modified)}">${esc(modified)}</time>${stores.length ? `　・　掲載 <strong>${stores.length}店舗</strong>（実データ）` : '　・　保存版ガイド'}</div>
            <div class="gh-article__intro">
${intro}${sections}
            </div>${buildTable(stores)}${buildStoreDetails(stores)}${tips}${faq}
            <p class="gh-detail-note">※掲載情報は各店舗・公式サイトをもとにした参考情報です。最新の営業時間・在庫は店舗または公式サイトでご確認ください。店舗データが更新されると本記事の一覧も自動で最新になります。</p>`;
}

function buildPage(article) {
  const stores = resolveStores(article);
  const pageUrl = `${ORIGIN}${guidePath(article.slug)}`;
  const pageTitle = `${article.title} | ガチャひろば`;
  const description = (article.intro && article.intro[0]) || `${article.label}のガチャガチャ情報を紹介します。`;
  const related = articles.filter((item) => item.slug !== article.slug);
  const modified = latestDate([STATIC_ROUTES_LAUNCHED, article.updated, ...stores.map((store) => store.verifiedAt)]);
  const structuredData = buildStructuredData(article, stores, pageUrl, description, modified);

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="google-site-verification" content="YN5Q0DnCsIhwgitcXjcGqxlmfMec80Wl0uZskCNS11w" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta name="description" content="${esc(description)}" />
  <title>${esc(pageTitle)}</title>
  <link rel="canonical" href="${pageUrl}" />
  <meta property="og:site_name" content="ガチャひろば" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="ja_JP" />
  <meta property="og:title" content="${esc(pageTitle)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${ORIGIN}/assets/ogp.png" />
  <meta property="article:published_time" content="${esc(article.updated)}" />
  <meta property="article:modified_time" content="${esc(modified)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(pageTitle)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${ORIGIN}/assets/ogp.png" />
  <link rel="icon" type="image/png" href="/assets/mascot-icon.png" />
  <link rel="stylesheet" href="/styles.css" />
${structuredData}
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5458972550684006" crossorigin="anonymous"></script>
  <script src="/data/ads.js" defer></script>
  <script src="/script.js" defer></script>
</head>
<body>
  <header class="gh-header">
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
        <button class="gh-hamburger" aria-label="メニューを開く" aria-expanded="false"><span></span><span></span><span></span></button>
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
  </header>

  <main class="gh-main">
    <div class="gh-container">
      <nav class="gh-breadcrumb" aria-label="パンくずリスト">
        <a href="/index.html">トップ</a><span aria-hidden="true">›</span>
        <a href="/news.html">特集記事</a><span aria-hidden="true">›</span>
        <span aria-current="page">${esc(article.label)}のガチャガチャまとめ</span>
      </nav>

      <div class="gh-main__layout">
        <div class="gh-main__content">
          <article class="gh-section gh-article">${buildArticleBody(article, stores, modified)}
          </article>
        </div>

        <aside class="gh-sidebar">
          <div class="gh-ad" aria-label="広告">
            <span class="gh-ad__label">広告</span>
            <div class="gh-ad__body"><strong>スポンサーリンク</strong><small>広告枠（レスポンシブ / 300×250）</small></div>
          </div>
          <div class="gh-widget">
            <h2 class="gh-widget__title">他のエリアのまとめ記事</h2>
            <ul class="gh-category-list">
${related.map((item) => `              <li><a href="${guidePath(item.slug)}" class="gh-category-item"><span class="gh-category-item__icon">${esc(item.emoji)}</span><span>${esc(relatedLabel(item))}</span></a></li>`).join('\n')}
            </ul>
          </div>
          <div class="gh-widget gh-widget--accent">
            <h2 class="gh-widget__title">店舗を探す</h2>
            <p class="gh-widget__text">全国のガチャガチャ設置店を一覧・マップ・ランキングから探せます。</p>
            <div class="gh-app-btns">
              <a href="/stores.html" class="gh-app-btn">🏬 店舗一覧を見る</a>
              <a href="/ranking.html" class="gh-app-btn">📊 ランキングを見る</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </main>

  <footer class="gh-footer">
    <div class="gh-container">
      <div class="gh-footer__main">
        <div class="gh-footer__brand">
          <a class="gh-logo" href="/index.html"><img class="gh-logo__icon" src="/assets/mascot-icon.png" alt="ガチャひろばのマスコット" width="34" height="34" /><span class="gh-logo__text">ガチャ<em>ひろば</em></span></a>
          <p>全国のガチャガチャ設置場所情報を網羅。<br />あなたのガチャライフをサポートします。</p>
        </div>
        <div class="gh-footer__links">
          <div><strong>サービス</strong><a href="/index.html">トップ</a><a href="/stores.html">店舗一覧</a><a href="/ranking.html">ランキング</a><a href="/map.html">マップ検索</a></div>
          <div><strong>情報</strong><a href="/board.html">掲示板</a><a href="/news.html">新着情報</a><a href="/area.html">エリア別</a></div>
          <div><strong>サポート</strong><a href="/contact.html">お問い合わせ</a><a href="/terms.html">利用規約</a><a href="/privacy.html">プライバシー</a><a href="/sitemap.html">サイトマップ</a><a href="/english.html">English</a><a href="/advertising.html">広告掲載</a></div>
        </div>
      </div>
      <div class="gh-footer__bottom"><span>© 2026 ガチャひろば (gacha-hiroba.com)</span><span>Powered by ガチャひろば</span></div>
    </div>
  </footer>
</body>
</html>
`;
}

function validatePage(article, stores, html) {
  const expectedCanonical = `${ORIGIN}${guidePath(article.slug)}`;
  const required = [
    `<title>${esc(`${article.title} | ガチャひろば`)}</title>`,
    `<link rel="canonical" href="${expectedCanonical}" />`,
    `<h1 class="gh-article__title">${esc(`${article.emoji} ${article.title}`)}</h1>`,
    '<script src="/data/ads.js" defer></script>',
    '<script src="/script.js" defer></script>',
    '</html>'
  ];
  for (const marker of required) {
    if (!html.includes(marker)) {
      throw new Error(`gen-article-pages: ${article.slug} に必須要素がありません: ${marker}`);
    }
  }

  const h1Count = (html.match(/<h1\b/g) || []).length;
  if (h1Count !== 1) {
    throw new Error(`gen-article-pages: ${article.slug} の h1 が ${h1Count} 個あります`);
  }
  if (/\b(?:href|src)="(?!https?:\/\/|\/|#|mailto:|tel:|data:)[^"]+"/.test(html)) {
    throw new Error(`gen-article-pages: ${article.slug} に相対URLが残っています`);
  }
  if (/spots-ui\.js|data\/(?:spots|articles)\.js|data-gh-/.test(html)) {
    throw new Error(`gen-article-pages: ${article.slug} が不要な動的描画コードを読み込んでいます`);
  }

  const jsonObjects = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
  const types = new Set(jsonObjects.map((object) => object['@type']));
  if (!types.has('Article') || !types.has('BreadcrumbList')) {
    throw new Error(`gen-article-pages: ${article.slug} の基本構造化データが不足しています`);
  }
  if (types.has('ItemList') !== Boolean(stores.length)) {
    throw new Error(`gen-article-pages: ${article.slug} の ItemList と店舗数が一致しません`);
  }
  const hasFaq = Boolean(Array.isArray(article.faq) && article.faq.length);
  if (types.has('FAQPage') !== hasFaq) {
    throw new Error(`gen-article-pages: ${article.slug} の FAQPage とFAQ本文が一致しません`);
  }

  const sourceText = [
    ...(article.intro || []),
    ...(article.tips || []),
    ...(article.sections || []).flatMap((section) => [section.h, ...(section.body || [])]),
    ...(article.faq || []).flatMap((entry) => [entry.q, entry.a]),
    ...stores.map((store) => store.name)
  ];
  for (const text of sourceText) {
    if (!html.includes(esc(text))) {
      throw new Error(`gen-article-pages: ${article.slug} の本文が欠落しています: ${text}`);
    }
  }
}

mkdirSync(outDir, { recursive: true });

const slugs = new Set();
for (const article of articles) {
  if (!article || !/^[a-z0-9-]+$/.test(article.slug || '')) {
    throw new Error(`gen-article-pages: 不正な slug: ${article && article.slug}`);
  }
  if (slugs.has(article.slug)) throw new Error(`gen-article-pages: slug 重複: ${article.slug}`);
  slugs.add(article.slug);
  const stores = resolveStores(article);
  const html = buildPage(article);
  validatePage(article, stores, html);
  writeFileSync(new URL(`${article.slug}.html`, outDir), html, 'utf8');
}

for (const file of readdirSync(outDir)) {
  /* 生成対象と同じ命名規則のファイルだけを整理する。
     手元の比較用コピー（例: "name 2.html"）には触れない。 */
  if (/^[a-z0-9-]+\.html$/.test(file) && !slugs.has(file.slice(0, -5))) {
    unlinkSync(new URL(file, outDir));
  }
}

console.log(`gen-article-pages: ${articles.length}記事を guide/ に生成・検証しました`);
