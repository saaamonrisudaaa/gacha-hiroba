/* sitemap.xml 生成スクリプト
   店舗を追加したら `node tools/gen-sitemap.mjs` を実行して sitemap.xml を更新する。
   （data/spots.js の全店舗ページ＋都道府県一覧＋固定ページを出力） */
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGIN = 'https://gacha-hiroba.com';

const win = {};
new Function('window', readFileSync(new URL('../data/spots.js', import.meta.url), 'utf8'))(win);
const spots = win.GH_SPOTS || [];

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
console.log('sitemap.xml written:', urls.length, 'URLs (' + spots.length + ' stores)');
