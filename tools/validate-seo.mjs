/* 公開前のSEO整合性チェック。
   静的入口の title / canonical / H1 / JSON-LD、内部リンク、sitemapを検証する。 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const ORIGIN = 'https://gacha-hiroba.com';
const errors = [];
const fail = (message) => errors.push(message);

function filesIn(dir, suffix = '.html') {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((name) => name.endsWith(suffix)).sort().map((name) => join(abs, name));
}

const generated = [
  ...filesIn('spot'), ...filesIn('area'), ...filesIn('brand'),
  ...filesIn('guide'), ...filesIn('releases')
];
const titles = new Map();
const canonicals = new Set();

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
  if (/name="robots" content="noindex/i.test(html)) fail(rel + ': 正規ページに noindex があります');
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) fail(rel + ': JSON-LD がありません');
  scripts.forEach((match, index) => {
    try { JSON.parse(match[1]); }
    catch (error) { fail(rel + ': JSON-LD #' + (index + 1) + ' が不正です (' + error.message + ')'); }
  });
}

/* 公開HTML全体のローカルリンク切れを確認する。 */
const htmlFiles = readdirSync(root).filter((name) => name.endsWith('.html')).map((name) => join(root, name)).concat(generated);
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
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
}
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
for (const match of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(match[1]) || match[1] > today) fail('sitemap.xml: 不正なlastmod ' + match[1]);
}
for (const canonical of canonicals) {
  if (!locs.includes(canonical)) fail('sitemap.xml: 正規ページが未掲載 ' + canonical);
}

const sampleText = htmlFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
for (const forbidden of ['8,241スポット', 'ヨドバシAkiba ガチャコーナー', 'アキバガチャ横丁', '梅田LOFT ガチャコーナー', '掲示板 3,241件', '月間訪問 24,580']) {
  if (sampleText.includes(forbidden)) fail('試作表示が残っています: ' + forbidden);
}
if (existsSync(join(root, 'data/board-seed.js'))) fail('data/board-seed.js: 架空投稿データが公開対象に残っています');
const legacyLocation = readFileSync(join(root, 'location.html'), 'utf8');
if (!/http-equiv="refresh"[^>]+\/guide\/akihabara\.html/i.test(legacyLocation) ||
    !/name="robots" content="noindex,follow"/i.test(legacyLocation)) {
  fail('location.html: 旧サンプルページが安全な移転ページになっていません');
}

if (errors.length) {
  console.error('validate-seo: NG / ' + errors.length + '件');
  errors.slice(0, 100).forEach((error) => console.error(' - ' + error));
  process.exit(1);
}
console.log('validate-seo: OK / 静的入口 ' + generated.length + 'ページ / sitemap ' + locs.length + 'URL / 内部リンク切れ 0');
