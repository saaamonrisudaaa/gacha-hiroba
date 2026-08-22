/* 特集・ガイド記事の静的HTML生成スクリプト
   data/articles.js と data/spots.js を読み込み、全記事を /guide/<slug>.html に
   出力する。本文・店舗比較・構造化データまでHTMLへ焼き込み、JavaScriptを
   実行しないクローラーにも記事の内容がそのまま伝わるようにする。

   実行: node tools/gen-article-pages.mjs */
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { guidePath, spotPath } from './seo-routes.mjs';

const ORIGIN = 'https://gacha-hiroba.com';
const outDir = new URL('../guide/', import.meta.url);

function loadWindowData(relativePath, property) {
  const win = {};
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  new Function('window', source)(win);
  const value = win[property];
  if (!Array.isArray(value)) {
    throw new Error(`${relativePath}: window.${property} が配列ではありません`);
  }
  return value;
}

const articles = loadWindowData('../data/articles.js', 'GH_ARTICLES');
const publishedArticles = articles.filter((article) => article.type === 'guide').slice().sort((a, b) =>
  (Number(b.featured || 0) - Number(a.featured || 0)) ||
  String(b.updated || '').localeCompare(String(a.updated || '')) ||
  String(a.title || '').localeCompare(String(b.title || ''), 'ja'));
const spots = loadWindowData('../data/spots.js', 'GH_SPOTS');

if (!articles.length) throw new Error('gen-article-pages: 記事データが空です');

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const ldJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const machinesText = (value) => (value == null || value === '')
  ? '—'
  : `約${Number(value).toLocaleString('ja-JP')}台`;
const isVerified = (store) => Boolean(store && store.sourceUrl && store.verifiedAt);

function resolveStores(article) {
  if (article.ranking) {
    return spots.filter((spot) => {
      if (article.ranking.pref && spot.pref !== article.ranking.pref) return false;
      if (article.ranking.region && spot.region !== article.ranking.region) return false;
      return isVerified(spot) && spot.machines != null;
    }).sort((a, b) => (b.machines || 0) - (a.machines || 0))
      .slice(0, article.ranking.limit || 10);
  }

  const areas = Array.isArray(article.areas) ? article.areas : [];
  return spots.filter((spot) => areas.includes(spot.area))
    .sort((a, b) => {
      const aHasVerifiedMachines = isVerified(a) && a.machines != null;
      const bHasVerifiedMachines = isVerified(b) && b.machines != null;
      return (Number(bHasVerifiedMachines) - Number(aHasVerifiedMachines)) ||
        (bHasVerifiedMachines ? Number(b.machines) - Number(a.machines) : 0) ||
        String(a.name).localeCompare(String(b.name), 'ja');
    });
}

function relatedLabel(article) {
  return (article.type === 'guide' || article.ranking)
    ? article.label
    : `${article.label}のガチャガチャまとめ`;
}

function buildStructuredData(article, stores, pageUrl, description, modified) {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': `${pageUrl}#article`,
      headline: article.title,
      description,
      image: `${ORIGIN}/assets/ogp.png`,
      datePublished: article.published || article.updated,
      dateModified: modified,
      inLanguage: 'ja',
      mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
      author: { '@type': 'Organization', name: 'ガチャひろば運営者', url: `${ORIGIN}/about.html` },
      publisher: {
        '@type': 'Organization',
        name: 'ガチャひろば',
        url: `${ORIGIN}/`,
        logo: { '@type': 'ImageObject', url: `${ORIGIN}/assets/mascot-icon.png` }
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'トップ', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: '新着情報・特集記事', item: `${ORIGIN}/news.html` },
        { '@type': 'ListItem', position: 3, name: article.title, item: pageUrl }
      ]
    }
  ];

  if (stores.length) {
    data.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${article.label}の掲載店舗`,
      numberOfItems: stores.length,
      itemListElement: stores.map((store, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: store.name,
        url: `${ORIGIN}${spotPath(store.id)}`
      }))
    });
  }

  if (Array.isArray(article.faq) && article.faq.length) {
    data.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: article.faq.map((entry) => ({
        '@type': 'Question',
        name: entry.q,
        acceptedAnswer: { '@type': 'Answer', text: entry.a }
      }))
    });
  }

  return data.map((entry) =>
    `  <script type="application/ld+json">${ldJson(entry)}</script>`
  ).join('\n');
}

function buildTable(stores) {
  if (!stores.length) return '';
  return `
            <h2 class="gh-article__h2">掲載店舗の一覧・比較</h2>
            <div class="gh-table-wrap">
              <table class="gh-table">
                <thead><tr><th>店舗名</th><th class="gh-num">設置台数</th><th>営業時間</th><th></th></tr></thead>
                <tbody>
${stores.map((store) => {
  const url = spotPath(store.id);
  return `                  <tr><td><a class="gh-table__link" href="${url}">${esc(store.name)}</a><small class="gh-store-brand">${isVerified(store) ? '出典確認済み' : '出典確認中'}</small></td><td class="gh-num">${isVerified(store) ? esc(machinesText(store.machines)) : '未確認'}</td><td>${esc(store.hours || '—')}</td><td><a href="${url}" class="gh-btn gh-btn--xs">詳細</a></td></tr>`;
}).join('\n')}
                </tbody>
              </table>
            </div>`;
}

function buildStoreDetails(stores) {
  if (!stores.length) return '';
  return `
            <h2 class="gh-article__h2">各店舗の詳細</h2>
${stores.map((store, index) => {
  const url = spotPath(store.id);
  const rows = [
    `<tr><th>住所</th><td>${esc(`${store.zip ? `〒${store.zip}　` : ''}${store.address || ''}`)}</td></tr>`,
    store.machines ? `<tr><th>設置台数</th><td>${isVerified(store) ? esc(machinesText(store.machines)) : '未確認'}</td></tr>` : '',
    store.hours ? `<tr><th>営業時間</th><td>${esc(store.hours)}</td></tr>` : '',
    store.access ? `<tr><th>アクセス</th><td>${esc(store.access)}</td></tr>` : ''
  ].filter(Boolean).join('');
  return `            <section class="gh-article-store">
              <h3 class="gh-article-store__name">${index + 1}. <a href="${url}">${esc(store.name)}</a></h3>
              <table class="gh-info-table gh-info-table--full"><tbody>${rows}</tbody></table>
              <div class="gh-article-store__actions">
                <a href="${url}" class="gh-btn gh-btn--primary gh-btn--sm">店舗ページ・地図を見る</a>
                <a href="${url}#board" class="gh-btn gh-btn--sm">💬 掲示板を見る</a>
              </div>
            </section>`;
}).join('\n')}`;
}

const fmt = (value) => Number(value || 0).toLocaleString('ja-JP');
const rate = (value, total) => total ? `${(value / total * 100).toFixed(1)}%` : '0.0%';

function quantile(values, point) {
  if (!values.length) return null;
  return values[Math.round((values.length - 1) * point)];
}

function countBy(items, key) {
  const counts = new Map();
  items.forEach((item) => {
    const value = item[key];
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'ja'));
}

function buildDataReport(article) {
  if (article.report !== 'store-data-audit') return '';
  const verified = spots.filter(isVerified);
  const pending = spots.length - verified.length;
  const machineValues = verified.filter((s) => s.machines != null)
    .map((s) => Number(s.machines)).filter(Number.isFinite).sort((a, b) => a - b);
  const fields = [
    ['営業時間', verified.filter((s) => s.hours).length],
    ['設置台数', machineValues.length],
    ['アクセス', verified.filter((s) => s.access).length],
    ['電話番号', verified.filter((s) => s.tel).length],
    ['郵便番号', verified.filter((s) => s.zip).length]
  ];
  const bands = [
    ['299以下', (n) => n <= 299],
    ['300〜499', (n) => n >= 300 && n <= 499],
    ['500〜699', (n) => n >= 500 && n <= 699],
    ['700〜899', (n) => n >= 700 && n <= 899],
    ['900以上', (n) => n >= 900]
  ];
  const prefRows = countBy(verified, 'pref').slice(0, 10);
  const brandRows = countBy(verified, 'brand').slice(0, 10);
  const recent = verified.slice().sort((a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt)) ||
    String(a.name).localeCompare(String(b.name), 'ja')).slice(0, 10);
  const latestVerified = verified.map((s) => s.verifiedAt).filter(Boolean).sort().at(-1) || article.updated;
  const median = quantile(machineValues, 0.5);
  const q1 = quantile(machineValues, 0.25);
  const q3 = quantile(machineValues, 0.75);

  return `
            <section class="gh-audit" aria-labelledby="audit-summary">
              <h2 class="gh-article__h2" id="audit-summary">集計結果（${esc(article.updated)}集計）</h2>
              <div class="gh-metrics gh-audit__metrics">
                <div class="gh-metric gh-metric--primary"><span class="gh-metric__label">管理候補を含む全記録</span><strong class="gh-metric__value">${fmt(spots.length)}件</strong><span class="gh-metric__sub">確認待ちの候補を含む</span></div>
                <div class="gh-metric"><span class="gh-metric__label">公開対象</span><strong class="gh-metric__value">${fmt(verified.length)}件</strong><span class="gh-metric__sub">根拠URL・確認日あり</span></div>
                <div class="gh-metric"><span class="gh-metric__label">確認待ち・非公開</span><strong class="gh-metric__value">${fmt(pending)}件</strong><span class="gh-metric__sub">推測値は公開しない</span></div>
                <div class="gh-metric"><span class="gh-metric__label">公開対象の範囲</span><strong class="gh-metric__value">${countBy(verified, 'pref').length}都道府県</strong><span class="gh-metric__sub">${countBy(verified, 'brand').length}ブランド</span></div>
              </div>
              <p class="gh-detail-note">判定条件：掲載根拠URL（sourceUrl）と確認日（verifiedAt）が両方ある記録だけを公開対象にします。参照先には公式ページ以外も含むため、「一次情報」とは一律に表現しません。最新の根拠確認日は${esc(latestVerified)}です。<a href="/methodology.html">登録・確認基準の詳細</a></p>
            </section>

            <section class="gh-audit" aria-labelledby="audit-fields">
              <h2 class="gh-article__h2" id="audit-fields">公開対象${fmt(verified.length)}件の項目別確認状況</h2>
              <div class="gh-table-wrap"><table class="gh-table"><thead><tr><th scope="col">項目</th><th class="gh-num" scope="col">確認できた件数</th><th class="gh-num" scope="col">公開対象内の充足率</th><th class="gh-num" scope="col">未確認・未掲載</th></tr></thead><tbody>
${fields.map(([label, count]) => `                <tr><td>${esc(label)}</td><td class="gh-num">${fmt(count)}件</td><td class="gh-num">${rate(count, verified.length)}</td><td class="gh-num">${fmt(verified.length - count)}件</td></tr>`).join('\n')}
              </tbody></table></div>
              <p class="gh-detail-note">母数は公開対象${fmt(verified.length)}件です。未確認・未掲載は「なし」や「0」を意味せず、参照先で確認できない、または当サイトでまだ確認していない項目です。</p>
            </section>

            <section class="gh-audit" aria-labelledby="audit-machines">
              <h2 class="gh-article__h2" id="audit-machines">公表設置台数の分布</h2>
              <div class="gh-summary-bar">
                <div class="gh-summary-card"><span class="gh-summary-card__label">集計対象</span><strong class="gh-summary-card__value">${fmt(machineValues.length)}件</strong><span class="gh-summary-card__change">数値を確認できた記録</span></div>
                <div class="gh-summary-card"><span class="gh-summary-card__label">中央値</span><strong class="gh-summary-card__value">${median == null ? '—' : fmt(median)}</strong><span class="gh-summary-card__change">並べた中央の値</span></div>
                <div class="gh-summary-card"><span class="gh-summary-card__label">中央50%の範囲</span><strong class="gh-summary-card__value">${q1 == null ? '—' : `${fmt(q1)}〜${fmt(q3)}`}</strong><span class="gh-summary-card__change">第1〜第3四分位</span></div>
                <div class="gh-summary-card"><span class="gh-summary-card__label">最小〜最大</span><strong class="gh-summary-card__value">${machineValues.length ? `${fmt(machineValues[0])}〜${fmt(machineValues.at(-1))}` : '—'}</strong><span class="gh-summary-card__change">掲載値の範囲</span></div>
              </div>
              <div class="gh-table-wrap"><table class="gh-table"><thead><tr><th>台数帯</th><th class="gh-num">件数</th><th class="gh-num">台数記載内の割合</th></tr></thead><tbody>
${bands.map(([label, test]) => { const count = machineValues.filter(test).length; return `                <tr><td>${label}</td><td class="gh-num">${fmt(count)}件</td><td class="gh-num">${rate(count, machineValues.length)}</td></tr>`; }).join('\n')}
              </tbody></table></div>
              <p class="gh-detail-note">参照元の「台・面・種類」は定義が完全には統一されていません。合計を市場規模や在庫数として利用できず、個別商品の在庫や人気も表しません。四分位は数値を小さい順に並べ、位置が整数でない場合は隣り合う2値を線形補間して整数へ丸めています。</p>
            </section>

            <section class="gh-audit" aria-labelledby="audit-coverage">
              <h2 class="gh-article__h2" id="audit-coverage">出典確認済みデータの掲載構成</h2>
              <div class="gh-audit__columns">
                <div><h3>都道府県（上位10）</h3><div class="gh-table-wrap"><table class="gh-table"><thead><tr><th>都道府県</th><th class="gh-num">件数</th></tr></thead><tbody>${prefRows.map(([label, count]) => `<tr><td>${esc(label)}</td><td class="gh-num">${fmt(count)}件</td></tr>`).join('')}</tbody></table></div></div>
                <div><h3>ブランド（上位10）</h3><div class="gh-table-wrap"><table class="gh-table"><thead><tr><th>ブランド</th><th class="gh-num">件数</th></tr></thead><tbody>${brandRows.map(([label, count]) => `<tr><td>${esc(label)}</td><td class="gh-num">${fmt(count)}件</td></tr>`).join('')}</tbody></table></div></div>
              </div>
              <p class="gh-detail-note">この件数は当サイトの掲載カバー構成であり、実店舗数、市場シェア、人気順位ではありません。</p>
            </section>

            <section class="gh-audit" aria-labelledby="audit-sources">
              <h2 class="gh-article__h2" id="audit-sources">最近の確認記録と参照先</h2>
              <div class="gh-table-wrap"><table class="gh-table"><thead><tr><th>店舗</th><th>都道府県</th><th>確認日</th><th>掲載根拠</th></tr></thead><tbody>
${recent.map((store) => `                <tr><td><a href="${spotPath(store.id)}">${esc(store.name)}</a></td><td>${esc(store.pref)}</td><td>${esc(store.verifiedAt)}</td><td><a class="gh-official-source" href="${esc(store.sourceUrl)}" target="_blank" rel="noopener noreferrer">参照先を開く ↗</a></td></tr>`).join('\n')}
              </tbody></table></div>
              <p class="gh-detail-note">訂正は<a href="/contact.html">お問い合わせ</a>から、店舗名・該当URL・確認できる根拠を添えてお送りください。</p>
            </section>`;
}

function buildBudgetPlanner(article) {
  if (article.tool !== 'budget-planner') return '';
  return `
            <section class="gh-tool" aria-labelledby="budget-tool-title">
              <div class="gh-tool__head"><h2 class="gh-article__h2" id="budget-tool-title">予算から回数を計算する</h2><span class="gh-badge">入力は保存・送信しません</span></div>
              <form id="budgetPlanner" class="gh-tool__form">
                <label>持参予算（円）<input id="budgetTotal" type="number" inputmode="numeric" min="0" max="1000000" step="1" value="3000" required /></label>
                <label>残しておく金額（円）<input id="budgetReserve" type="number" inputmode="numeric" min="0" max="1000000" step="1" value="0" required /></label>
                <label>1回の価格（円）<input id="budgetPrice" type="number" inputmode="numeric" min="1" max="5000" step="1" value="400" required /></label>
                <label>全種類数（任意）<input id="budgetKinds" type="number" inputmode="numeric" min="1" max="200" step="1" placeholder="例：5" /></label>
                <label>回る店舗数（任意）<input id="budgetStores" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" /></label>
                <button class="gh-btn gh-btn--primary" type="submit">計算する</button>
              </form>
              <div id="budgetResult" class="gh-tool__result" aria-live="polite">
                <p>初期例：予算3,000円・1回400円なら、最大7回、使用上限2,800円、ガチャ枠の余り200円です。</p>
              </div>
              <p class="gh-detail-note">全種類数から出す金額は、重複が一度もない場合の理論上の最低額です。コンプリートを保証せず、排出確率や期待額は計算しません。</p>
            </section>
            <section aria-labelledby="budget-examples">
              <h2 class="gh-article__h2" id="budget-examples">3,000円で回せる回数の例</h2>
              <div class="gh-table-wrap"><table class="gh-table"><thead><tr><th scope="col">1回の価格</th><th class="gh-num" scope="col">最大回数</th><th class="gh-num" scope="col">使用上限</th><th class="gh-num" scope="col">ガチャ枠の余り</th></tr></thead><tbody>
                <tr><td>300円</td><td class="gh-num">10回</td><td class="gh-num">3,000円</td><td class="gh-num">0円</td></tr>
                <tr><td>400円</td><td class="gh-num">7回</td><td class="gh-num">2,800円</td><td class="gh-num">200円</td></tr>
                <tr><td>500円</td><td class="gh-num">6回</td><td class="gh-num">3,000円</td><td class="gh-num">0円</td></tr>
              </tbody></table></div>
            </section>`;
}

function buildReferences(article) {
  if (!Array.isArray(article.references) || !article.references.length) return '';
  return `
            <section aria-labelledby="article-references">
              <h2 class="gh-article__h2" id="article-references">確認に使う公式ページ</h2>
              <ul class="gh-source-list">${article.references.map((source) => `<li><a class="gh-official-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a>${source.note ? `<span>${esc(source.note)}</span>` : ''}</li>`).join('')}</ul>
            </section>`;
}

function buildArticleBody(article, stores, modified) {
  const intro = (article.intro || []).map((paragraph) =>
    `              <p>${esc(paragraph)}</p>`
  ).join('\n');
  const sections = (article.sections || []).map((section) => `
              <h2 class="gh-article-h2">${esc(section.h)}</h2>
${(section.body || []).map((paragraph) => `              <p>${esc(paragraph)}</p>`).join('\n')}`
  ).join('');
  const tips = Array.isArray(article.tips) && article.tips.length
    ? `
            <div class="gh-article__tips">
              <h2 class="gh-article__h2">実用メモ（確認のコツ）</h2>
              <ul>${article.tips.map((tip) => `<li>${esc(tip)}</li>`).join('')}</ul>
            </div>`
    : '';
  const faq = Array.isArray(article.faq) && article.faq.length
    ? `
            <div>
              <h2 class="gh-article__h2">❓ よくある質問</h2>
              ${article.faq.map((entry) => `<details class="gh-faq"><summary class="gh-faq__q">${esc(entry.q)}</summary><p class="gh-faq__a">${esc(entry.a)}</p></details>`).join('\n              ')}
            </div>`
    : '';
  const note = stores.length
    ? '※店舗情報には掲載根拠の確認作業中の項目も含まれます。未確認店舗の設置台数は集計せず「未確認」と表示します。最新の営業時間・在庫は店舗または確認元のページでご確認ください。'
    : '※本記事はガチャひろば運営者が、ガチャを探すときに役立つ手順や判断基準を独自に整理したものです。内容の訂正・改善提案はお問い合わせからお寄せください。';

  return `
            <h1 class="gh-article__title">${esc(`${article.emoji} ${article.title}`)}</h1>
            <div class="gh-article__meta">最終更新：<time datetime="${esc(modified)}">${esc(modified)}</time>${stores.length ? `　・　掲載 <strong>${stores.length}店舗</strong>（掲載データ）` : '　・　保存版ガイド'}</div>
            <p class="gh-detail-note">作成・確認：<a href="/about.html">ガチャひろば運営者（個人運営）</a> ／ <a href="/methodology.html">記事・データの作成方法</a></p>
            <div class="gh-article__intro">
${intro}
            </div>${buildDataReport(article)}${buildBudgetPlanner(article)}<div class="gh-article__intro">${sections}
            </div>${buildTable(stores)}${buildStoreDetails(stores)}${buildReferences(article)}${tips}${faq}
            <p class="gh-detail-note">${note}<a href="/methodology.html">データ確認方法を見る</a></p>`;
}

function buildPage(article) {
  const stores = resolveStores(article);
  const pageUrl = `${ORIGIN}${guidePath(article.slug)}`;
  const pageTitle = `${article.title} | ガチャひろば`;
  const description = (article.intro && article.intro[0]) || `${article.label}のガチャガチャ情報を紹介します。`;
  const related = publishedArticles.filter((item) => item.slug !== article.slug);
  const dataModified = article.report === 'store-data-audit'
    ? spots.filter(isVerified).map((store) => store.verifiedAt).filter(Boolean).sort().at(-1)
    : '';
  const modified = [article.updated, dataModified].filter(Boolean).sort().at(-1);
  const indexable = article.type === 'guide';
  const structuredData = buildStructuredData(article, stores, pageUrl, description, modified);
  const toolScript = article.tool === 'budget-planner' ? '\n  <script src="/planner.js" defer></script>' : '';

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="google-site-verification" content="YN5Q0DnCsIhwgitcXjcGqxlmfMec80Wl0uZskCNS11w" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="${indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow'}" />
  <meta name="description" content="${esc(description)}" />
  <title>${esc(pageTitle)}</title>
  <link rel="canonical" href="${pageUrl}" />
  <meta property="og:site_name" content="ガチャひろば" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="ja_JP" />
  <meta property="og:title" content="${esc(pageTitle)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${ORIGIN}/assets/ogp.png" />
  <meta property="article:published_time" content="${esc(article.published || article.updated)}" />
  <meta property="article:modified_time" content="${esc(modified)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(pageTitle)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${ORIGIN}/assets/ogp.png" />
  <link rel="icon" type="image/png" href="/assets/mascot-icon.png" />
  <link rel="stylesheet" href="/styles.css" />
${structuredData}
  <script src="/script.js" defer></script>${toolScript}
</head>
<body>
  <header class="gh-header">
    <div class="gh-header__top">
      <div class="gh-container gh-header__inner">
        <a class="gh-logo" href="/index.html" aria-label="ガチャひろば トップへ">
          <img class="gh-logo__icon" src="/assets/mascot-icon.png" alt="ガチャひろばのマスコット" width="34" height="34" />
          <span class="gh-logo__text">ガチャ<em>ひろば</em></span>
        </a>
        <form class="gh-search" role="search">
          <input class="gh-search__input" type="search" placeholder="エリア・駅名・店名で検索" aria-label="ガチャ場所を検索" />
          <button class="gh-search__btn" type="submit" aria-label="検索">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
        </form>
        <button class="gh-hamburger" aria-label="メニューを開く" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </div>
    <div class="gh-subnav">
      <div class="gh-container">
        <nav class="gh-nav-tabs" aria-label="メインナビゲーション">
          <a href="/index.html">トップ</a>
          <a href="/board.html">掲示板</a>
          <a href="/news.html" class="active">新着情報</a>
          <a href="/ranking.html">ランキング</a>
          <a href="/area.html">エリア別</a>
          <a href="/category.html">ブランド別</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="gh-main">
    <div class="gh-container">
      <nav class="gh-breadcrumb" aria-label="パンくずリスト">
        <a href="/index.html">トップ</a><span aria-hidden="true">›</span>
        <a href="/news.html">特集記事</a><span aria-hidden="true">›</span>
        <span aria-current="page">${esc(article.type === 'guide' ? article.title : `${article.label}のガチャガチャまとめ`)}</span>
      </nav>

      <div class="gh-main__layout">
        <div class="gh-main__content">
          <article class="gh-section gh-article">${buildArticleBody(article, stores, modified)}
          </article>
        </div>

        <aside class="gh-sidebar">
          <div class="gh-widget">
            <h2 class="gh-widget__title">関連記事</h2>
            <ul class="gh-category-list">
${related.map((item) => `              <li><a href="${guidePath(item.slug)}" class="gh-category-item"><span class="gh-category-item__icon">${esc(item.emoji)}</span><span>${esc(relatedLabel(item))}</span></a></li>`).join('\n')}
            </ul>
          </div>
          <div class="gh-widget gh-widget--accent">
            <h2 class="gh-widget__title">店舗を探す</h2>
            <p class="gh-widget__text">全国の登録店舗を一覧・マップ・ランキングから絞り込めます。来店前は確認元の最新情報もご覧ください。</p>
            <div class="gh-app-btns">
              <a href="/stores.html" class="gh-app-btn">🏬 店舗一覧を見る</a>
              <a href="/ranking.html" class="gh-app-btn">📊 ランキングを見る</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </main>

  <footer class="gh-footer">
    <div class="gh-container">
      <div class="gh-footer__main">
        <div class="gh-footer__brand">
          <a class="gh-logo" href="/index.html"><img class="gh-logo__icon" src="/assets/mascot-icon.png" alt="ガチャひろばのマスコット" width="34" height="34" /><span class="gh-logo__text">ガチャ<em>ひろば</em></span></a>
          <p>全国のガチャガチャ設置場所情報を掲載。<br />あなたのガチャライフをサポートします。</p>
        </div>
        <div class="gh-footer__links">
          <div><strong>サービス</strong><a href="/index.html">トップ</a><a href="/stores.html">店舗一覧</a><a href="/ranking.html">ランキング</a><a href="/map.html">マップ検索</a></div>
          <div><strong>情報</strong><a href="/guide/store-data-report.html">データ監査レポート</a><a href="/guide/gacha-budget-planner.html">予算プランナー</a><a href="/news.html">独自ガイド</a><a href="/about.html">運営情報・編集方針</a><a href="/methodology.html">データ確認方法</a></div>
          <div><strong>サポート</strong><a href="/contact.html">お問い合わせ</a><a href="/terms.html">利用規約</a><a href="/privacy.html">プライバシー</a><a href="/sitemap.html">サイトマップ</a><a href="/english.html">English</a><a href="/advertising.html">広告掲載</a></div>
        </div>
      </div>
      <div class="gh-footer__bottom"><span>© 2026 ガチャひろば (gacha-hiroba.com)</span><span>Powered by ガチャひろば</span></div>
    </div>
  </footer>
</body>
</html>
`;
}

function validatePage(article, stores, html) {
  const expectedCanonical = `${ORIGIN}${guidePath(article.slug)}`;
  const required = [
    `<title>${esc(`${article.title} | ガチャひろば`)}</title>`,
    `<link rel="canonical" href="${expectedCanonical}" />`,
    `<h1 class="gh-article__title">${esc(`${article.emoji} ${article.title}`)}</h1>`,
    '<script src="/script.js" defer></script>',
    '</html>'
  ];
  for (const marker of required) {
    if (!html.includes(marker)) {
      throw new Error(`gen-article-pages: ${article.slug} に必須要素がありません: ${marker}`);
    }
  }

  const h1Count = (html.match(/<h1\b/g) || []).length;
  if (h1Count !== 1) {
    throw new Error(`gen-article-pages: ${article.slug} の h1 が ${h1Count} 個あります`);
  }
  if (/\b(?:href|src)="(?!https?:\/\/|\/|#|mailto:|tel:|data:)[^"]+"/.test(html)) {
    throw new Error(`gen-article-pages: ${article.slug} に相対URLが残っています`);
  }
  if (/spots-ui\.js|<script[^>]+src=["'][^"']*data\/(?:spots|articles)\.js/i.test(html)) {
    throw new Error(`gen-article-pages: ${article.slug} が不要な動的描画コードを読み込んでいます`);
  }
  const expectsIndex = article.type === 'guide';
  if (expectsIndex !== /name="robots" content="index,follow/i.test(html)) {
    throw new Error(`gen-article-pages: ${article.slug} のrobots指定が記事種別と一致しません`);
  }
  if (/pagead2\.googlesyndication\.com|adsbygoogle|data\/ads\.js|class="gh-ad\b|data-gh-(?:commerce|featured|gacha-goods)/i.test(html)) {
    throw new Error(`gen-article-pages: ${article.slug} に広告・アフィリエイト要素が残っています`);
  }

  const jsonObjects = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
  const types = new Set(jsonObjects.map((object) => object['@type']));
  if (!types.has('Article') || !types.has('BreadcrumbList')) {
    throw new Error(`gen-article-pages: ${article.slug} の基本構造化データが不足しています`);
  }
  if (types.has('ItemList') !== Boolean(stores.length)) {
    throw new Error(`gen-article-pages: ${article.slug} の ItemList と店舗数が一致しません`);
  }
  const hasFaq = Boolean(Array.isArray(article.faq) && article.faq.length);
  if (types.has('FAQPage') !== hasFaq) {
    throw new Error(`gen-article-pages: ${article.slug} の FAQPage とFAQ本文が一致しません`);
  }

  const sourceText = [
    ...(article.intro || []),
    ...(article.tips || []),
    ...(article.sections || []).flatMap((section) => [section.h, ...(section.body || [])]),
    ...(article.faq || []).flatMap((entry) => [entry.q, entry.a]),
    ...stores.map((store) => store.name)
  ];
  const editorialLength = [
    ...(article.intro || []),
    ...(article.tips || []),
    ...(article.sections || []).flatMap((section) => [section.h, ...(section.body || [])]),
    ...(article.faq || []).flatMap((entry) => [entry.q, entry.a])
  ].join('').length;
  if (editorialLength < 1400) {
    throw new Error(`gen-article-pages: ${article.slug} の独自本文が不足しています (${editorialLength}文字)`);
  }
  for (const source of article.references || []) {
    if (!/^https:\/\//.test(source.url || '') || !html.includes(esc(source.url))) {
      throw new Error(`gen-article-pages: ${article.slug} の参考リンクが不正です`);
    }
  }
  if (article.report === 'store-data-audit' &&
      (!html.includes('id="audit-summary"') || !html.includes('id="audit-sources"'))) {
    throw new Error(`gen-article-pages: ${article.slug} の監査集計が不足しています`);
  }
  if (article.tool === 'budget-planner' &&
      (!html.includes('id="budgetPlanner"') || !html.includes('<script src="/planner.js" defer></script>'))) {
    throw new Error(`gen-article-pages: ${article.slug} の予算ツールが不足しています`);
  }
  for (const text of sourceText) {
    if (!html.includes(esc(text))) {
      throw new Error(`gen-article-pages: ${article.slug} の本文が欠落しています: ${text}`);
    }
  }
}

mkdirSync(outDir, { recursive: true });

const slugs = new Set();
for (const article of publishedArticles) {
  if (!article || !/^[a-z0-9-]+$/.test(article.slug || '')) {
    throw new Error(`gen-article-pages: 不正な slug: ${article && article.slug}`);
  }
  if (slugs.has(article.slug)) throw new Error(`gen-article-pages: slug 重複: ${article.slug}`);
  slugs.add(article.slug);
  const stores = resolveStores(article);
  const html = buildPage(article);
  validatePage(article, stores, html);
  writeFileSync(new URL(`${article.slug}.html`, outDir), html, 'utf8');
}

for (const file of readdirSync(outDir)) {
  /* 生成対象と同じ命名規則のファイルだけを整理する。
     手元の比較用コピー（例: "name 2.html"）には触れない。 */
  if (/^[a-z0-9-]+\.html$/.test(file) && !slugs.has(file.slice(0, -5))) {
    unlinkSync(new URL(file, outDir));
  }
}

console.log(`gen-article-pages: ${publishedArticles.length}本の独自ガイドを guide/ に生成・検証しました`);
