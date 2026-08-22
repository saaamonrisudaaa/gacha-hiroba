/* GitHub Pagesへ渡す公開専用ディレクトリを作る。
   リポジトリ全体を公開せず、表示に必要なファイルと確認済み店舗だけを _site/ に出力する。 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, '_site');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

function copy(relative) {
  const source = join(root, relative);
  if (!existsSync(source)) throw new Error(`build-public-site: 必須ファイルがありません: ${relative}`);
  const target = join(out, relative);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

const rootFiles = [
  'CNAME',
  'ads.txt',
  'feed.xml',
  'llms.txt',
  'planner.js',
  'robots.txt',
  'script.js',
  'sitemap.xml',
  'spots-ui.js',
  'styles.css'
];

for (const file of rootFiles) copy(file);
for (const file of readdirSync(root).filter((name) => name.endsWith('.html'))) copy(file);
for (const file of [
  'assets/mascot-icon.png',
  'assets/mascot.png',
  'assets/ogp.png',
  'assets/store-default.svg'
]) copy(file);
for (const directory of ['guide', 'releases']) {
  for (const file of readdirSync(join(root, directory)).filter((name) => name.endsWith('.html'))) {
    copy(join(directory, file));
  }
}
for (const file of ['data/articles.js', 'data/releases.js', 'data/upcoming.js']) copy(file);

const windowData = {};
new Function('window', readFileSync(join(root, 'data/spots.js'), 'utf8'))(windowData);
const allSpots = Array.isArray(windowData.GH_SPOTS) ? windowData.GH_SPOTS : [];
const publicSpots = allSpots.filter((spot) => Boolean(spot && spot.sourceUrl && spot.verifiedAt));
if (!allSpots.length || !publicSpots.length || publicSpots.length > allSpots.length) {
  throw new Error('build-public-site: 確認済み店舗の抽出件数が想定外です');
}
mkdirSync(join(out, 'data'), { recursive: true });
writeFileSync(
  join(out, 'data/spots.js'),
  '/* 公開用：掲載根拠URLと確認日がそろう店舗だけを生成時に抽出。 */\n' +
    'window.GH_SPOTS = ' + JSON.stringify(publicSpots, null, 2) + ';\n'
);

/* 公開HTMLの内部導線を正規URLへ統一する。
   絞り込みはhashで渡し、クロール対象となるquery URLを新たに増やさない。 */
const publicHtmlFiles = [
  ...readdirSync(out).filter((name) => name.endsWith('.html')).map((name) => join(out, name)),
  ...['guide', 'releases'].flatMap((directory) =>
    readdirSync(join(out, directory)).filter((name) => name.endsWith('.html'))
      .map((name) => join(out, directory, name)))
];

for (const file of publicHtmlFiles) {
  let html = readFileSync(file, 'utf8');
  html = html
    .replace(/href=(['"])\/?index\.html\1/g, 'href=$1/$1')
    .replace(/stores\.html\?(pref|brand)=/g, 'stores.html#$1=')
    .replace(/^\s*<link\s+rel="alternate"\s+hreflang="[^"]+"[^>]*>\s*$/gim, '');
  writeFileSync(file, html);
}

writeFileSync(join(out, '.nojekyll'), '');

const forbidden = [
  'README.md',
  'tools',
  '.github',
  '.git',
  'data/spots-queue.json',
  'data/x-posts.json',
  'data/x-posted-log.json'
];
for (const relative of forbidden) {
  if (existsSync(join(out, relative))) {
    throw new Error(`build-public-site: 内部ファイルが公開物へ混入しました: ${relative}`);
  }
}

const publicWindow = {};
new Function('window', readFileSync(join(out, 'data/spots.js'), 'utf8'))(publicWindow);
if (!publicWindow.GH_SPOTS.every((spot) => spot.sourceUrl && spot.verifiedAt)) {
  throw new Error('build-public-site: 公開店舗データに確認待ちレコードが混入しました');
}
for (const file of publicHtmlFiles) {
  const html = readFileSync(file, 'utf8');
  if (/href=(['"])\/?index\.html\1/.test(html)) {
    throw new Error(`build-public-site: index.htmlへの内部リンクが残っています: ${file}`);
  }
  if (/stores\.html\?(?:pref|brand)=/.test(html)) {
    throw new Error(`build-public-site: 絞り込みquery URLが残っています: ${file}`);
  }
}

console.log(
  `build-public-site: OK / 公開HTML ${publicHtmlFiles.length}件 / ` +
  `確認済み店舗 ${publicSpots.length}件（確認待ち ${allSpots.length - publicSpots.length}件は非公開）`
);
