/* sitemap.xml / RSS / HTMLサイトマップ生成。
   canonical の静的URLだけを出し、lastmod は確認できる実更新日だけを使う。 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { guidePath } from './seo-routes.mjs';

const ORIGIN = 'https://gacha-hiroba.com';

const win = {};
new Function('window', readFileSync(new URL('../data/spots.js', import.meta.url), 'utf8'))(win);
new Function('window', readFileSync(new URL('../data/articles.js', import.meta.url), 'utf8'))(win);
const spots = win.GH_SPOTS || [];
const articles = win.GH_ARTICLES || [];

const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const urls = [];
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const isVerified = (store) => Boolean(store && store.sourceUrl && store.verifiedAt);
const latest = (values, floor = '') => [floor, ...values].filter(isDate).sort().at(-1) || '';
const latestSpot = (items) => latest(items.map((s) => s.verifiedAt));
const verifiedSpots = spots.filter(isVerified);
const articleModified = (article) => article.report === 'store-data-audit'
  ? latest([article.updated, latestSpot(verifiedSpots)])
  : (isDate(article.updated) ? article.updated : '');
const indexableArticles = articles.filter((article) => article.type === 'guide');
const spotsModified = latestSpot(verifiedSpots);
const articlesModified = latest(indexableArticles.map(articleModified));
const add = (path, lastmod = '') => urls.push({ loc: ORIGIN + path, lastmod: isDate(lastmod) ? lastmod : '' });

/* 月別発売情報は、生成済みHTMLの dateModified を読む。 */
const releasesDir = new URL('../releases/', import.meta.url);
let releasePages = [];
try {
  releasePages = readdirSync(releasesDir).filter((f) => /^\d{4}-\d{2}\.html$/.test(f)).sort().map((file) => {
    const html = readFileSync(new URL(file, releasesDir), 'utf8');
    const match = html.match(/"dateModified":"(\d{4}-\d{2}-\d{2})"/);
    return { path: '/releases/' + file, modified: match ? match[1] : '' };
  });
} catch { /* 発売情報ページがまだ無い環境でも生成を続ける */ }
const releasesModified = latest(releasePages.map((p) => p.modified));

/* 固定ページ */
add('/', latest([spotsModified, articlesModified, releasesModified]));
add('/news.html', latest([spotsModified, articlesModified, releasesModified]));
add('/terms.html');
add('/privacy.html');
add('/advertising.html');
add('/contact.html');
add('/about.html', '2026-08-14');
add('/methodology.html', '2026-08-14');

/* 運営者が構成・確認した独自ガイドだけを検索対象にする。 */
indexableArticles.forEach((a) => add(guidePath(a.slug), articleModified(a)));

const esc = s => s.replace(/&/g, '&amp;');
const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => '  <url><loc>' + esc(u.loc) + '</loc>' +
    (u.lastmod ? '<lastmod>' + u.lastmod + '</lastmod>' : '') + '</url>').join('\n') +
  '\n</urlset>\n';

writeFileSync(new URL('../sitemap.xml', import.meta.url), xml);
console.log('sitemap.xml written:', urls.length, 'indexable URLs (' + indexableArticles.length + ' original guides)');

/* ── RSS フィード（feed.xml）: 記事を更新日の新しい順に配信 ── */
const escXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const items = indexableArticles.slice()
  .sort((a, b) => articleModified(b).localeCompare(articleModified(a)))
  .map(a => {
    const link = ORIGIN + guidePath(a.slug);
    return '  <item>\n' +
      '    <title>' + escXml(a.title) + '</title>\n' +
      '    <link>' + escXml(link) + '</link>\n' +
      '    <guid isPermaLink="true">' + escXml(link) + '</guid>\n' +
      '    <pubDate>' + new Date((articleModified(a) || today) + 'T09:00:00+09:00').toUTCString() + '</pubDate>\n' +
      '    <description>' + escXml((a.intro && a.intro[0]) || a.title) + '</description>\n' +
      '  </item>';
  }).join('\n');
const rss = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<rss version="2.0">\n<channel>\n' +
  '  <title>ガチャひろば｜新着・特集記事</title>\n' +
  '  <link>' + ORIGIN + '/</link>\n' +
  '  <description>ガチャひろば運営者が作成した実用ガイドと店舗データ監査レポートの更新情報を配信します。</description>\n' +
  '  <language>ja</language>\n' +
  '  <lastBuildDate>' + new Date((articlesModified || today) + 'T09:00:00+09:00').toUTCString() + '</lastBuildDate>\n' +
  items + '\n</channel>\n</rss>\n';
writeFileSync(new URL('../feed.xml', import.meta.url), rss);
console.log('feed.xml written:', indexableArticles.length, 'items');

/* ── HTMLサイトマップ: 独自ガイド・運営情報と、利用者向け検索機能への入口。
      テンプレート店舗ページを大量に列挙せず、サイトの主要目的が分かる量に絞る。 ── */
const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="google-site-verification" content="YN5Q0DnCsIhwgitcXjcGqxlmfMec80Wl0uZskCNS11w" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,follow" />
  <meta name="description" content="ガチャひろばの独自ガイド、店舗検索機能、運営情報への案内です。" />
  <title>サイトマップ｜ガイド・検索機能・運営情報 | ガチャひろば</title>
  <link rel="canonical" href="${ORIGIN}/sitemap.html" />
  <link rel="icon" type="image/png" href="assets/mascot-icon.png" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="gh-header">
    <div class="gh-header__top">
      <div class="gh-container gh-header__inner">
        <a class="gh-logo" href="index.html" aria-label="ガチャひろば トップへ">
          <img class="gh-logo__icon" src="assets/mascot-icon.png" alt="ガチャひろばのマスコット" width="34" height="34" />
          <span class="gh-logo__text">ガチャ<em>ひろば</em></span>
        </a>
      </div>
    </div>
  </header>
  <main class="gh-main">
    <div class="gh-container">
      <div class="gh-page-hero">
        <h1 class="gh-page-hero__title">サイトマップ</h1>
        <p class="gh-page-hero__desc">運営者が作成・確認した独自ガイド${indexableArticles.length}本と、店舗検索機能、運営情報への案内です。</p>
      </div>
      <section class="gh-section">
        <h2 class="gh-section__title">店舗を探す機能</h2>
        <ul>
          <li><a href="index.html">トップ</a></li>
          <li><a href="stores.html">店舗一覧・キーワード検索</a></li>
          <li><a href="map.html">地図・現在地から探す</a></li>
          <li><a href="ranking.html">公表設置台数から探す</a></li>
          <li><a href="board.html">店舗別掲示板</a></li>
        </ul>
      </section>
      <section class="gh-section">
        <h2 class="gh-section__title">調査・実用ガイド</h2>
        <ul>
${indexableArticles.map(a => '          <li><a href="' + guidePath(a.slug) + '">' + escH(a.title) + '</a></li>').join('\n')}
        </ul>
      </section>
      <section class="gh-section">
        <h2 class="gh-section__title">運営・ポリシー</h2>
        <ul>
          <li><a href="news.html">ガイド・更新情報</a></li>
          <li><a href="about.html">運営情報・編集方針</a></li>
          <li><a href="methodology.html">データ作成・確認方法</a></li>
          <li><a href="contact.html">お問い合わせ・訂正連絡</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="terms.html">利用規約</a></li>
          <li><a href="advertising.html">広告・PRの掲載方針</a></li>
        </ul>
      </section>
    </div>
  </main>
  <footer class="gh-footer">
    <div class="gh-container">
      <div class="gh-footer__bottom">
        <span>© 2026 ガチャひろば (gacha-hiroba.com)</span>
        <span><a href="index.html">トップへ戻る</a></span>
      </div>
    </div>
  </footer>
</body>
</html>
`;
writeFileSync(new URL('../sitemap.html', import.meta.url), html);
console.log('sitemap.html written:', indexableArticles.length, 'original guides and service links');
