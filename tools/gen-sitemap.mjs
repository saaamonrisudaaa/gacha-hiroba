/* sitemap.xml 生成スクリプト
   店舗を追加したら `node tools/gen-sitemap.mjs` を実行して sitemap.xml を更新する。
   （data/spots.js の全店舗ページ＋都道府県一覧＋固定ページを出力） */
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGIN = 'https://gacha-hiroba.com';

const win = {};
new Function('window', readFileSync(new URL('../data/spots.js', import.meta.url), 'utf8'))(win);
new Function('window', readFileSync(new URL('../data/articles.js', import.meta.url), 'utf8'))(win);
const spots = win.GH_SPOTS || [];
const articles = win.GH_ARTICLES || [];

const today = new Date().toISOString().slice(0, 10);
const urls = [];
const add = (path, priority, changefreq = 'weekly') =>
  urls.push({ loc: ORIGIN + path, priority, changefreq });

/* 固定ページ */
add('/', '1.0', 'daily');
add('/stores.html', '0.9', 'daily');
add('/ranking.html', '0.8', 'daily');
add('/board.html', '0.8', 'daily');
add('/area.html', '0.7');
add('/map.html', '0.6');
add('/news.html', '0.5');
add('/category.html', '0.5');
add('/terms.html', '0.2', 'monthly');
add('/privacy.html', '0.2', 'monthly');
add('/advertising.html', '0.2', 'monthly');
add('/sitemap.html', '0.4');

/* 都道府県別一覧 */
const prefs = [...new Set(spots.map(s => s.pref))];
prefs.forEach(p => add('/stores.html?pref=' + encodeURIComponent(p), '0.7'));

/* ブランド別一覧（2店舗以上のブランドのみ） */
const brandCount = {};
spots.forEach(s => { brandCount[s.brand] = (brandCount[s.brand] || 0) + 1; });
Object.keys(brandCount).filter(b => brandCount[b] >= 2)
  .forEach(b => add('/stores.html?brand=' + encodeURIComponent(b), '0.7'));

/* エリアまとめ記事 */
articles.forEach(a => add('/article.html?area=' + encodeURIComponent(a.slug), '0.8'));

/* 店舗ページ（全件） */
spots.forEach(s => add('/spot.html?id=' + encodeURIComponent(s.id), '0.8'));

const esc = s => s.replace(/&/g, '&amp;');
const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u =>
    '  <url><loc>' + esc(u.loc) + '</loc><lastmod>' + today +
    '</lastmod><changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>'
  ).join('\n') +
  '\n</urlset>\n';

writeFileSync(new URL('../sitemap.xml', import.meta.url), xml);
console.log('sitemap.xml written:', urls.length, 'URLs (' + spots.length + ' stores, ' + articles.length + ' articles)');

/* ── RSS フィード（feed.xml）: 記事を更新日の新しい順に配信 ── */
const escXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const items = articles.slice()
  .sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))
  .map(a => {
    const link = ORIGIN + '/article.html?area=' + encodeURIComponent(a.slug);
    return '  <item>\n' +
      '    <title>' + escXml(a.title) + '</title>\n' +
      '    <link>' + escXml(link) + '</link>\n' +
      '    <guid isPermaLink="true">' + escXml(link) + '</guid>\n' +
      '    <pubDate>' + new Date((a.updated || today) + 'T09:00:00+09:00').toUTCString() + '</pubDate>\n' +
      '    <description>' + escXml((a.intro && a.intro[0]) || a.title) + '</description>\n' +
      '  </item>';
  }).join('\n');
const rss = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<rss version="2.0">\n<channel>\n' +
  '  <title>ガチャひろば｜新着・特集記事</title>\n' +
  '  <link>' + ORIGIN + '/</link>\n' +
  '  <description>全国のガチャガチャ設置場所・専門店情報。エリア別まとめ・ランキング・ガイド記事の更新情報を配信します。</description>\n' +
  '  <language>ja</language>\n' +
  '  <lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>\n' +
  items + '\n</channel>\n</rss>\n';
writeFileSync(new URL('../feed.xml', import.meta.url), rss);
console.log('feed.xml written:', articles.length, 'items');

/* ── HTML サイトマップ（sitemap.html）: JS なしでも辿れる全ページへの静的リンク集。
      クローラーのクロール経路確保＋内部リンク強化のために生成する。 ── */
const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const prefOrder = [...new Set(spots.map(s => s.pref))];
const byPref = p => spots.filter(s => s.pref === p);
const spotLink = s =>
  '        <li><a href="spot.html?id=' + encodeURIComponent(s.id) + '">' + escH(s.name) + '</a>' +
  '<small>（' + escH(s.area) + '）</small></li>';
const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="ガチャひろばの全ページ一覧。掲載中の全ガチャガチャ店舗（${spots.length}店舗）とエリア別まとめ・ランキング・ガイド記事（${articles.length}本）へのリンク集です。" />
  <title>サイトマップ｜全${spots.length}店舗・全記事一覧 | ガチャひろば</title>
  <link rel="canonical" href="${ORIGIN}/sitemap.html" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="gh-header">
    <div class="gh-header__top">
      <div class="gh-container gh-header__inner">
        <a class="gh-logo" href="index.html" aria-label="ガチャひろば トップへ">
          <span class="gh-logo__icon">G</span>
          <span class="gh-logo__text">ガチャ<em>ひろば</em></span>
        </a>
      </div>
    </div>
  </header>
  <main class="gh-main">
    <div class="gh-container">
      <div class="gh-page-hero">
        <h1 class="gh-page-hero__title">サイトマップ</h1>
        <p class="gh-page-hero__desc">掲載中の全${spots.length}店舗と全${articles.length}記事へのリンク一覧です。</p>
      </div>
      <section class="gh-section">
        <h2 class="gh-section__title">主要ページ</h2>
        <ul>
          <li><a href="index.html">トップ</a></li>
          <li><a href="stores.html">店舗一覧</a></li>
          <li><a href="map.html">マップ検索</a></li>
          <li><a href="ranking.html">ランキング</a></li>
          <li><a href="board.html">掲示板</a></li>
          <li><a href="news.html">新着情報・特集記事</a></li>
        </ul>
      </section>
      <section class="gh-section">
        <h2 class="gh-section__title">特集記事・ランキング・ガイド</h2>
        <ul>
${articles.map(a => '          <li><a href="article.html?area=' + encodeURIComponent(a.slug) + '">' + escH(a.title) + '</a></li>').join('\n')}
        </ul>
      </section>
${prefOrder.map(p => `      <section class="gh-section">
        <h2 class="gh-section__title">${escH(p)}の店舗（${byPref(p).length}件）</h2>
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
console.log('sitemap.html written:', spots.length, 'stores,', articles.length, 'articles');
