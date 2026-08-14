/* sitemap.xml / RSS / HTMLサイトマップ生成。
   canonical の静的URLだけを出し、lastmod は確認できる実更新日だけを使う。 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { PREF_SLUG, BRAND_SLUG, prefPath, brandPath, guidePath } from './seo-routes.mjs';

const ORIGIN = 'https://gacha-hiroba.com';

const win = {};
new Function('window', readFileSync(new URL('../data/spots.js', import.meta.url), 'utf8'))(win);
new Function('window', readFileSync(new URL('../data/articles.js', import.meta.url), 'utf8'))(win);
const spots = win.GH_SPOTS || [];
const articles = win.GH_ARTICLES || [];

const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const STATIC_ROUTES_LAUNCHED = '2026-08-12';
const urls = [];
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const isVerified = (store) => Boolean(store && store.sourceUrl && store.verifiedAt);
const latest = (values, floor = '') => [floor, ...values].filter(isDate).sort().at(-1) || '';
const latestSpot = (items) => latest(items.map((s) => s.verifiedAt));
const articleModified = (article) => isDate(article.updated) ? article.updated : '';
const verifiedSpots = spots.filter(isVerified);
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
add('/area.html', spotsModified);
add('/news.html', latest([spotsModified, articlesModified, releasesModified]));
add('/category.html', spotsModified);
add('/terms.html');
add('/privacy.html');
add('/advertising.html');
add('/contact.html');
add('/about.html', '2026-08-13');
add('/methodology.html', '2026-08-14');

/* 都道府県別一覧 */
const prefs = [...new Set(spots.map(s => s.pref))]
  .filter((p) => PREF_SLUG[p])
  .filter((p) => verifiedSpots.filter((s) => s.pref === p).length >= 5);
prefs.forEach((p) => add(prefPath(p), latest(verifiedSpots.filter((s) => s.pref === p).map((s) => s.verifiedAt), STATIC_ROUTES_LAUNCHED)));

/* ブランド別一覧（2店舗以上のブランドのみ） */
const brandCount = {};
verifiedSpots.forEach(s => { brandCount[s.brand] = (brandCount[s.brand] || 0) + 1; });
Object.keys(brandCount).filter(b => brandCount[b] >= 5)
  .filter((b) => BRAND_SLUG[b])
  .forEach((b) => add(brandPath(b), latest(verifiedSpots.filter((s) => s.brand === b).map((s) => s.verifiedAt), STATIC_ROUTES_LAUNCHED)));

/* エリアまとめ記事 */
indexableArticles.forEach((a) => add(guidePath(a.slug), articleModified(a)));

/* 店舗ページ（全件・静的生成された /spot/<id>.html を正とする） */
verifiedSpots.forEach((s) => add('/spot/' + encodeURIComponent(s.id) + '.html', s.verifiedAt));

const esc = s => s.replace(/&/g, '&amp;');
const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => '  <url><loc>' + esc(u.loc) + '</loc>' +
    (u.lastmod ? '<lastmod>' + u.lastmod + '</lastmod>' : '') + '</url>').join('\n') +
  '\n</urlset>\n';

writeFileSync(new URL('../sitemap.xml', import.meta.url), xml);
console.log('sitemap.xml written:', urls.length, 'indexable URLs (' + verifiedSpots.length + ' verified stores, ' + indexableArticles.length + ' guides)');

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
  '  <description>全国のガチャガチャ設置場所・専門店情報。エリア別まとめ・ランキング・ガイド記事の更新情報を配信します。</description>\n' +
  '  <language>ja</language>\n' +
  '  <lastBuildDate>' + new Date((articlesModified || today) + 'T09:00:00+09:00').toUTCString() + '</lastBuildDate>\n' +
  items + '\n</channel>\n</rss>\n';
writeFileSync(new URL('../feed.xml', import.meta.url), rss);
console.log('feed.xml written:', indexableArticles.length, 'items');

/* ── HTML サイトマップ（sitemap.html）: JS なしでも辿れる全ページへの静的リンク集。
      クローラーのクロール経路確保＋内部リンク強化のために生成する。 ── */
const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const prefOrder = prefs;
const byPref = p => verifiedSpots.filter(s => s.pref === p);
const spotLink = s =>
  '        <li><a href="/spot/' + encodeURIComponent(s.id) + '.html">' + escH(s.name) + '</a>' +
  '<small>（' + escH(s.area) + '）</small></li>';
const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="google-site-verification" content="YN5Q0DnCsIhwgitcXjcGqxlmfMec80Wl0uZskCNS11w" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,follow" />
  <meta name="description" content="ガチャひろばの検索対象ページ一覧。一次情報を確認したガチャガチャ店舗（${verifiedSpots.length}店舗）と独自ガイド記事（${indexableArticles.length}本）へのリンク集です。" />
  <title>サイトマップ｜確認済み${verifiedSpots.length}店舗・ガイド一覧 | ガチャひろば</title>
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
        <p class="gh-page-hero__desc">一次情報を確認した${verifiedSpots.length}店舗と、独自ガイド${indexableArticles.length}記事へのリンク一覧です。</p>
      </div>
      <section class="gh-section">
        <h2 class="gh-section__title">主要ページ</h2>
        <ul>
          <li><a href="index.html">トップ</a></li>
          <li><a href="news.html">新着情報・特集記事</a></li>
          <li><a href="about.html">運営情報・編集方針</a></li>
          <li><a href="methodology.html">データ確認方法</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="terms.html">利用規約</a></li>
          <li><a href="advertising.html">広告・PRの掲載方針</a></li>
        </ul>
      </section>
      <section class="gh-section">
        <h2 class="gh-section__title">独自ガイド</h2>
        <ul>
${indexableArticles.map(a => '          <li><a href="' + guidePath(a.slug) + '">' + escH(a.title) + '</a></li>').join('\n')}
        </ul>
      </section>
      <section class="gh-section">
        <h2 class="gh-section__title">ブランド別・確認済み店舗一覧</h2>
        <ul>
${Object.keys(brandCount).filter((b) => brandCount[b] >= 5 && BRAND_SLUG[b]).sort((a, b) => brandCount[b] - brandCount[a]).map((b) => '          <li><a href="' + brandPath(b) + '">' + escH(b) + '（確認済み' + brandCount[b] + '店舗）</a></li>').join('\n')}
        </ul>
      </section>
${prefOrder.map(p => `      <section class="gh-section">
        <h2 class="gh-section__title"><a href="${prefPath(p)}">${escH(p)}のガチャガチャ設置場所（${byPref(p).length}件）</a></h2>
        <ul>
${byPref(p).map(spotLink).join('\n')}
        </ul>
      </section>`).join('\n')}
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
console.log('sitemap.html written:', verifiedSpots.length, 'verified stores,', indexableArticles.length, 'guides');
