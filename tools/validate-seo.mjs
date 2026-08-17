/* 公開前のSEO整合性チェック。
   静的入口の title / canonical / H1 / JSON-LD、内部リンク、sitemapを検証する。 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { MIN_INDEXABLE_RELEASES, isIndexableReleaseCount } from './release-policy.mjs';

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
const articleBySlug = new Map(articles.map((article) => [String(article.slug), article]));
const verifiedStores = spots.filter(isVerified);
const pendingStores = spots.length - verifiedStores.length;
if (MIN_INDEXABLE_RELEASES !== 8) fail('release-policy.mjs: 月別新作ページのindex最低件数は8件にしてください');

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
if (existsSync(join(root, 'data/ads.js'))) fail('data/ads.js: 再審査中のアフィリエイト配信データが残っています');

/* 使われていない広告コードも公開アセットへ戻さない。 */
for (const name of ['script.js', 'styles.css']) {
  const source = readFileSync(join(root, name), 'utf8');
  if (/\bGH_ADS\b|(?:hb|hbb)\.afl\.rakuten\.co\.jp|\bgh-(?:affil|commerce|goods|bottombar|promo)(?:__|--|\b)|data-ad-track/i.test(source)) {
    fail(name + ': 再審査中の広告・アフィリエイト実装が残っています');
  }
}

const spotsUiSource = readFileSync(join(root, 'spots-ui.js'), 'utf8');
if (/href\s*=\s*spotUrl\s*\(/.test(spotsUiSource)) {
  fail('spots-ui.js: spotUrl() がHTML文字列へ正しく連結されていません');
}
if (!/ALL_SPOTS\.filter\(isVerified\)/.test(spotsUiSource)) {
  fail('spots-ui.js: 確認待ち店舗が公開一覧・詳細へ混入する可能性があります');
}
if (!/if\s*\(query\s*\|\|\s*brand\s*\|\|\s*pref\)\s*markNoindex\(\)/.test(spotsUiSource)) {
  fail('spots-ui.js: 店舗の検索・都道府県・ブランド絞り込みがnoindexになっていません');
}
if (/\b(?:bUrl|pUrl)\s*=/.test(spotsUiSource)) {
  fail('spots-ui.js: 絞り込みURLをcanonicalへ変更する処理が残っています');
}
const mainScriptSource = readFileSync(join(root, 'script.js'), 'utf8');
if (!/return\s+isVerified\(s\)\s*&&\s*s\.lat\s*!=\s*null\s*&&\s*s\.lon\s*!=\s*null/.test(mainScriptSource)) {
  fail('script.js: 確認待ち店舗が公開マップへ混入する可能性があります');
}
for (const [pattern, message] of [
  [/gh-analytics-owner-excluded-v1/, '運営者アクセス除外フラグがありません'],
  [/ga-disable-['"]?\s*\+\s*GA_ID/, 'GA4の送信停止フラグがありません'],
  [/location\.protocol\s*===\s*'https:'\s*&&\s*location\.hostname\s*===\s*'gacha-hiroba\.com'/, '非本番ホストの計測遮断がありません'],
  [/function\s+loadAnalytics\(\)\s*{\s*if\s*\(!GHAnalyticsControl\.prepare\(\)/, 'GA4読込前の除外判定がありません'],
  [/function\s+ghTrack\([\s\S]{0,180}GHAnalyticsControl\.shouldBlock\(\)/, 'イベント送信時の除外判定がありません'],
  [/function\s+ghTrack\([\s\S]{0,220}GHAnalyticsControl\.isRuntimeDisabled\(\)/, '同意撤回後のイベント停止判定がありません'],
  [/remember\('rejected'\);\s*GHAnalyticsControl\.stop\(\)/, '同意撤回時の即時停止がありません'],
  [/event\.key\s*!==\s*CONSENT_KEY[\s\S]{0,180}event\.newValue\s*===\s*'rejected'[\s\S]{0,120}GHAnalyticsControl\.stop\(\)/, '別タブでの同意撤回を即時反映していません'],
  [/searchParams\.has\('id'\)[\s\S]{0,120}store_detail_click/, '現行の店舗詳細URLを計測できません'],
  [/searchParams\.has\('pref'\)[\s\S]{0,160}area_page_click/, '現行の都道府県URLを計測できません'],
  [/searchParams\.has\('brand'\)[\s\S]{0,160}brand_page_click/, '現行のブランドURLを計測できません']
]) {
  if (!pattern.test(mainScriptSource)) fail('script.js: ' + message);
}

const analyticsControlFile = join(root, 'analytics-control.html');
const analyticsControlScriptFile = join(root, 'analytics-control.js');
if (existsSync(analyticsControlFile)) fail('analytics-control.html: 設定完了後の非公開ページが残っています');
if (existsSync(analyticsControlScriptFile)) fail('analytics-control.js: 非公開ページ専用スクリプトが残っています');
if (/href\s*=\s*['"]\/analytics-control\.html/.test(mainScriptSource)) {
  fail('script.js: 削除済みの運営者設定ページへのリンクが残っています');
}
for (const store of verifiedStores) {
  let host = '';
  try { host = new URL(store.sourceUrl).hostname.toLowerCase(); }
  catch { fail('data/spots.js: 掲載根拠URLが不正です (' + store.id + ')'); }
  if (host === 'map.yahoo.co.jp' || host === 'www.openstreetmap.org' || host === 'maps.google.com') {
    fail('data/spots.js: 地図だけを掲載根拠にした店舗があります (' + store.id + ')');
  }
}

function filesIn(dir, suffix = '.html') {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((name) => name.endsWith(suffix) && !/ \d+\.html$/i.test(name))
    .sort().map((name) => join(abs, name));
}

const generated = [
  ...filesIn('guide'), ...filesIn('releases')
];
const titles = new Map();
const canonicals = new Set();
const indexableCanonicals = new Set();
const generatedIndexability = new Map();

function expectedIndexable(rel, html) {
  const match = rel.match(/^\/(guide|releases)\/([^/]+)\.html$/);
  if (!match) return false;
  const [, type, rawSlug] = match;
  const slug = decodeURIComponent(rawSlug);
  if (type === 'guide') return articleBySlug.get(slug)?.type === 'guide';
  if (type !== 'releases') return false;
  const count = Number(html.match(/"numberOfItems":(\d+)/)?.[1] || 0);
  return isIndexableReleaseCount(count);
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
  const shouldIndex = expectedIndexable(rel, html);
  generatedIndexability.set(rel, shouldIndex);
  if (hasNoindex(html) === shouldIndex) {
    fail(rel + ': ページ種別に対するrobots指定が不一致です');
  }
  if (shouldIndex && canonical) indexableCanonicals.add(canonical);
  if (rel.startsWith('/guide/')) {
    const slug = decodeURIComponent(rel.slice('/guide/'.length, -'.html'.length));
    const article = articleBySlug.get(slug);
    const modified = html.match(/<meta property="article:modified_time" content="([^"]+)"/i)?.[1];
    const expectedModified = article?.report === 'store-data-audit'
      ? [article.updated, ...spots.filter(isVerified).map((store) => store.verifiedAt)].filter(Boolean).sort().at(-1)
      : article?.updated;
    if (!article) fail(rel + ': 記事データに対応するslugがありません');
    else if (modified !== expectedModified) fail(rel + ': 記事更新日が元データと一致しません');
  }
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) fail(rel + ': JSON-LD がありません');
  const jsonLd = [];
  scripts.forEach((match, index) => {
    try { jsonLd.push(JSON.parse(match[1])); }
    catch (error) { fail(rel + ': JSON-LD #' + (index + 1) + ' が不正です (' + error.message + ')'); }
  });
  if (rel.startsWith('/releases/')) {
    const itemList = jsonLd.find((data) => data?.['@type'] === 'ItemList');
    const cardCount = (html.match(/<article class="gh-rel" id="release-\d+">/g) || []).length;
    if (!itemList) fail(rel + ': 月別新作のItemList構造化データがありません');
    else {
      if (itemList.numberOfItems !== cardCount) fail(rel + ': ItemListの商品件数と表示カード数が一致しません');
      if (!Array.isArray(itemList.itemListElement) || itemList.itemListElement.length !== cardCount) {
        fail(rel + ': ItemListの商品要素数と表示カード数が一致しません');
      }
    }
    if (shouldIndex) {
      for (const required of ['掲載データの内訳', 'すべての商品を網羅した一覧ではありません', '在庫を保証するページではありません']) {
        if (!html.includes(required)) fail(rel + ': 月別新作ページの独自集計・注意事項が不足しています (' + required + ')');
      }
    }
  }
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
  if (/href="\/(?:spot|area|brand)\/[^"?]+\.html/i.test(html)) {
    fail('/' + relative(root, file) + ': 廃止した量産静的ページへのリンクがあります');
  }
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

for (const name of ['board.html', 'map.html', 'spot.html', 'article.html',
  'area.html', 'category.html', 'sitemap.html', 'english.html', 'location.html']) {
  const file = join(root, name);
  if (!existsSync(file) || !hasNoindex(readFileSync(file, 'utf8'))) {
    fail(name + ': 再審査中の検索対象外指定がありません');
  }
}
for (const name of ['stores.html', 'ranking.html']) {
  const file = join(root, name);
  if (!existsSync(file) || hasNoindex(readFileSync(file, 'utf8'))) {
    fail(name + ': 検索対象ページをindexableにしてください');
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const types = new Set();
  for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      const objects = Array.isArray(data) ? data : [data];
      objects.forEach((object) => { if (object && object['@type']) types.add(object['@type']); });
    } catch (error) {
      fail(name + ': JSON-LD が不正です (' + error.message + ')');
    }
  }
  for (const type of ['CollectionPage', 'ItemList', 'BreadcrumbList']) {
    if (!types.has(type)) fail(name + ': ' + type + ' の構造化データがありません');
  }
}
const storesHtml = readFileSync(join(root, 'stores.html'), 'utf8');
if (!/if\s*\(location\.search\)[\s\S]{0,180}meta\[name=["']robots["']\][\s\S]{0,180}noindex,follow/.test(storesHtml)) {
  fail('stores.html: query付きURLをhead内でnoindexにする処理がありません');
}
if (existsSync(join(root, 'methodology.html')) && hasNoindex(readFileSync(join(root, 'methodology.html'), 'utf8'))) {
  fail('methodology.html: データ確認方法ページをindexableにしてください');
}
const methodologyHtml = existsSync(join(root, 'methodology.html'))
  ? readFileSync(join(root, 'methodology.html'), 'utf8')
  : '';
for (const expected of [
  'id="methodVerifiedTable">' + verifiedStores.length + '</span>件',
  'id="methodPendingTable">' + pendingStores + '</span>件',
  'id="methodTotalTable">' + spots.length + '</span>件'
]) {
  if (!methodologyHtml.includes(expected)) fail('methodology.html: 公開件数と店舗データが一致しません (' + expected + ')');
}
for (const required of ['全国店舗一覧の基本URL', '設置台数ランキング', '自由入力検索、都道府県・ブランド絞り込みは機能画面として検索対象外']) {
  if (!methodologyHtml.includes(required)) fail('methodology.html: 検索掲載方針の説明が不足しています (' + required + ')');
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
const htmlSitemap = readFileSync(join(root, 'sitemap.html'), 'utf8');
for (const [rel, shouldIndex] of generatedIndexability) {
  if (!rel.startsWith('/releases/')) continue;
  const appears = htmlSitemap.includes('href="' + rel + '"');
  if (appears !== shouldIndex) {
    fail('sitemap.html: 月別新作ページの掲載判定がrobotsと一致しません (' + rel + ')');
  }
}
for (const path of ['/', '/news.html', '/terms.html', '/privacy.html',
  '/advertising.html', '/contact.html', '/about.html', '/methodology.html',
  '/stores.html', '/ranking.html']) {
  if (!locs.includes(ORIGIN + path)) fail('sitemap.xml: indexableな固定ページが未掲載 ' + path);
}
for (const path of ['/board.html', '/map.html', '/spot.html',
  '/article.html', '/area.html', '/category.html', '/sitemap.html', '/english.html', '/location.html',
  '/analytics-control.html']) {
  if (locs.includes(ORIGIN + path)) fail('sitemap.xml: 検索対象外の固定ページが掲載されています ' + path);
}

/* 似た店舗・地域ページを公開物へ戻さない。 */
for (const dir of ['spot', 'area', 'brand']) {
  const files = filesIn(dir);
  if (files.length) fail(dir + '/: 量産静的HTMLが ' + files.length + '件残っています');
}

/* 記事データは独自ガイドだけとし、短い旧地域記事の再公開を防ぐ。 */
for (const article of articles) {
  if (article.type !== 'guide') fail('data/articles.js: 非公開の旧記事データが残っています (' + article.slug + ')');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.published || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(article.updated || '') ||
      article.published > article.updated) {
    fail('data/articles.js: 公開日・更新日が不正です (' + article.slug + ')');
  }
  const length = [
    ...(article.intro || []), ...(article.tips || []),
    ...(article.sections || []).flatMap((section) => [section.h, ...(section.body || [])]),
    ...(article.faq || []).flatMap((entry) => [entry.q, entry.a])
  ].join('').length;
  if (length < 1400) fail('data/articles.js: 独自本文が不足しています (' + article.slug + ': ' + length + '文字)');
}
for (const slug of ['store-data-report', 'gacha-budget-planner']) {
  if (!articleBySlug.has(slug)) fail('data/articles.js: 必須の独自コンテンツがありません (' + slug + ')');
}

const indexHtmlForCounts = readFileSync(join(root, 'index.html'), 'utf8');
const englishHtml = readFileSync(join(root, 'english.html'), 'utf8');
const categoryHtml = readFileSync(join(root, 'category.html'), 'utf8');
for (const [name, html, expected] of [
  ['index.html', indexHtmlForCounts, 'id="statStores">' + verifiedStores.length.toLocaleString('ja-JP') + '店舗'],
  ['english.html', englishHtml, 'id="enStatStores">' + verifiedStores.length + '</strong>'],
  ['category.html', categoryHtml, '<span data-total-spots>' + verifiedStores.length + '</span>']
]) {
  if (!html.includes(expected)) fail(name + ': 公開店舗件数が確認済みデータと一致しません (' + expected + ')');
}
if (!/window\.GH_SPOTS[\s\S]{0,240}filter\(function \(spot\)[\s\S]{0,160}spot\.sourceUrl\s*&&\s*spot\.verifiedAt/.test(categoryHtml)) {
  fail('category.html: 確認待ち店舗を動的集計から除外していません');
}
for (const match of categoryHtml.matchAll(/<a([^>]*data-brand="([^"]+)"[^>]*)>[\s\S]*?<span class="gh-cat-card__count" data-brand-count>(\d+)店舗掲載<\/span>[\s\S]*?<\/a>/g)) {
  const count = Number(match[3]);
  if (count === 0 && !/\shidden(?:="")?(?=\s|$)/.test(match[1])) {
    fail('category.html: 0件ブランドが表示対象です (' + match[2] + ')');
  }
  if (count > 0 && /\shidden(?:="")?(?=\s|$)/.test(match[1])) {
    fail('category.html: 掲載中ブランドが非表示です (' + match[2] + ')');
  }
}

const reportHtml = readFileSync(join(root, 'guide/store-data-report.html'), 'utf8');
for (const required of ['確認待ち・非公開', '公開対象']) {
  if (!reportHtml.includes(required)) fail('guide/store-data-report.html: 公開範囲の説明が不足しています (' + required + ')');
}
if (reportHtml.includes('検索機能の登録総数')) {
  fail('guide/store-data-report.html: 確認待ち候補を公開登録数と誤認させる表現があります');
}

const notFoundHtml = readFileSync(join(root, '404.html'), 'utf8');
for (const required of ['<base href="/"', '/spot.html?id=', '/stores.html?', "'pref='", "'brand='"]) {
  if (!notFoundHtml.includes(required)) fail('404.html: 廃止URLの移転処理が不足しています (' + required + ')');
}

const sampleText = htmlFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const indexHtml = indexHtmlForCounts;
for (const required of ['about.html', 'ガチャひろばの情報づくり', 'google-adsense-account',
  'guide/store-data-report.html', 'guide/gacha-budget-planner.html']) {
  if (!indexHtml.includes(required)) fail('index.html: 信頼性情報が不足しています (' + required + ')');
}
const privacyHtml = readFileSync(join(root, 'privacy.html'), 'utf8');
for (const required of ['policies.google.com/technologies/partner-sites', 'Google Analytics 4', '楽天アフィリエイト',
  'Supabase', 'data-gh-no-tracking', '計測除外フラグ', 'Google Analyticsのタグ自体を読み込みません']) {
  if (!privacyHtml.includes(required)) fail('privacy.html: 実装に対応する開示が不足しています (' + required + ')');
}
for (const forbidden of ['8,241スポット', 'ヨドバシAkiba ガチャコーナー', 'アキバガチャ横丁', '梅田LOFT ガチャコーナー', '掲示板 3,241件', '月間訪問 24,580']) {
  if (sampleText.includes(forbidden)) fail('試作表示が残っています: ' + forbidden);
}
if (existsSync(join(root, 'data/board-seed.js'))) fail('data/board-seed.js: 架空投稿データが公開対象に残っています');
const legacyLocation = readFileSync(join(root, 'location.html'), 'utf8');
if (!/http-equiv="refresh"[^>]+\/stores\.html\?pref=/i.test(legacyLocation) ||
    !/name="robots" content="noindex,follow"/i.test(legacyLocation)) {
  fail('location.html: 旧サンプルページが安全な移転ページになっていません');
}

if (errors.length) {
  console.error('validate-seo: NG / ' + errors.length + '件');
  errors.slice(0, 100).forEach((error) => console.error(' - ' + error));
  process.exit(1);
}
console.log('validate-seo: OK / 静的入口 ' + generated.length + 'ページ / sitemap ' + locs.length + 'URL / 内部リンク切れ 0');
