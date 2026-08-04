/* 一覧系ページ（stores / area / map）に、都道府県インデックスを静的HTMLとして書き込む。

   これらのページは店舗リストを JavaScript で描画しているため、素のHTMLがほぼ空だった。
   クローラーや審査で「中身のないページ」に見えてしまうのと、47都道府県への内部リンクが
   HTML上に存在しないのがもったいないので、ビルド時に実データから生成して埋め込む。

   埋め込み先は各HTMLの
     <!-- GH:PREF-INDEX:START --> … <!-- GH:PREF-INDEX:END -->
   の間。マーカーが無いページは黙ってスキップする。

   店舗を追加したら `node tools/gen-static-blocks.mjs` を実行する
   （daily-stores.yml では gen-pages / gen-sitemap と一緒に自動実行される）。 */
import { readFileSync, writeFileSync } from 'node:fs';

const win = {};
new Function('window', readFileSync(new URL('../data/spots.js', import.meta.url), 'utf8'))(win);
const spots = win.GH_SPOTS || [];

const REGION_LABEL = {
  kanto: '関東', kansai: '関西', tokai: '東海',
  kyushu: '九州・沖縄', tohoku: '東北・北海道', chugoku: '中国・四国'
};
const REGION_ORDER = ['kanto', 'kansai', 'tokai', 'kyushu', 'tohoku', 'chugoku'];

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* 地方 → 都道府県 → 件数 */
const byRegion = {};
spots.forEach(s => {
  (byRegion[s.region] ||= {})[s.pref] = (byRegion[s.region][s.pref] || 0) + 1;
});

/* 各都道府県の代表店（設置台数が最も多い店）を1件添えると、リンク先の中身が想像できる */
const topOf = pref => spots
  .filter(s => s.pref === pref)
  .sort((a, b) => (b.machines || 0) - (a.machines || 0))[0];

const prefCount = new Set(spots.map(s => s.pref)).size;

const regionBlocks = REGION_ORDER.filter(r => byRegion[r]).map(r => {
  const prefs = Object.keys(byRegion[r]).sort((a, b) => byRegion[r][b] - byRegion[r][a]);
  const total = prefs.reduce((n, p) => n + byRegion[r][p], 0);
  const items = prefs.map(p => {
    const top = topOf(p);
    return '        <li class="gh-prefindex__item">' +
      '<a href="/stores.html?pref=' + encodeURIComponent(p) + '">' + esc(p) + '</a>' +
      '<span class="gh-prefindex__count">' + byRegion[r][p] + '店</span>' +
      (top ? '<small class="gh-prefindex__top">' + esc(top.name) + '</small>' : '') +
      '</li>';
  }).join('\n');
  return '    <div class="gh-prefindex__group">\n' +
    '      <h3 class="gh-prefindex__region">' + esc(REGION_LABEL[r]) + '<span>' + total + '店</span></h3>\n' +
    '      <ul class="gh-prefindex__list">\n' + items + '\n      </ul>\n' +
    '    </div>';
}).join('\n');

const block =
  '\n  <div class="gh-prefindex">\n' +
  '    <p class="gh-prefindex__lead">' +
  '「ガチャひろば」では、全国' + prefCount + '都道府県・' + spots.length + '店舗のガチャガチャ設置スポットを掲載しています。' +
  'ガチャガチャの森・ガシャポンのデパート・#C-pla・カプセル楽局などの専門店に加え、' +
  '家電量販店や商業施設の設置コーナーも対象です。各店舗ページでは、住所・アクセス・営業時間・' +
  'おおよその設置台数に加えて、その店舗専用の掲示板で入荷や混雑の情報を交換できます。' +
  '下記の都道府県から探すか、ページ上部の検索ボックスに駅名・エリア名・店名を入力してください。</p>\n' +
  regionBlocks + '\n  </div>\n';

const TARGETS = ['../stores.html', '../area.html', '../map.html'];
let done = 0;
for (const rel of TARGETS) {
  const url = new URL(rel, import.meta.url);
  let html;
  try { html = readFileSync(url, 'utf8'); } catch { continue; }
  const re = /(<!-- GH:PREF-INDEX:START -->)[\s\S]*?(<!-- GH:PREF-INDEX:END -->)/;
  if (!re.test(html)) { console.log('skip (マーカーなし):', rel); continue; }
  writeFileSync(url, html.replace(re, (_m, a, b) => a + block + '  ' + b));
  done++;
}
console.log('gen-static-blocks: ' + done + ' ページに都道府県インデックスを埋め込みました（' +
  prefCount + '都道府県 / ' + spots.length + '店舗）');
