/* ===========================================================================
   spots-ui.js — データ方式の店舗ページ描画
   ・spot.html   : ?id=<店舗ID> の店舗詳細を data/spots.js から描画
   ・stores.html : 登録店舗の一覧（地方タブ付き）を描画
   ★ script.js より前に読み込むこと（掲示板が window.GH_SPOT_ID を参照するため）
   =========================================================================== */
(function () {
  'use strict';

  var SPOTS = window.GH_SPOTS || [];
  var byId = {};
  SPOTS.forEach(function (s) { byId[s.id] = s; });

  var REGION_LABEL = {
    kanto:   '関東',
    kansai:  '関西',
    tokai:   '東海',
    kyushu:  '九州・沖縄',
    tohoku:  '東北・北海道',
    chugoku: '中国・四国'
  };
  var REGION_ORDER = ['kanto', 'kansai', 'tokai', 'kyushu', 'tohoku', 'chugoku'];

  function qs(id) { return document.getElementById(id); }
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = (str == null ? '' : String(str));
    return d.innerHTML;
  }
  function getParam(name) {
    try { return new URLSearchParams(location.search).get(name); }
    catch (e) { return null; }
  }
  function machinesText(n) {
    if (n == null || n === '') return '—';
    return '約' + Number(n).toLocaleString('ja-JP') + '台';
  }

  /* ── オープン予定の店舗（data/spots.js の opensOn）──
     まだ開いていない店舗を営業中と混ぜないための共通ヘルパー。
     一覧・検索・掲示板一覧のどこに出ても必ずバッジが付くようにする。 */
  var JST_TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  function isPreOpen(s) { return !!(s && s.opensOn && s.opensOn > JST_TODAY); }
  function openDateText(iso, long) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return String(iso || '');
    if (!long) return Number(m[2]) + '/' + Number(m[3]);
    var w = ['日', '月', '火', '水', '木', '金', '土'][
      new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
    return Number(m[1]) + '年' + Number(m[2]) + '月' + Number(m[3]) + '日（' + w + '）';
  }
  function daysLeft(iso) {
    return Math.round((new Date(iso + 'T00:00:00+09:00').getTime() -
      new Date(JST_TODAY + 'T00:00:00+09:00').getTime()) / 86400000);
  }
  /* 一覧の店名の直後に付けるバッジ */
  function openBadge(s) {
    if (!isPreOpen(s)) return '';
    return '<span class="gh-badge gh-badge--soon">' + esc(openDateText(s.opensOn, false)) + ' オープン予定</span>';
  }
  function setText(id, value) { var el = qs(id); if (el) el.textContent = value; }
  function setAttr(sel, attr, val) { var el = document.querySelector(sel); if (el) el.setAttribute(attr, val); }
  /* 検索用の正規化：全角→半角（NFKC）・小文字化・ハイフン/#を除去。
     「Cpla」「C-pla」「#C-pla」「ｃｐｌａ」を同一視するため。 */
  function normSearch(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFKC'); } catch (e) {}
    return s.toLowerCase().replace(/[#\-‐‑–—−]/g, '');
  }
  function osmSearchUrl(store) {
    var q = [store.name, store.address].filter(Boolean).join(' ');
    return 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(q);
  }

  var PREF_ICON = {
    '東京都': '🗼', '神奈川県': '⚓', '埼玉県': '🌸', '千葉県': '🌊',
    '群馬県': '♨️', '栃木県': '🍓', '茨城県': '🌰', '大阪府': '🏯', '愛知県': '🏭'
  };

  /* 静的SEOページの正規URL。生成側の tools/seo-routes.mjs と同じ対応表。 */
  var PREF_SLUG = {
    '北海道':'hokkaido','青森県':'aomori','岩手県':'iwate','宮城県':'miyagi','秋田県':'akita','山形県':'yamagata','福島県':'fukushima',
    '茨城県':'ibaraki','栃木県':'tochigi','群馬県':'gunma','埼玉県':'saitama','千葉県':'chiba','東京都':'tokyo','神奈川県':'kanagawa',
    '新潟県':'niigata','富山県':'toyama','石川県':'ishikawa','福井県':'fukui','山梨県':'yamanashi','長野県':'nagano','岐阜県':'gifu',
    '静岡県':'shizuoka','愛知県':'aichi','三重県':'mie','滋賀県':'shiga','京都府':'kyoto','大阪府':'osaka','兵庫県':'hyogo','奈良県':'nara',
    '和歌山県':'wakayama','鳥取県':'tottori','島根県':'shimane','岡山県':'okayama','広島県':'hiroshima','山口県':'yamaguchi',
    '徳島県':'tokushima','香川県':'kagawa','愛媛県':'ehime','高知県':'kochi','福岡県':'fukuoka','佐賀県':'saga','長崎県':'nagasaki',
    '熊本県':'kumamoto','大分県':'oita','宮崎県':'miyazaki','鹿児島県':'kagoshima','沖縄県':'okinawa'
  };
  var BRAND_SLUG = {
    'ガチャガチャの森':'gacha-no-mori','ガシャポンのデパート':'gashapon-department-store','#C-pla（シープラ）':'c-pla',
    'カプセル楽局':'capsule-rakkyoku','ガシャポンバンダイオフィシャルショップ':'gashapon-bandai-official-shop',
    'gashacoco（ガシャココ）':'gashacoco','ドリームカプセル':'dream-capsule','ガシャポン（バンダイ）':'gashapon-bandai',
    'ヨドバシカメラ':'yodobashi-camera','ケンエレスタンド':'kenele-stand','CAPSULE LAB（カプコン）':'capsule-lab',
    'ガチャステ':'gacha-station','がちゃ処':'gachadokoro','カプセルマルシェ':'capsule-marche','TOYS SPOT PALO':'toys-spot-palo',
    'ガチャ王国':'gacha-okoku','カプセルパーク':'capsule-park'
  };
  function prefUrl(pref) { return PREF_SLUG[pref] ? '/area/' + PREF_SLUG[pref] + '.html' : '/area.html'; }
  function brandUrl(brand) { return BRAND_SLUG[brand] ? '/brand/' + BRAND_SLUG[brand] + '.html' : '/stores.html?q=' + encodeURIComponent(brand); }
  function guideUrl(slug) { return '/guide/' + encodeURIComponent(slug) + '.html'; }
  function markNoindex() {
    var meta = document.querySelector('meta[name="robots"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    meta.content = 'noindex,follow';
  }
  window.GH_PREF_URL = prefUrl;
  window.GH_BRAND_URL = brandUrl;

  /* 都道府県ごとに集計（店舗数の多い順） */
  function prefGroups() {
    var g = {}, order = [];
    SPOTS.forEach(function (s) {
      if (!g[s.pref]) { g[s.pref] = []; order.push(s.pref); }
      g[s.pref].push(s);
    });
    return order.map(function (pref) {
      var list = g[pref].slice().sort(function (a, b) { return (b.machines || 0) - (a.machines || 0); });
      return { pref: pref, list: list, top: list[0], count: list.length };
    }).sort(function (a, b) { return b.count - a.count; });
  }

  /* ページ判定 */
  if (qs('spotDetail')) renderDetail();
  if (qs('storeList'))  renderList();
  if (document.querySelector('[data-gh-spot-cards]')) renderSpotCards();
  if (document.querySelector('[data-gh-area-cards]')) renderAreaCards();
  if (document.querySelector('[data-gh-ticker]')) renderTicker();
  if (qs('statStores')) renderSummary();
  if (document.querySelector('[data-gh-board-table]')) renderBoardHub();
  if (qs('articlePage')) renderArticle();
  if (document.querySelector('[data-gh-article-list]')) renderArticleList();
  if (document.querySelector('[data-gh-upcoming]')) renderUpcoming();
  if (qs('enTopStores')) renderEnglishTop();
  if (document.querySelector('[data-gh-brand-nav]')) renderBrandNav();
  if (document.querySelector('[data-gh-new-spots]')) renderNewSpots();
  if (document.querySelector('[data-gh-releases]')) renderReleases();
  if (document.querySelector('[data-gh-tophero-chips]')) renderHeroChips();
  if (document.querySelector('[data-gh-release-hub]')) wireReleaseHubLinks();

  function wireReleaseHubLinks() {
    var releases = window.GH_RELEASES || [];
    var latest = releases.map(function (item) { return String(item.date || '').slice(0, 7); })
      .filter(function (month) { return /^\d{4}-\d{2}$/.test(month); }).sort().pop();
    if (!latest) return;
    document.querySelectorAll('[data-gh-release-hub]').forEach(function (link) {
      link.href = '/releases/' + latest + '.html';
    });
  }


  /* ------------------------------------------------------------------ */
  /* トップの検索ボックス直下のクイックリンク（[data-gh-tophero-chips]）    */
  /*   掲載店舗数の多いエリアを実データから算出して並べる。              */
  /*   店舗が増えれば自動で入れ替わる（メンテ不要）。                    */
  /* ------------------------------------------------------------------ */
  function renderHeroChips() {
    var box = document.querySelector('[data-gh-tophero-chips]');
    if (!box || !SPOTS.length) return;
    var counts = {};
    SPOTS.forEach(function (s) {
      var a = (s.area || '').split('・')[1] || s.area;
      if (a) counts[a] = (counts[a] || 0) + 1;
    });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8);
    box.innerHTML = top.map(function (a) {
      var article = (window.GH_ARTICLES || []).find(function (item) {
        return !item.ranking && item.type !== 'guide' && item.label === a;
      });
      var url = article ? guideUrl(article.slug) : '/stores.html?q=' + encodeURIComponent(a);
      return '<a class="gh-tophero__chip" href="' + url + '">' +
        esc(a) + '<span>' + counts[a] + '</span></a>';
    }).join('') +
      '<a class="gh-tophero__chip gh-tophero__chip--map" href="/map.html">🗺️ 現在地から探す</a>';
  }


  /* ------------------------------------------------------------------ */
  /* ブランドから探す（[data-gh-brand-nav]）                             */
  /*   実データのブランド別店舗数を多い順に表示し、実在する絞り込み      */
  /*   ページ（/brand/<slug>.html）へリンクする。                        */
  /* ------------------------------------------------------------------ */
  function renderBrandNav() {
    var box = document.querySelector('[data-gh-brand-nav]');
    if (!box) return;
    var counts = {};
    SPOTS.forEach(function (s) { counts[s.brand] = (counts[s.brand] || 0) + 1; });
    var ICON = {
      'ガチャガチャの森': '🌳', 'ガシャポンのデパート': '🏬', '#C-pla（シープラ）': '🎯',
      'カプセル楽局': '💊', 'gashacoco（ガシャココ）': '🥚', 'ドリームカプセル': '💫',
      'ガシャポンバンダイオフィシャルショップ': '⭐', 'CAPSULE LAB（カプコン）': '🔬',
      'ヨドバシカメラ': '📷', 'ガチャステ': '🎮', 'TOYS SPOT PALO': '🧸', 'ケンエレスタンド': '🐘'
    };
    var brands = Object.keys(counts).filter(function (b) { return counts[b] >= 2; })
      .sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8);
    if (!brands.length) { box.innerHTML = ''; return; }
    box.innerHTML = brands.map(function (b) {
      return '<a href="' + brandUrl(b) + '" class="gh-category-item">' +
               '<span class="gh-category-item__icon">' + (ICON[b] || '🎰') + '</span>' +
               '<span>' + esc(b.replace(/（.*?）/g, '')) + '</span>' +
               '<span class="gh-category-item__count">' + counts[b] + '店</span>' +
             '</a>';
    }).join('');
  }


  /* ------------------------------------------------------------------ */
  /* 新着掲載店舗（[data-gh-new-spots]）                                  */
  /*   データ配列の末尾＝最近追加した店舗。実在ページへリンクする。      */
  /* ------------------------------------------------------------------ */
  function renderNewSpots() {
    var box = document.querySelector('[data-gh-new-spots]');
    if (!box) return;
    var latest = SPOTS.slice(-8).reverse();
    box.innerHTML = latest.map(function (s, i) {
      return '<li><a href="/spot/' + encodeURIComponent(s.id) + '.html">' + esc(s.name) + '</a>' +
             (isPreOpen(s) ? openBadge(s) : (i === 0 ? '<span class="gh-badge gh-badge--hot">NEW</span>' : '')) +
             '<small class="gh-trending-list__area">' + esc(s.area) + '</small></li>';
    }).join('');
  }


  /* ------------------------------------------------------------------ */
  /* 今日発売のガチャ（[data-gh-releases]）                               */
  /*   data/releases.js から、当日発売 → 直近7日以内 → 今後の予定 の順で   */
  /*   拾う。該当が無ければセクションごと非表示（空の枠を出さない）。      */
  /* ------------------------------------------------------------------ */
  function renderReleases() {
    var box = document.querySelector('[data-gh-releases]');
    if (!box) return;
    var all = (window.GH_RELEASES || []).filter(function (r) { return r && r.date && r.title; });
    if (!all.length) return;

    var now = new Date(Date.now() + 9 * 3600 * 1000);   /* JST */
    var today = now.toISOString().slice(0, 10);
    var dayMs = 86400000;
    var diff = function (d) {
      return Math.round((new Date(d + 'T00:00:00+09:00').getTime() -
        new Date(today + 'T00:00:00+09:00').getTime()) / dayMs);
    };

    /* 並び順は「本日発売 → 直近の発売予定 → 少し前に出た新作」。
       発売がまだ先の商品を先頭に置かないため、日付の降順ではなく
       今日からの近さで並べる。 */
    var order = function (r) {
      var d = diff(r.date);
      if (d === 0) return [0, 0];
      if (d > 0) return [1, d];        /* これから出るもの：近い順 */
      return [2, -d];                  /* すでに出たもの：新しい順 */
    };
    var sortByProximity = function (arr) {
      return arr.slice().sort(function (a, b) {
        var x = order(a), y = order(b);
        return (x[0] - y[0]) || (x[1] - y[1]);
      });
    };

    var todays = all.filter(function (r) { return r.date === today; });
    /* 「今週」は直近7日の発売＋10日以内の発売予定をまとめて扱う
       （8/8発売のような目前の新作が拾えないのを避ける） */
    var week = all.filter(function (r) { var d = diff(r.date); return d !== 0 && d >= -7 && d <= 10; });
    var soon = all.filter(function (r) { return diff(r.date) > 0; });

    var list, label;
    if (todays.length) { list = sortByProximity(todays.concat(week)); label = '本日発売'; }
    else if (week.length) { list = sortByProximity(week); label = '今週の新作'; }
    else if (soon.length) { list = sortByProximity(soon); label = '発売予定'; }
    else { return; }

    /* label がある商品（発売日が週単位でしか公表されていないもの）は
       その表記をそのまま出す。date は並び順と表示期間の判定にだけ使う。 */
    var badgeOf = function (r) {
      var d = diff(r.date);
      var cls = d === 0 ? ' gh-rel__badge--today' : d > 0 ? ' gh-rel__badge--soon' : '';
      var text = r.label ? r.label
        : (d === 0 ? '本日発売' : r.date.slice(5).replace('-', '/') + ' 発売');
      return '<span class="gh-rel__badge' + cls + '">' + esc(text) + '</span>';
    };

    /* 先頭1件を大きく、残りは行リストで密に並べる（均等なカードにしない） */
    var shown = list.slice(0, 7);
    var cell = function (r, lead) {
      var cls = 'gh-rel' + (lead ? ' gh-rel--lead' : ' gh-rel--row');
      var inner = badgeOf(r) +
        '<strong class="gh-rel__title">' + esc(r.title) + '</strong>' +
        '<small class="gh-rel__meta">' + esc(r.maker || '') +
          (r.price ? '<span class="gh-rel__price">' + esc(r.price) + '</span>' : '') +
          (lead && r.note ? '<span class="gh-rel__note">' + esc(r.note) + '</span>' : '') + '</small>';
      return r.source
        ? '<a class="' + cls + '" href="' + esc(r.source) + '" target="_blank" rel="noopener">' + inner + '</a>'
        : '<div class="' + cls + '">' + inner + '</div>';
    };
    box.innerHTML = cell(shown[0], true) +
      (shown.length > 1
        ? '<div class="gh-rel-rest">' + shown.slice(1).map(function (r) { return cell(r, false); }).join('') + '</div>'
        : '');

    var head = document.querySelector('[data-gh-releases-label]');
    if (head) head.textContent = label;
    var sec = box.closest('.gh-release-sec');
    if (sec) sec.hidden = false;
  }

  /* ------------------------------------------------------------------ */
  /* エリアまとめ記事（/guide/<slug>.html）                              */
  /* ------------------------------------------------------------------ */
  function articleUrl(a) { return guideUrl(a.slug); }
  function articleStores(a) {
    return SPOTS.filter(function (s) { return a.areas.indexOf(s.area) !== -1; })
                .sort(function (x, y) { return (y.machines || 0) - (x.machines || 0); });
  }
  /* ランキング記事（art.ranking）は、エリアではなく公表設置台数の実データから
     自動集計する。pref / region で絞り込み、machines 公表店のみを対象。 */
  function resolveArticleStores(a) {
    if (a.ranking) {
      return SPOTS.filter(function (s) {
        if (a.ranking.pref && s.pref !== a.ranking.pref) return false;
        if (a.ranking.region && s.region !== a.ranking.region) return false;
        return s.machines != null;
      }).sort(function (x, y) { return (y.machines || 0) - (x.machines || 0); })
        .slice(0, a.ranking.limit || 10);
    }
    return articleStores(a);
  }

  function renderArticle() {
    var arts = window.GH_ARTICLES || [];
    var slug = getParam('area');
    var art = null;
    arts.forEach(function (a) { if (a.slug === slug) art = a; });

    if (!art) {
      markNoindex();
      var box = qs('articleContent');
      if (box) {
        box.innerHTML =
          '<div class="gh-page-hero"><h1 class="gh-page-hero__title">記事が見つかりませんでした</h1>' +
          '<p class="gh-page-hero__desc"><a href="/news.html">特集記事の一覧へ戻る →</a></p></div>';
      }
      return;
    }

    /* 旧クエリURLから静的な正規記事へ移行する。 */
    if (/\/article\.html$/.test(location.pathname)) {
      location.replace(guideUrl(art.slug));
      return;
    }

    var stores = resolveArticleStores(art);
    var pageUrl = 'https://gacha-hiroba.com' + guideUrl(art.slug);
    var desc = art.intro[0];

    /* head（SEO） */
    document.title = art.title + ' | ガチャひろば';
    var setAttr = function (sel, attr, val) { var el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
    setAttr('meta[name="description"]', 'content', desc);
    setAttr('link[rel="canonical"]', 'href', pageUrl);
    setAttr('meta[property="og:title"]', 'content', art.title);
    setAttr('meta[property="og:description"]', 'content', desc);
    setAttr('meta[property="og:url"]', 'content', pageUrl);

    /* JSON-LD: Article + 店舗のItemList */
    var ld = {
      '@context': 'https://schema.org', '@type': 'Article',
      'headline': art.title, 'dateModified': art.updated, 'inLanguage': 'ja',
      'mainEntityOfPage': pageUrl,
      'author': { '@type': 'Organization', 'name': 'ガチャひろば', 'url': 'https://gacha-hiroba.com/' }
    };
    var list = {
      '@context': 'https://schema.org', '@type': 'ItemList',
      'itemListElement': stores.map(function (s, i) {
        return { '@type': 'ListItem', 'position': i + 1, 'name': s.name,
                 'url': 'https://gacha-hiroba.com/spot/' + encodeURIComponent(s.id) + '.html' };
      })
    };
    var crumbs = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'ホーム', 'item': 'https://gacha-hiroba.com/' },
        { '@type': 'ListItem', 'position': 2, 'name': '新着情報・特集記事', 'item': 'https://gacha-hiroba.com/news.html' },
        { '@type': 'ListItem', 'position': 3, 'name': art.title, 'item': pageUrl }
      ]
    };
    (stores.length ? [ld, list, crumbs] : [ld, crumbs]).forEach(function (obj) {
      var sc = document.createElement('script');
      sc.type = 'application/ld+json';
      sc.textContent = JSON.stringify(obj);
      document.head.appendChild(sc);
    });

    /* 本文 */
    setText('articleCrumb', art.label + 'のガチャガチャまとめ');
    setText('articleTitle', art.emoji + ' ' + art.title);
    var meta = qs('articleMeta');
    if (meta) {
      meta.innerHTML = '最終更新：' + esc(art.updated) +
        (stores.length ? '　・　掲載 <strong>' + stores.length + '店舗</strong>（実データ）' : '　・　保存版ガイド');
    }
    var intro = qs('articleIntro');
    if (intro) {
      var body = art.intro.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
      /* ガイド記事: sections（見出し＋段落）を本文として描画 */
      if (art.sections && art.sections.length) {
        body += art.sections.map(function (sec) {
          return '<h2 class="gh-article-h2">' + esc(sec.h) + '</h2>' +
                 sec.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
        }).join('');
      }
      intro.innerHTML = body;
    }

    /* 比較表 */
    if (stores.length) {
      var lh = qs('articleListHeading'); if (lh) lh.hidden = false;
      var wrap = qs('articleTableWrap');
      if (wrap) {
        wrap.innerHTML =
          '<table class="gh-table"><thead><tr><th>店舗名</th><th class="gh-num">設置台数</th><th>営業時間</th><th></th></tr></thead><tbody>' +
          stores.map(function (s) {
            var url = '/spot/' + encodeURIComponent(s.id) + '.html';
            return '<tr><td><a class="gh-table__link" href="' + url + '">' + esc(s.name) + '</a></td>' +
                   '<td class="gh-num">' + machinesText(s.machines) + '</td>' +
                   '<td>' + esc(s.hours || '—') + '</td>' +
                   '<td><a href="' + url + '" class="gh-btn gh-btn--xs">詳細</a></td></tr>';
          }).join('') + '</tbody></table>';
      }
    }

    /* 各店舗の詳細ブロック */
    if (stores.length) {
      var sh = qs('articleStoresHeading'); if (sh) sh.hidden = false;
      var box2 = qs('articleStores');
      if (box2) {
        box2.innerHTML = stores.map(function (s, i) {
          var url = '/spot/' + encodeURIComponent(s.id) + '.html';
          return '<section class="gh-article-store">' +
            '<h3 class="gh-article-store__name">' + (i + 1) + '. <a href="' + url + '">' + esc(s.name) + '</a></h3>' +
            '<table class="gh-info-table gh-info-table--full"><tbody>' +
              '<tr><th>住所</th><td>' + esc((s.zip ? '〒' + s.zip + '　' : '') + s.address) + '</td></tr>' +
              (s.machines ? '<tr><th>設置台数</th><td>' + machinesText(s.machines) + '</td></tr>' : '') +
              (s.hours ? '<tr><th>営業時間</th><td>' + esc(s.hours) + '</td></tr>' : '') +
              (s.access ? '<tr><th>アクセス</th><td>' + esc(s.access) + '</td></tr>' : '') +
            '</tbody></table>' +
            '<div class="gh-article-store__actions">' +
              '<a href="' + url + '" class="gh-btn gh-btn--primary gh-btn--sm">店舗ページ・地図を見る</a>' +
              '<a href="' + url + '#board" class="gh-btn gh-btn--sm">💬 掲示板を見る</a>' +
            '</div>' +
          '</section>';
        }).join('');
      }
    }

    /* コツ */
    if (art.tips && art.tips.length) {
      var tb = qs('articleTipsBox'); if (tb) tb.hidden = false;
      var tips = qs('articleTips');
      if (tips) tips.innerHTML = art.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    }

    /* FAQ（よくある質問）＋ FAQPage 構造化データ（リッチリザルト対応） */
    if (art.faq && art.faq.length) {
      var fb = qs('articleFaqBox'); if (fb) fb.hidden = false;
      var faqBox = qs('articleFaq');
      if (faqBox) {
        faqBox.innerHTML = art.faq.map(function (f) {
          return '<details class="gh-faq">' +
            '<summary class="gh-faq__q">' + esc(f.q) + '</summary>' +
            '<p class="gh-faq__a">' + esc(f.a) + '</p>' +
          '</details>';
        }).join('');
      }
      var faqLd = {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        'mainEntity': art.faq.map(function (f) {
          return { '@type': 'Question', 'name': f.q,
                   'acceptedAnswer': { '@type': 'Answer', 'text': f.a } };
        })
      };
      var fsc = document.createElement('script');
      fsc.type = 'application/ld+json';
      fsc.textContent = JSON.stringify(faqLd);
      document.head.appendChild(fsc);
    }

    /* 関連記事 */
    var rel = qs('articleRelated');
    if (rel) {
      rel.innerHTML = arts.filter(function (a) { return a.slug !== art.slug; }).map(function (a) {
        var label = (a.type === 'guide' || a.ranking) ? a.label : a.label + 'のガチャガチャまとめ';
        return '<li><a href="' + articleUrl(a) + '" class="gh-category-item">' +
               '<span class="gh-category-item__icon">' + esc(a.emoji) + '</span>' +
               '<span>' + esc(label) + '</span></a></li>';
      }).join('');
    }
  }

  /* 記事一覧（news.html / index.html の [data-gh-article-list]） */
  function renderArticleList() {
    var arts = window.GH_ARTICLES || [];
    document.querySelectorAll('[data-gh-article-list]').forEach(function (box) {
      var limit = parseInt(box.getAttribute('data-gh-article-list') || '0', 10);
      var items = limit > 0 ? arts.slice(0, limit) : arts;
      box.innerHTML = items.map(function (a) {
        var count = resolveArticleStores(a).length;
        var badge = a.ranking ? 'ランキング' : a.type === 'guide' ? 'ガイド' : 'まとめ';
        return '<a href="' + articleUrl(a) + '" class="gh-news-item">' +
                 '<time class="gh-news-item__date">' + esc(a.updated) + '</time>' +
                 '<span class="gh-badge gh-badge--new">' + badge + '</span>' +
                 '<span>' + esc(a.emoji + ' ' + a.title) + (count ? '（' + count + '店舗掲載）' : '') + '</span>' +
               '</a>';
      }).join('');
    });
  }

  /* ------------------------------------------------------------------ */
  /* 英語ガイド（english.html）: 設置台数TOP10を英語ラベルで描画          */
  /* ------------------------------------------------------------------ */
  function renderEnglishTop() {
    var PREF_EN = {
      '東京都': 'Tokyo', '神奈川県': 'Kanagawa', '埼玉県': 'Saitama', '千葉県': 'Chiba',
      '群馬県': 'Gunma', '栃木県': 'Tochigi', '茨城県': 'Ibaraki',
      '大阪府': 'Osaka', '愛知県': 'Aichi', '福岡県': 'Fukuoka'
    };
    var box = qs('enTopStores');
    var top = SPOTS.filter(function (s) { return s.machines; })
      .sort(function (a, b) { return b.machines - a.machines; }).slice(0, 10);
    if (!top.length) return;
    setText('enStatStores', String(SPOTS.length));
    box.innerHTML =
      '<table class="gh-table"><thead><tr><th>#</th><th>Store</th><th>Area</th><th class="gh-num">Machines</th><th>Hours</th><th></th></tr></thead><tbody>' +
      top.map(function (s, i) {
        var mapsQ = encodeURIComponent(s.name + ' ' + s.address);
        var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + mapsQ;
        var areaJp = (s.area || '').split('・')[1] || '';
        return '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><a class="gh-table__link" href="/spot/' + encodeURIComponent(s.id) + '.html' + '">' + esc(s.name) + '</a>' + openBadge(s) + '</td>' +
          '<td>' + esc(PREF_EN[s.pref] || s.pref) + (areaJp ? '<small class="gh-store-brand">' + esc(areaJp) + '</small>' : '') + '</td>' +
          '<td class="gh-num">' + Number(s.machines).toLocaleString('en-US') + '</td>' +
          '<td>' + esc(s.hours || '—') + '</td>' +
          '<td><a class="gh-btn gh-btn--xs" href="' + mapsUrl + '" target="_blank" rel="noopener">Map</a></td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  }

  /* ------------------------------------------------------------------ */
  /* オープン予定トラッカー（news.html の [data-gh-upcoming]）           */
  /* ------------------------------------------------------------------ */
  function renderUpcoming() {
    var tbody = document.querySelector('[data-gh-upcoming]');
    if (!tbody) return;

    /* ① data/spots.js の opensOn 付き＝住所・営業時間まで確定した予定店舗。
          店舗ページが既にあるのでリンクを張る（開業日の早い順）。 */
    var fromSpots = SPOTS.filter(isPreOpen).sort(function (a, b) {
      return a.opensOn < b.opensOn ? -1 : a.opensOn > b.opensOn ? 1 : 0;
    }).map(function (s) {
      var left = daysLeft(s.opensOn);
      return {
        name: '<a class="gh-table__link" href="/spot/' + encodeURIComponent(s.id) + '.html">' + esc(s.name) + '</a>',
        area: s.area,
        expected: openDateText(s.opensOn, true) + (left > 0 ? '（あと' + left + '日）' : '（本日）'),
        note: s.access || ''
      };
    });

    /* ② data/upcoming.js ＝住所や時期がまだ固まっていない予定店舗（詳細ページなし） */
    var fromList = (window.GH_UPCOMING || []).map(function (u) {
      return { name: '<strong>' + esc(u.name) + '</strong>', area: u.area, expected: u.expected, note: u.note };
    });

    var rows = fromSpots.concat(fromList);
    if (!rows.length) return;
    tbody.innerHTML = rows.map(function (u) {
      return '<tr>' +
        '<td>' + u.name + '</td>' +
        '<td>' + esc(u.area || '—') + '</td>' +
        '<td>' + esc(u.expected || '時期未定') + '</td>' +
        '<td style="font-size:12px;color:var(--gh-muted)">' + esc(u.note || '') + '</td>' +
      '</tr>';
    }).join('');
    var sec = document.querySelector('[data-gh-upcoming-sec]');
    if (sec) sec.hidden = false;
  }

  /* ------------------------------------------------------------------ */
  /* 掲示板ハブ（board.html）: 実店舗の掲示板一覧＋実データ集計＋検索     */
  /* ------------------------------------------------------------------ */
  function renderBoardHub() {
    var sorted = SPOTS.slice().sort(function (a, b) { return (b.machines || 0) - (a.machines || 0); });

    /* サマリー */
    var totalMachines = SPOTS.reduce(function (n, s) { return n + (Number(s.machines) || 0); }, 0);
    var prefs = {}; SPOTS.forEach(function (s) { prefs[s.pref] = 1; });
    setText('boardStatBoards', SPOTS.length + '板');
    setText('boardStatPrefs', Object.keys(prefs).length + '都道府県');
    setText('boardStatMachines', '約' + totalMachines.toLocaleString('ja-JP') + '台');
    if (sorted[0]) {
      setText('boardStatTop', sorted[0].name.replace('ガチャガチャの森 ', ''));
      setText('boardStatTopSub', machinesText(sorted[0].machines) + '（台数1位）');
    }

    /* 一覧テーブル（初期は data-board-limit 件だけ出し、残りはボタンで展開する。
       289件すべてを最初から並べると縦に伸びすぎて、目当ての板に辿り着けないため） */
    var tbody = document.querySelector('[data-gh-board-table]');
    var rankCls = function (r) { return r === 1 ? ' gh-rank--1' : r === 2 ? ' gh-rank--2' : r === 3 ? ' gh-rank--3' : ''; };
    tbody.innerHTML = sorted.map(function (s, i) {
      var rank = i + 1;
      var url = '/spot/' + encodeURIComponent(s.id) + '.html' + '#board';
      return '<tr' + (rank === 1 ? ' class="gh-table__row--top"' : '') + '>' +
               '<td><span class="gh-rank' + rankCls(rank) + '">' + rank + '</span></td>' +
               '<td><a href="' + url + '" class="gh-table__link">' + esc(s.name) + '</a>' + openBadge(s) + '</td>' +
               '<td>' + esc(s.area) + '</td>' +
               '<td class="gh-num">' + machinesText(s.machines) + '</td>' +
               '<td><a href="' + url + '" class="gh-btn gh-btn--xs">見る</a></td>' +
             '</tr>';
    }).join('');

    var table = tbody.closest('table');
    var limit = table ? parseInt(table.getAttribute('data-board-limit') || '0', 10) : 0;
    var moreBtn = document.querySelector('[data-gh-board-more]');
    if (limit > 0 && sorted.length > limit) {
      var rows = tbody.querySelectorAll('tr');
      var hide = function () {
        for (var i = limit; i < rows.length; i++) rows[i].hidden = true;
      };
      hide();
      if (moreBtn) {
        moreBtn.textContent = '残り ' + (sorted.length - limit) + '件の掲示板をすべて表示 ▼';
        moreBtn.hidden = false;
        moreBtn.addEventListener('click', function () {
          for (var i = limit; i < rows.length; i++) rows[i].hidden = false;
          moreBtn.hidden = true;
        });
      }
    }

    /* サイドバー：大型スポットの掲示板 */
    var side = document.querySelector('[data-gh-board-side]');
    if (side) {
      side.innerHTML = sorted.slice(0, 5).map(function (s) {
        return '<li><a href="/spot/' + encodeURIComponent(s.id) + '.html' + '#board">' + esc(s.name) + '</a>' +
               '<span class="gh-category-item__count">' + machinesText(s.machines) + '</span></li>';
      }).join('');
    }

    /* 検索：入力でその場絞り込み */
    var input = qs('boardSearch');
    if (input) {
      input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        tbody.querySelectorAll('tr').forEach(function (tr) {
          tr.hidden = q !== '' && tr.textContent.toLowerCase().indexOf(q) === -1;
        });
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* トップの実データ集計（index.html のサマリーカード）                 */
  /* ------------------------------------------------------------------ */
  function renderSummary() {
    if (!SPOTS.length) return;
    var totalMachines = SPOTS.reduce(function (n, s) { return n + (Number(s.machines) || 0); }, 0);
    var prefs = {}; SPOTS.forEach(function (s) { prefs[s.pref] = 1; });
    var topStore = SPOTS.slice().sort(function (a, b) { return (b.machines || 0) - (a.machines || 0); })[0];
    setText('statStores', SPOTS.length.toLocaleString('ja-JP') + '店舗');
    setText('statMachines', '約' + totalMachines.toLocaleString('ja-JP') + '台');
    setText('statPrefs', Object.keys(prefs).length + '都道府県');
    if (topStore) {
      setText('statTop', machinesText(topStore.machines));
      setText('statTopName', topStore.name.replace('ガチャガチャの森 ', '').replace('Pon!（ガチャガチャの森）', ''));
    }
  }

  /* ------------------------------------------------------------------ */
  /* 店舗詳細（spot.html）                                               */
  /* ------------------------------------------------------------------ */
  function renderDetail() {
    /* 静的生成ページ（/spot/<id>.html）は window.GH_SPOT_STATIC_ID を持つ */
    var id = getParam('id') || window.GH_SPOT_STATIC_ID;
    var store = id ? byId[id] : null;

    if (!store) {
      markNoindex();
      var content = qs('spotContent');
      if (content) {
        content.innerHTML =
          '<div class="gh-page-hero">' +
            '<h1 class="gh-page-hero__title">店舗が見つかりませんでした</h1>' +
            '<p class="gh-page-hero__desc">URLが正しいかご確認ください。' +
            '<a href="/stores.html">店舗一覧へ戻る →</a></p>' +
          '</div>';
      }
      return;
    }

    /* 旧 /spot.html?id=... を静的な店舗URLへ集約する。 */
    if (getParam('id') && !window.GH_SPOT_STATIC_ID) {
      location.replace('/spot/' + encodeURIComponent(store.id) + '.html');
      return;
    }

    /* 掲示板（script.js）がこの店舗のスレッドを使うように、IDを先に公開 */
    window.GH_SPOT_ID = 'spot-' + store.id;

    /* <head> */
    var pageTitle = store.name + '｜設置台数・営業時間・掲示板 | ガチャひろば';
    var pageDesc = store.name + '（' + store.area + '）のガチャガチャ設置情報。' +
      (store.machines ? '設置台数' + machinesText(store.machines) + '、' : '') +
      (store.hours ? '営業時間 ' + store.hours + '。' : '') +
      '住所・アクセス・地図・店舗ごとの掲示板で入荷情報や混雑状況をチェック。';
    document.title = pageTitle;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', pageDesc);

    /* SEO: canonical・OGPをこの店舗のURLに更新し、構造化データを追加 */
    var pageUrl = 'https://gacha-hiroba.com/spot/' + encodeURIComponent(store.id) + '.html';
    var setAttr = function (sel, attr, val) { var el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
    setAttr('link[rel="canonical"]', 'href', pageUrl);
    setAttr('meta[property="og:title"]', 'content', pageTitle);
    setAttr('meta[property="og:description"]', 'content', pageDesc);
    setAttr('meta[property="og:url"]', 'content', pageUrl);

    var ld = {
      '@context': 'https://schema.org',
      '@type': 'Store',
      'name': store.name,
      'url': pageUrl,
      'address': {
        '@type': 'PostalAddress',
        'streetAddress': store.address,
        'addressRegion': store.pref,
        'addressCountry': 'JP'
      },
      'description': pageDesc
    };
    if (store.zip) ld.address.postalCode = store.zip;
    if (store.tel) ld.telephone = store.tel;
    if (store.lat != null && store.lon != null) {
      ld.geo = { '@type': 'GeoCoordinates', 'latitude': store.lat, 'longitude': store.lon };
    }
    var crumbs = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'トップ', 'item': 'https://gacha-hiroba.com/' },
        { '@type': 'ListItem', 'position': 2, 'name': '店舗一覧', 'item': 'https://gacha-hiroba.com/stores.html' },
        { '@type': 'ListItem', 'position': 3, 'name': store.pref + 'のガチャガチャ設置場所', 'item': 'https://gacha-hiroba.com' + prefUrl(store.pref) },
        { '@type': 'ListItem', 'position': 4, 'name': store.name, 'item': pageUrl }
      ]
    };
    /* 静的生成ページには焼き込み済み（data-gh-static）なので二重注入しない */
    if (!document.querySelector('script[type="application/ld+json"][data-gh-static]')) {
      [ld, crumbs].forEach(function (obj) {
        var sc = document.createElement('script');
        sc.type = 'application/ld+json';
        sc.textContent = JSON.stringify(obj);
        document.head.appendChild(sc);
      });
    }

    /* パンくず */
    var crumbArea = qs('spotCrumbArea');
    if (crumbArea) { crumbArea.textContent = store.pref || store.area; crumbArea.href = prefUrl(store.pref); }
    setText('spotCrumbName', store.name);

    /* ヒーロー */
    setText('spotName', store.name);
    var badges = qs('spotBadges');
    if (badges) {
      badges.innerHTML =
        (isPreOpen(store)
          ? '<span class="gh-badge gh-badge--lg gh-badge--soon">' +
              esc(openDateText(store.opensOn, false)) + ' オープン予定</span>'
          : '') +
        '<a class="gh-badge gh-badge--lg" style="text-decoration:none" ' +
          'href="' + brandUrl(store.brand) + '" ' +
          'title="' + esc(store.brand) + 'の店舗一覧を見る">' + esc(store.brand) + '</a>' +
        '<span class="gh-badge gh-badge--lg">' + esc(store.area) + '</span>';
    }
    var addr = qs('spotAddress');
    if (addr) {
      addr.innerHTML =
        '<span>📍 ' + esc((store.zip ? '〒' + store.zip + ' ' : '') + store.address) + '</span>' +
        (store.access ? '<span class="gh-tophero__divider">｜</span><span>🚉 ' + esc(store.access) + '</span>' : '');
    }

    /* 見出し数値（株価の位置＝設置台数） */
    setText('spotMachines', machinesText(store.machines));
    setText('spotHours', store.hours
      ? (isPreOpen(store) ? 'オープン後 ' + store.hours : '営業 ' + store.hours)
      : '営業時間はお問い合わせ');

    /* メトリクス。オープン前は台数がまだ分からないので、先頭の枠を開業日に差し替える */
    var metrics = qs('spotMetrics');
    if (metrics) {
      metrics.innerHTML =
        (isPreOpen(store)
          ? metric('オープン予定', openDateText(store.opensOn, false),
              'あと' + daysLeft(store.opensOn) + '日', true)
          : metric('設置台数', machinesText(store.machines), 'ガチャマシン', true)) +
        metric('営業時間', store.hours || '—', isPreOpen(store) ? 'オープン後の予定' : '定休日は店舗にご確認ください') +
        metric('エリア', store.area || '—', store.pref || '') +
        metric('ブランド', store.brand || '—', '公式店舗');
    }

    /* 詳細情報テーブル */
    var infoBody = qs('spotInfoBody');
    if (infoBody) {
      infoBody.innerHTML =
        (isPreOpen(store)
          ? '<tr><th>オープン予定日</th><td><strong>' + esc(openDateText(store.opensOn, true)) + '</strong></td></tr>'
          : '') +
        row('ブランド', store.brand) +
        row('住所', (store.zip ? '〒' + store.zip + '　' : '') + store.address) +
        row('電話番号', store.tel ? '<a href="tel:' + esc(String(store.tel).replace(/[^0-9+]/g, '')) + '">' + esc(store.tel) + '</a>' : '', true) +
        row('営業時間', store.hours) +
        row('設置台数', machinesText(store.machines)) +
        row('アクセス', store.access) +
        row('エリア', store.area) +
        row('公式情報', store.sourceUrl
          ? '<a class="gh-official-source" href="' + esc(store.sourceUrl) + '" target="_blank" rel="noopener">掲載元を確認 ↗</a>'
          : '', true) +
        row('情報確認日', store.verifiedAt);
    }

    /* 地図 */
    renderMap(store);

    /* 掲示板の見出し */
    setText('bbsTitle', '【' + (store.area || store.pref || 'ガチャ') + '】' + store.name + ' 🎰');

    /* 同じエリア（同じ地方）の店舗 */
    renderNearby(store);
  }

  function metric(label, value, sub, primary) {
    return '<div class="gh-metric' + (primary ? ' gh-metric--primary' : '') + '">' +
             '<span class="gh-metric__label">' + esc(label) + '</span>' +
             '<strong class="gh-metric__value">' + esc(value) + '</strong>' +
             (sub ? '<span class="gh-metric__sub">' + esc(sub) + '</span>' : '') +
           '</div>';
  }
  function row(th, td, rawTd) {
    if (td == null || td === '') return '';
    return '<tr><th>' + esc(th) + '</th><td>' + (rawTd ? td : esc(td)) + '</td></tr>';
  }

  function renderMap(store) {
    var sec = qs('spotMapSection');
    if (!sec) return;
    var html = '<div class="gh-section__header"><h2 class="gh-section__title">アクセスマップ</h2>';

    if (store.lat != null && store.lon != null) {
      var lat = Number(store.lat), lon = Number(store.lon), d = 0.006;
      var bbox = (lon - d) + '%2C' + (lat - d) + '%2C' + (lon + d) + '%2C' + (lat + d);
      var full = 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=17/' + lat + '/' + lon;
      html +=
        '<a href="' + full + '" class="gh-section__more" target="_blank" rel="noopener">大きな地図で見る →</a></div>' +
        '<div class="gh-osm-embed"><iframe title="' + esc(store.name) + 'の地図（OpenStreetMap）" ' +
          'src="https://www.openstreetmap.org/export/embed.html?bbox=' + bbox +
          '&amp;layer=mapnik&amp;marker=' + lat + '%2C' + lon + '" ' +
          'loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
        '<p class="gh-osm-embed__addr">📍 ' + esc((store.zip ? '〒' + store.zip + ' ' : '') + store.address) + '</p>' +
        '<a href="' + osmSearchUrl(store) + '" class="gh-map-link" target="_blank" rel="noopener">🗺️ 住所で検索して開く →</a>' +
        '<p class="gh-osm-embed__note">※地図のピンはおおよその位置です。正確な場所・階数は上記の住所や公式サイトでご確認ください。</p>';
    } else {
      html +=
        '</div>' +
        '<p class="gh-osm-embed__addr">📍 ' + esc((store.zip ? '〒' + store.zip + ' ' : '') + store.address) + '</p>' +
        '<a href="' + osmSearchUrl(store) + '" class="gh-map-link" target="_blank" rel="noopener">🗺️ OpenStreetMapで場所を見る →</a>' +
        '<p class="gh-osm-embed__note">※地図はOpenStreetMapの検索結果を表示します。番地・階数は上記の住所をご確認ください。</p>';
    }
    sec.innerHTML = html;
  }

  function renderNearby(store) {
    var box = qs('spotNearby');
    if (!box) return;
    var dist = function (a, b) {
      if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return Number.POSITIVE_INFINITY;
      var rad = function (n) { return Number(n) * Math.PI / 180; };
      var dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
      var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };
    var tier = function (s) { return s.area === store.area ? 0 : s.pref === store.pref ? 1 : 2; };
    var others = SPOTS.filter(function (s) { return s.id !== store.id; }).sort(function (a, b) {
      return (tier(a) - tier(b)) || (dist(store, a) - dist(store, b)) ||
        String(a.name).localeCompare(String(b.name), 'ja');
    }).slice(0, 6);

    if (!others.length) {
      box.innerHTML = '<p class="gh-widget__text">同じエリアの登録店舗は準備中です。' +
        '<a href="/stores.html">店舗一覧を見る →</a></p>';
      return;
    }
    box.innerHTML = others.map(function (s) {
      return '<a href="/spot/' + encodeURIComponent(s.id) + '.html' + '" class="gh-nearby__item">' +
               '<span class="gh-rank">🏬</span>' +
               '<div><strong>' + esc(s.name) + '</strong>' +
               '<small>' + esc(s.area) + ' ・ ' + machinesText(s.machines) + '</small></div>' +
             '</a>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* 店舗一覧（stores.html）                                             */
  /* ------------------------------------------------------------------ */
  function renderList() {
    var box = qs('storeList');
    var pref = getParam('pref');
    var query = getParam('q');
    var brand = getParam('brand');

    /* 検索可能な旧絞り込みURLは、完全静的な正規ページへ集約する。 */
    if (pref && PREF_SLUG[pref] && SPOTS.some(function (s) { return s.pref === pref; })) {
      location.replace(prefUrl(pref));
      return;
    }
    if (brand && BRAND_SLUG[brand] && SPOTS.some(function (s) { return s.brand === brand; })) {
      location.replace(brandUrl(brand));
      return;
    }

    /* ── キーワード検索（?q=）: 店名・エリア・住所・ブランドを横断で部分一致。
          スペース区切りの複数キーワードは AND 検索（例:「浅草 ガチャ」）── */
    if (query) {
      /* 自由入力の検索結果は無限に増えるため検索インデックスへ出さない。 */
      markNoindex();
      var nq = normSearch(query);
      var terms = nq.split(/\s+/).filter(function (t) { return t.length > 0; });
      /* 「ガチャ」「カプセルトイ」等の一般語は全店舗が該当するため常にマッチ扱い */
      var GENERIC = 'ガチャ ガチャガチャ ガチャポン ガシャポン カプセルトイ カプセル 専門店 店舗';
      var hits = SPOTS.filter(function (s) {
        var hay = normSearch([s.name, s.brand, s.area, s.pref, s.address, s.access]
          .map(function (f) { return (f == null ? '' : String(f)); }).join(' ') + ' ' + GENERIC);
        /* 空白を詰めた版も見る。「Main Labo」を「mainlabo」と入力しても、
           「ガシャポン のデパート」のように余分な空白を入れても当たるようにする。 */
        var flat = hay.replace(/\s+/g, '');
        return terms.every(function (t) {
          return hay.indexOf(t) !== -1 || flat.indexOf(t.replace(/\s+/g, '')) !== -1;
        });
      }).sort(function (a, b) { return (b.machines || 0) - (a.machines || 0); });

      var tabGroup2 = document.querySelector('.gh-tab-group');
      if (tabGroup2) tabGroup2.style.display = 'none';
      var title2 = document.querySelector('.gh-page-hero__title');
      if (title2) title2.textContent = '「' + query + '」の検索結果';
      var desc2 = document.querySelector('.gh-page-hero__desc');
      if (desc2) desc2.innerHTML = '店名・エリア・住所から <strong id="storeCount">' + hits.length + '</strong> 店舗が見つかりました。';
      document.title = '「' + query + '」の検索結果 | ガチャひろば';

      /* 関連するまとめ記事があれば先頭に提案 */
      var artHtml = '';
      var arts = (window.GH_ARTICLES || []).filter(function (a) {
        var at = normSearch(a.label + ' ' + a.title);
        var al = normSearch(a.label);
        return terms.some(function (t) { return at.indexOf(t) !== -1 || (al && t.indexOf(al) !== -1); });
      });
      if (arts.length) {
        artHtml = '<div class="gh-news-list" style="margin-bottom:16px">' + arts.map(function (a) {
          return '<a href="' + guideUrl(a.slug) + '" class="gh-news-item">' +
                   '<span class="gh-badge gh-badge--new">まとめ記事</span>' +
                   '<span>' + esc(a.emoji + ' ' + a.title) + '</span></a>';
        }).join('') + '</div>';
      }

      if (!hits.length) {
        box.innerHTML = artHtml +
          '<div class="gh-section" style="text-align:center;padding:34px 16px">' +
            '<p style="margin:0 0 6px;font-weight:700">「' + esc(query) + '」に一致する店舗は見つかりませんでした。</p>' +
            '<p style="margin:0;font-size:13px;color:var(--gh-muted)">店名・駅名・エリア名（例：渋谷、池袋、横浜）でお試しください。' +
            '<a href="/stores.html">すべての店舗を見る →</a></p>' +
          '</div>';
        return;
      }

      box.innerHTML = artHtml +
        '<section class="gh-section"><div class="gh-table-wrap"><table class="gh-table">' +
        '<thead><tr><th>店舗名</th><th>エリア</th><th>設置台数</th><th>営業時間</th></tr></thead><tbody>' +
        hits.map(function (s) {
          return '<tr>' +
            '<td><a class="gh-table__link" href="/spot/' + encodeURIComponent(s.id) + '.html' + '">' + esc(s.name) + '</a>' + openBadge(s) +
              '<small class="gh-store-brand">' + esc(s.brand) + '</small></td>' +
            '<td>' + esc(s.area) + '</td>' +
            '<td>' + machinesText(s.machines) + '</td>' +
            '<td>' + esc(s.hours || '—') + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div></section>';
      return;
    }

    /* ── ブランド別一覧（?brand=）: sitemap にも載る SEO 入口 ── */
    if (brand) {
      if (!BRAND_SLUG[brand]) markNoindex();
      var bHits = SPOTS.filter(function (s) { return s.brand === brand; })
        .sort(function (a, b) { return (b.machines || 0) - (a.machines || 0); });
      var tabGroup3 = document.querySelector('.gh-tab-group');
      if (tabGroup3) tabGroup3.style.display = 'none';
      var title3 = document.querySelector('.gh-page-hero__title');
      if (title3) title3.textContent = brand + ' の店舗一覧';
      var desc3 = document.querySelector('.gh-page-hero__desc');
      if (desc3) desc3.innerHTML = '「' + esc(brand) + '」の登録店舗 <strong id="storeCount">' + bHits.length + '</strong> 店舗を設置台数順に掲載しています。';
      document.title = brand + 'の店舗一覧（' + bHits.length + '店舗） | ガチャひろば';
      var bUrl = 'https://gacha-hiroba.com' + brandUrl(brand);
      setAttr('link[rel="canonical"]', 'href', bUrl);
      setAttr('meta[property="og:url"]', 'content', bUrl);
      renderBrandChips(brand);
      if (!bHits.length) {
        markNoindex();
        box.innerHTML =
          '<div class="gh-section" style="text-align:center;padding:34px 16px">' +
            '<p style="margin:0 0 6px;font-weight:700">「' + esc(brand) + '」の店舗は見つかりませんでした。</p>' +
            '<p style="margin:0;font-size:13px;color:var(--gh-muted)"><a href="/stores.html">すべての店舗を見る →</a></p>' +
          '</div>';
        return;
      }
      box.innerHTML =
        '<section class="gh-section"><div class="gh-table-wrap"><table class="gh-table">' +
        '<thead><tr><th>店舗名</th><th>エリア</th><th>設置台数</th><th>営業時間</th></tr></thead><tbody>' +
        bHits.map(function (s) {
          return '<tr>' +
            '<td><a class="gh-table__link" href="/spot/' + encodeURIComponent(s.id) + '.html' + '">' + esc(s.name) + '</a>' + openBadge(s) +
              '<small class="gh-store-brand">' + esc(s.brand) + '</small></td>' +
            '<td>' + esc(s.area) + '</td>' +
            '<td>' + machinesText(s.machines) + '</td>' +
            '<td>' + esc(s.hours || '—') + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div></section>';
      return;
    }

    var source = pref ? SPOTS.filter(function (s) { return s.pref === pref; }) : SPOTS;

    // ?pref= 指定時は都道府県で絞り込み表示（地方タブは隠す）
    if (pref) {
      var tabGroup = document.querySelector('.gh-tab-group');
      if (tabGroup) tabGroup.style.display = 'none';
      var title = document.querySelector('.gh-page-hero__title');
      if (title) title.textContent = pref + 'の店舗';
      document.title = pref + 'の店舗一覧 | ガチャひろば';
      var pUrl = 'https://gacha-hiroba.com' + prefUrl(pref);
      setAttr('link[rel="canonical"]', 'href', pUrl);
      setAttr('meta[property="og:url"]', 'content', pUrl);
      if (!source.length) {
        markNoindex();
        box.innerHTML = '<p class="gh-widget__text">' + esc(pref) + 'の登録店舗は現在準備中です。' +
          '<a href="/stores.html">すべての店舗を見る →</a></p>';
        setText('storeCount', '0');
        return;
      }
    }

    var groups = {};
    source.forEach(function (s) { (groups[s.region] = groups[s.region] || []).push(s); });

    var html = '';
    REGION_ORDER.forEach(function (region) {
      var arr = groups[region];
      if (!arr || !arr.length) return;
      html +=
        '<section class="gh-section gh-store-section" data-region="' + region + '">' +
          '<div class="gh-section__header">' +
            '<h2 class="gh-section__title">' + esc(REGION_LABEL[region]) +
            '<span class="gh-store-section__count">' + arr.length + '件</span></h2>' +
          '</div>' +
          '<div class="gh-table-wrap"><table class="gh-table">' +
            '<thead><tr><th>店舗名</th><th>エリア</th><th>設置台数</th><th>営業時間</th></tr></thead><tbody>';
      /* 地方ごとに初期20件だけ出し、残りはボタンで展開する。
         関東169件を最初から全部並べると、目当ての店に辿り着く前に力尽きるため。 */
      var LIMIT = 20;
      arr.forEach(function (s, i) {
        html +=
          '<tr' + (i >= LIMIT ? ' hidden data-more="' + region + '"' : '') + '>' +
            '<td><a class="gh-table__link" href="/spot/' + encodeURIComponent(s.id) + '.html' + '">' + esc(s.name) + '</a>' + openBadge(s) +
              '<small class="gh-store-brand">' + esc(s.brand) + '</small></td>' +
            '<td>' + esc(s.area) + '</td>' +
            '<td>' + machinesText(s.machines) + '</td>' +
            '<td>' + esc(s.hours || '—') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
      if (arr.length > LIMIT) {
        html += '<button type="button" class="gh-btn gh-btn--block gh-list-more" data-more-btn="' + region + '">' +
          '残り ' + (arr.length - LIMIT) + '件の' + esc(REGION_LABEL[region]) + 'の店舗を表示 ▼</button>';
      }
      html += '</section>';
    });

    box.innerHTML = html || '<p class="gh-widget__text">店舗はまだ登録されていません。</p>';
    box.querySelectorAll('[data-more-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = btn.getAttribute('data-more-btn');
        box.querySelectorAll('[data-more="' + r + '"]').forEach(function (tr) { tr.hidden = false; });
        btn.hidden = true;
      });
    });
    if (pref) { setText('storeCount', String(source.length)); }
    else { wireStoreTabs(); renderBrandChips(null); }
  }

  /* ------------------------------------------------------------------ */
  /* ブランド絞り込みチップ（stores.html の [data-gh-brand-chips]）      */
  /*   2店舗以上あるブランドを店舗数順に表示。?brand= ページへのリンク。 */
  /* ------------------------------------------------------------------ */
  function renderBrandChips(active) {
    var box = document.querySelector('[data-gh-brand-chips]');
    if (!box) return;
    var counts = {};
    SPOTS.forEach(function (s) { counts[s.brand] = (counts[s.brand] || 0) + 1; });
    var brands = Object.keys(counts).filter(function (b) { return counts[b] >= 2; })
      .sort(function (a, b) { return counts[b] - counts[a]; });
    if (!brands.length) { box.style.display = 'none'; return; }
    box.innerHTML =
      '<p class="gh-brand-chips__label">ブランドから探す</p>' +
      '<div class="gh-brand-chips">' +
      (active ? '<a class="gh-tab" href="/stores.html">すべて</a>' : '') +
      brands.map(function (b) {
        return '<a class="gh-tab' + (b === active ? ' active' : '') + '" href="' + brandUrl(b) + '">' +
          esc(b) + '<span class="gh-brand-chips__count">' + counts[b] + '</span></a>';
      }).join('') + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* 注目のガチャスポット（index.html の [data-gh-spot-cards]）          */
  /* ------------------------------------------------------------------ */
  function renderSpotCards() {
    var box = document.querySelector('[data-gh-spot-cards]');
    if (!box) return;
    var top = SPOTS.slice().sort(function (a, b) { return (b.machines || 0) - (a.machines || 0); }).slice(0, 3);
    if (!top.length) return;
    var grads = ['gh-spot-card__img--akiba', 'gh-spot-card__img--osaka', 'gh-spot-card__img--nagoya'];
    box.innerHTML = top.map(function (s, i) {
      var badge = i === 0 ? '<span class="gh-spot-card__badge gh-badge--hot">台数1位</span>' : '';
      return '<a href="/spot/' + encodeURIComponent(s.id) + '.html' + '" class="gh-spot-card' + (i === 0 ? ' gh-spot-card--lg' : '') + '">' +
               '<div class="gh-spot-card__img ' + grads[i % grads.length] + '">' + badge + '</div>' +
               '<div class="gh-spot-card__body">' +
                 '<span class="gh-spot-card__area">' + esc(s.area) + '</span>' +
                 '<h3 class="gh-spot-card__name">' + esc(s.name) + '</h3>' +
                 '<div class="gh-spot-card__meta"><span>🎰 ' + machinesText(s.machines) + '設置</span>' +
                   (s.hours ? '<span>🕒 ' + esc(s.hours) + '</span>' : '') + '</div>' +
                 (s.access ? '<p class="gh-spot-card__desc">' + esc(s.access) + '</p>' : '') +
                 '<div class="gh-tags"><span>' + esc(s.brand) + '</span></div>' +
               '</div>' +
             '</a>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* 注目スポットのティッカー（index.html の [data-gh-ticker]）          */
  /* ------------------------------------------------------------------ */
  function renderTicker() {
    var box = document.querySelector('[data-gh-ticker]');
    if (!box) return;
    var top = SPOTS.slice().sort(function (a, b) { return (b.machines || 0) - (a.machines || 0); }).slice(0, 8);
    if (!top.length) return;
    var item = function (s, i) {
      var cls = 'gh-ticker-item' + (i === 0 ? ' gh-ticker-item--hot' : '');
      var tag = i === 0 ? ' <em>台数1位</em>' : '';
      return '<a href="/spot/' + encodeURIComponent(s.id) + '.html' + '" class="' + cls + '">' +
               esc(s.name.replace('ガチャガチャの森 ', '')) +
               ' <span class="gh-ticker-item__star">' + machinesText(s.machines) + '</span>' + tag + '</a>';
    };
    // 無限スクロール用に2周分
    box.innerHTML = top.map(item).join('') + top.map(item).join('');
  }

  /* ------------------------------------------------------------------ */
  /* 都道府県カード（index.html / area.html の [data-gh-area-cards]）    */
  /*   variant="pref"=area.html風カード / それ以外=index風アイコンカード  */
  /* ------------------------------------------------------------------ */
  function renderAreaCards() {
    document.querySelectorAll('[data-gh-area-cards]').forEach(function (box) {
      var groups = prefGroups();
      if (!groups.length) return;
      var variant = box.getAttribute('data-gh-area-cards');
      /* トップページなど、全47都道府県を出すと縦に伸びすぎる場所は
         data-gh-area-limit="12" のように件数を絞れる（掲載数の多い順） */
      var limit = parseInt(box.getAttribute('data-gh-area-limit') || '0', 10);
      if (limit > 0) groups = groups.slice(0, limit);
      box.innerHTML = groups.map(function (g, i) {
        var url = prefUrl(g.pref);
        if (variant === 'pref') {
          return '<a href="' + url + '" class="gh-pref-card' + (i === 0 ? ' gh-pref-card--top' : '') + '">' +
                   '<span class="gh-pref-card__name">' + esc(g.pref) + '</span>' +
                   '<span class="gh-pref-card__count">' + g.count + '店舗</span>' +
                   '<div class="gh-pref-card__top"><small>設置台数トップ</small>' +
                     '<strong>' + esc(g.top.name) + '（' + machinesText(g.top.machines) + '）</strong></div>' +
                 '</a>';
        }
        return '<a href="' + url + '" class="gh-area-card">' +
                 '<span class="gh-area-card__icon">' + (PREF_ICON[g.pref] || '📍') + '</span>' +
                 '<strong>' + esc(g.pref) + '</strong><small>' + g.count + '店舗</small>' +
               '</a>';
      }).join('');
    });
  }

  function wireStoreTabs() {
    var tabs = document.querySelectorAll('[data-store-region]');
    if (!tabs.length) return;

    function apply(region) {
      var visible = 0;
      document.querySelectorAll('.gh-store-section').forEach(function (sec) {
        var show = (region === 'all' || sec.dataset.region === region);
        sec.hidden = !show;
        if (show) visible += sec.querySelectorAll('tbody tr').length;
      });
      setText('storeCount', String(visible));
    }
    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        btn.classList.add('active');
        apply(btn.dataset.storeRegion);
      });
    });
    var def = document.querySelector('[data-store-region="all"]') || tabs[0];
    def.click();
  }
})();
