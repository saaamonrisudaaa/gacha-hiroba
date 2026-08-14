/* 公開前のSEO整合性チェック。
   静的入口の title / canonical / H1 / JSON-LD、内部リンク、sitemapを検証する。 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { PREF_SLUG, BRAND_SLUG } from './seo-routes.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const ORIGIN = 'https://gacha-hiroba.com';
const errors = [];
const fail = (message) => errors.push(message);
const hasNoindex = (html) => /<meta[^>]+name="robots"[^>]+content="[^"]*\bnoindex\b/i.test(html);
const isVerified = (store) => Boolean(store && store.sourceUrl && store.verifiedAt);

const win = {};
new Function('window', readFileSync(join(root, 'data/spots.js'), 'utf8'))(win);
new Function('window', readFileSync(join(root, 'data/articles.js'), 'utf8'))(win);
const spots = win.GH_SPOTS || [];
const articles = win.GH_ARTICLES || [];
const spotById = new Map(spots.map((store) => [String(store.id), store]));
const articleBySlug = new Map(articles.map((article) => [String(article.slug), article]));
const prefBySlug = new Map(Object.entries(PREF_SLUG).map(([pref, slug]) => [slug, pref]));
const brandBySlug = new Map(Object.entries(BRAND_SLUG).map(([brand, slug]) => [slug, brand]));
const verifiedCountFor = (field, value) => spots.filter((store) => store[field] === value && isVerified(store)).length;

/* 審査・信頼性に直結する固定ページと広告除外ページ。 */
const requiredTrustPages = ['about.html', 'methodology.html', 'contact.html', 'privacy.html', 'terms.html', 'advertising.html'];
requiredTrustPages.forEach((name) => {
  if (!existsSync(join(root, name))) fail(name + ': 信頼性ページがありません');
});
const adsTxt = readFileSync(join(root, 'ads.txt'), 'utf8').trim();
if (adsTxt !== 'google.com, pub-5458972550684006, DIRECT, f08c47fec0942fa0') {
  fail('ads.txt: AdSenseの販売者情報が想定値と一致しません');
}
const robotsTxt = readFileSync(join(root, 'robots.txt'), 'utf8');
if (/Disallow:\s*\//i.test(robotsTxt)) fail('robots.txt: サイト全体がクロール拒否されています');

function filesIn(dir, suffix = '.html') {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((name) => name.endsWith(suffix) && !/ \d+\.html$/i.test(name))
    .sort().map((name) => join(abs, name));
}

const generated = [
  ...filesIn('spot'), ...filesIn('area'), ...filesIn('brand'),
  ...filesIn('guide'), ...filesIn('releases')
];
const titles = new Map();
const canonicals = new Set();
const indexableCanonicals = new Set();

function expectedIndexable(rel) {
  const match = rel.match(/^\/(spot|area|brand|guide|releases)\/([^/]+)\.html$/);
  if (!match) return false;
  const [, type, rawSlug] = match;
  const slug = decodeURIComponent(rawSlug);
  if (type === 'spot') return isVerified(spotById.get(slug));
  if (type === 'area') {
    const pref = prefBySlug.get(slug);
    return Boolean(pref && verifiedCountFor('pref', pref) >= 5);
  }
  if (type === 'brand') {
    const brand = brandBySlug.get(slug);
    return Boolean(brand && verifiedCountFor('brand', brand) >= 5);
  }
  if (type === 'guide') return articleBySlug.get(slug)?.type === 'guide';
  return false; // releases は再審査中 noindex
}

for (const file of generated) {
  const rel = '/' + relative(root, file).split('\\').join('/');
  const html = readFileSync(file, 'utf8');
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  const h1s = (html.match(/<h1\b/gi) || []).length;
  if (!title) fail(rel + ': title がありません');
  else if (titles.has(title)) fail(rel + ': title が ' + titles.get(title) + ' と重複しています');
  else titles.set(title, rel);
  if (canonical !== ORIGIN + rel) fail(rel + ': canonical が不一致です (' + (canonical || 'なし') + ')');
  else canonicals.add(canonical);
  if (h1s !== 1) fail(rel + ': H1 が ' + h1s + '個です');
  const shouldIndex = expectedIndexable(rel);
  if (hasNoindex(html) === shouldIndex) {
    fail(rel + ': 一次情報・ページ種別に対するrobots指定が不一致です');
  }
  if (shouldIndex && canonical) indexableCanonicals.add(canonical);

  if (rel.startsWith('/spot/')) {
    const id = decodeURIComponent(rel.slice('/spot/'.length, -'.html'.length));
    const store = spotById.get(id);
    if (!store) fail(rel + ': 店舗データに対応するIDがありません');
    else if (isVerified(store)) {
      if (!html.includes('一次情報確認済み') || !html.includes(store.sourceUrl) || !html.includes(store.verifiedAt)) {
        fail(rel + ': 確認済み店舗の確認元・確認日表示が不足しています');
      }
    } else if (!html.includes('一次情報未確認・検索対象外')) {
      fail(rel + ': 未確認店舗の検索対象外表示がありません');
    }
  }
  if (rel.startsWith('/guide/')) {
    const slug = decodeURIComponent(rel.slice('/guide/'.length, -'.html'.length));
    const article = articleBySlug.get(slug);
    const modified = html.match(/<meta property="article:modified_time" content="([^"]+)"/i)?.[1];
    if (!article) fail(rel + ': 記事データに対応するslugがありません');
    else if (modified !== article.updated) fail(rel + ': 記事更新日が article.updated と一致しません');
    if (article?.ranking) {
      for (const store of spots.filter((item) => item.machines != null && !isVerified(item))) {
        if (html.includes('/spot/' + encodeURIComponent(store.id) + '.html')) {
          fail(rel + ': ランキングに一次情報未確認店舗が含まれています (' + store.id + ')');
        }
      }
    }
  }
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) fail(rel + ': JSON-LD がありません');
  scripts.forEach((match, index) => {
    try { JSON.parse(match[1]); }
    catch (error) { fail(rel + ': JSON-LD #' + (index + 1) + ' が不正です (' + error.message + ')'); }
  });
}

/* 公開HTML全体のローカルリンク切れを確認する。 */
const htmlFiles = readdirSync(root).filter((name) => name.endsWith('.html')).map((name) => join(root, name)).concat(generated);
const forbiddenAdMarkup = [
  [/pagead2\.googlesyndication\.com|\badsbygoogle\b/i, 'AdSenseコード'],
  [/(?:^|["'/])data\/ads\.js/i, 'data/ads.js'],
  [/(?:hb|hbb)\.afl\.rakuten\.co\.jp|static\.affiliate\.rakuten\.co\.jp/i, '楽天アフィリエイトリンク'],
  [/data-gh-(?:commerce|featured|gacha-goods)\b/i, 'アフィリエイト配置'],
  [/class="[^"]*\b(?:gh-affil(?:__|--|\s|")|gh-(?:commerce-sec|goods-sec|featured-sec)\b)/i, 'アフィリエイト配置'],
  [/class="[^"]*\bgh-ad(?:__|--|\s|")/i, '広告プレースホルダー']
];
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const rel = '/' + relative(root, file).split('\\').join('/');
  for (const [pattern, label] of forbiddenAdMarkup) {
    if (pattern.test(html)) fail(rel + ': 再審査中のHTMLに' + label + 'が残っています');
  }
  if (/data\/board-seed\.js/i.test(html)) fail('/' + relative(root, file) + ': 架空投稿のseedを読み込んでいます');
  if (/stores\.html\?brand=/i.test(html)) fail('/' + relative(root, file) + ': 重複インデックス対象のbrand queryリンクがあります');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gi)) {
    const href = match[1];
    if (!href || /^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(href)) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    let target = clean.startsWith('/') ? resolve(root, '.' + clean) : resolve(dirname(file), clean);
    if (clean === '/' || target.endsWith('/')) target = join(target, 'index.html');
    if (!existsSync(target)) fail('/' + relative(root, file) + ': リンク先がありません ' + href);
  }
}

for (const name of ['board.html', 'map.html', 'ranking.html', 'stores.html', 'sitemap.html', 'english.html']) {
  const file = join(root, name);
  if (!existsSync(file) || !hasNoindex(readFileSync(file, 'utf8'))) {
    fail(name + ': 再審査中の検索対象外指定がありません');
  }
}
if (existsSync(join(root, 'methodology.html')) && hasNoindex(readFileSync(join(root, 'methodology.html'), 'utf8'))) {
  fail('methodology.html: データ確認方法ページをindexableにしてください');
}
const methodologyHtml = existsSync(join(root, 'methodology.html'))
  ? readFileSync(join(root, 'methodology.html'), 'utf8')
  : '';
const verifiedStores = spots.filter(isVerified);
const pendingStores = spots.length - verifiedStores.length;
for (const expected of [
  '<tr><td>一次情報確認済み</td><td>' + verifiedStores.length + '件</td>',
  '<tr><td>情報確認中</td><td>' + pendingStores + '件</td>',
  '<tr><td>合計</td><td>' + spots.length + '件</td>'
]) {
  if (!methodologyHtml.includes(expected)) fail('methodology.html: 公開件数と店舗データが一致しません (' + expected + ')');
}

/* XML sitemap: query URL・重複・未来日・存在しないページを拒否。 */
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
if (new Set(locs).size !== locs.length) fail('sitemap.xml: URLが重複しています');
for (const loc of locs) {
  if (!loc.startsWith(ORIGIN + '/')) { fail('sitemap.xml: ドメイン外URL ' + loc); continue; }
  if (loc.includes('?')) fail('sitemap.xml: query URLが残っています ' + loc);
  const path = new URL(loc).pathname;
  const file = path === '/' ? join(root, 'index.html') : join(root, path);
  if (!existsSync(file) || statSync(file).isDirectory()) fail('sitemap.xml: ファイルがありません ' + path);
  else if (file.endsWith('.html') && hasNoindex(readFileSync(file, 'utf8'))) {
    fail('sitemap.xml: noindexページが含まれています ' + path);
  }
}
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
for (const match of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(match[1]) || match[1] > today) fail('sitemap.xml: 不正なlastmod ' + match[1]);
}
for (const canonical of canonicals) {
  if (indexableCanonicals.has(canonical) && !locs.includes(canonical)) {
    fail('sitemap.xml: indexableな正規ページが未掲載 ' + canonical);
  }
  if (!indexableCanonicals.has(canonical) && locs.includes(canonical)) {
    fail('sitemap.xml: 検索対象外の正規ページが掲載されています ' + canonical);
  }
}
for (const path of ['/', '/area.html', '/news.html', '/category.html', '/terms.html', '/privacy.html',
  '/advertising.html', '/contact.html', '/about.html', '/methodology.html']) {
  if (!locs.includes(ORIGIN + path)) fail('sitemap.xml: indexableな固定ページが未掲載 ' + path);
}
for (const path of ['/board.html', '/map.html', '/ranking.html', '/stores.html', '/sitemap.html', '/english.html']) {
  if (locs.includes(ORIGIN + path)) fail('sitemap.xml: 検索対象外の固定ページが掲載されています ' + path);
}
for (const store of spots) {
  const canonical = ORIGIN + '/spot/' + encodeURIComponent(store.id) + '.html';
  if (isVerified(store) !== locs.includes(canonical)) {
    fail('sitemap.xml: 店舗の確認状況と掲載可否が不一致 ' + store.id);
  }
}

const sampleText = htmlFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
for (const required of ['about.html', 'ガチャひろばの情報づくり', 'google-adsense-account']) {
  if (!indexHtml.includes(required)) fail('index.html: 信頼性情報が不足しています (' + required + ')');
}
const privacyHtml = readFileSync(join(root, 'privacy.html'), 'utf8');
for (const required of ['policies.google.com/technologies/partner-sites', 'Google Analytics 4', '楽天アフィリエイト', 'Supabase', 'data-gh-no-tracking']) {
  if (!privacyHtml.includes(required)) fail('privacy.html: 実装に対応する開示が不足しています (' + required + ')');
}
for (const forbidden of ['8,241スポット', 'ヨドバシAkiba ガチャコーナー', 'アキバガチャ横丁', '梅田LOFT ガチャコーナー', '掲示板 3,241件', '月間訪問 24,580']) {
  if (sampleText.includes(forbidden)) fail('試作表示が残っています: ' + forbidden);
}
if (existsSync(join(root, 'data/board-seed.js'))) fail('data/board-seed.js: 架空投稿データが公開対象に残っています');
const legacyLocation = readFileSync(join(root, 'location.html'), 'utf8');
if (!/http-equiv="refresh"[^>]+\/area\/tokyo\.html/i.test(legacyLocation) ||
    !/name="robots" content="noindex,follow"/i.test(legacyLocation)) {
  fail('location.html: 旧サンプルページが安全な移転ページになっていません');
}

if (errors.length) {
  console.error('validate-seo: NG / ' + errors.length + '件');
  errors.slice(0, 100).forEach((error) => console.error(' - ' + error));
  process.exit(1);
}
console.log('validate-seo: OK / 静的入口 ' + generated.length + 'ページ / sitemap ' + locs.length + 'URL / 内部リンク切れ 0');
