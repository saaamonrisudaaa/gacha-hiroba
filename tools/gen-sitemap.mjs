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
