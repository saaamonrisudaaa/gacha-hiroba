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
  function setText(id, value) { var el = qs(id); if (el) el.textContent = value; }
  function osmSearchUrl(store) {
    var q = [store.name, store.address].filter(Boolean).join(' ');
    return 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(q);
  }

  var PREF_ICON = {
    '東京都': '🗼', '神奈川県': '⚓', '埼玉県': '🌸', '千葉県': '🌊',
    '群馬県': '♨️', '栃木県': '🍓', '茨城県': '🌰', '大阪府': '🏯', '愛知県': '🏭'
  };

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

  /* ------------------------------------------------------------------ */
  /* 店舗詳細（spot.html）                                               */
  /* ------------------------------------------------------------------ */
  function renderDetail() {
    var id = getParam('id');
    var store = id ? byId[id] : null;

    if (!store) {
      var content = qs('spotContent');
      if (content) {
        content.innerHTML =
          '<div class="gh-page-hero">' +
            '<h1 class="gh-page-hero__title">店舗が見つかりませんでした</h1>' +
            '<p class="gh-page-hero__desc">URLが正しいかご確認ください。' +
            '<a href="stores.html">店舗一覧へ戻る →</a></p>' +
          '</div>';
      }
      return;
    }

    /* 掲示板（script.js）がこの店舗のスレッドを使うように、IDを先に公開 */
    window.GH_SPOT_ID = 'spot-' + store.id;

    /* <head> */
    document.title = store.name + ' | ガチャひろば';
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content',
        store.name + 'の店舗情報・掲示板。' + store.area + '／' + machinesText(store.machines) +
        '、営業時間 ' + (store.hours || '—') + '。設置ガチャの入荷・在庫情報を共有しよう。');
    }

    /* パンくず */
    var crumbArea = qs('spotCrumbArea');
    if (crumbArea) { crumbArea.textContent = store.pref || store.area; }
    setText('spotCrumbName', store.name);

    /* ヒーロー */
    setText('spotName', store.name);
    var badges = qs('spotBadges');
    if (badges) {
      badges.innerHTML =
        '<span class="gh-badge gh-badge--lg">' + esc(store.brand) + '</span>' +
        '<span class="gh-badge gh-badge--lg">' + esc(store.area) + '</span>';
    }
    var addr = qs('spotAddress');
    if (addr) {
      addr.innerHTML =
        '<span>📍 ' + esc((store.zip ? '〒' + store.zip + ' ' : '') + store.address) + '</span>' +
        (store.access ? '<span class="gh-hero__divider">｜</span><span>🚉 ' + esc(store.access) + '</span>' : '');
    }

    /* 見出し数値（株価の位置＝設置台数） */
    setText('spotMachines', machinesText(store.machines));
    setText('spotHours', store.hours ? '営業 ' + store.hours : '営業時間はお問い合わせ');

    /* メトリクス */
    var metrics = qs('spotMetrics');
    if (metrics) {
      metrics.innerHTML =
        metric('設置台数', machinesText(store.machines), 'ガチャマシン', true) +
        metric('営業時間', store.hours || '—', '定休日は店舗にご確認ください') +
        metric('エリア', store.area || '—', store.pref || '') +
        metric('ブランド', store.brand || '—', '公式店舗');
    }

    /* 詳細情報テーブル */
    var infoBody = qs('spotInfoBody');
    if (infoBody) {
      infoBody.innerHTML =
        row('ブランド', store.brand) +
        row('住所', (store.zip ? '〒' + store.zip + '　' : '') + store.address) +
        row('電話番号', store.tel ? '<a href="tel:' + esc(String(store.tel).replace(/[^0-9+]/g, '')) + '">' + esc(store.tel) + '</a>' : '', true) +
        row('営業時間', store.hours) +
        row('設置台数', machinesText(store.machines)) +
        row('アクセス', store.access) +
        row('エリア', store.area);
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
        '<p class="gh-osm-embed__addr">📍 ' + esc(store.address) + '</p>';
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
    var others = SPOTS.filter(function (s) {
      return s.region === store.region && s.id !== store.id;
    }).slice(0, 6);

    if (!others.length) {
      box.innerHTML = '<p class="gh-widget__text">同じエリアの登録店舗は準備中です。' +
        '<a href="stores.html">店舗一覧を見る →</a></p>';
      return;
    }
    box.innerHTML = others.map(function (s) {
      return '<a href="spot.html?id=' + encodeURIComponent(s.id) + '" class="gh-nearby__item">' +
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
    var source = pref ? SPOTS.filter(function (s) { return s.pref === pref; }) : SPOTS;

    // ?pref= 指定時は都道府県で絞り込み表示（地方タブは隠す）
    if (pref) {
      var tabGroup = document.querySelector('.gh-tab-group');
      if (tabGroup) tabGroup.style.display = 'none';
      var title = document.querySelector('.gh-page-hero__title');
      if (title) title.textContent = pref + 'の店舗';
      document.title = pref + 'の店舗一覧 | ガチャひろば';
      if (!source.length) {
        box.innerHTML = '<p class="gh-widget__text">' + esc(pref) + 'の登録店舗は現在準備中です。' +
          '<a href="stores.html">すべての店舗を見る →</a></p>';
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
      arr.forEach(function (s) {
        html +=
          '<tr>' +
            '<td><a class="gh-table__link" href="spot.html?id=' + encodeURIComponent(s.id) + '">' + esc(s.name) + '</a>' +
              '<small class="gh-store-brand">' + esc(s.brand) + '</small></td>' +
            '<td>' + esc(s.area) + '</td>' +
            '<td>' + machinesText(s.machines) + '</td>' +
            '<td>' + esc(s.hours || '—') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div></section>';
    });

    box.innerHTML = html || '<p class="gh-widget__text">店舗はまだ登録されていません。</p>';
    if (pref) { setText('storeCount', String(source.length)); }
    else { wireStoreTabs(); }
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
      return '<a href="spot.html?id=' + encodeURIComponent(s.id) + '" class="gh-spot-card' + (i === 0 ? ' gh-spot-card--lg' : '') + '">' +
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
      return '<a href="spot.html?id=' + encodeURIComponent(s.id) + '" class="' + cls + '">' +
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
      box.innerHTML = groups.map(function (g, i) {
        var url = 'stores.html?pref=' + encodeURIComponent(g.pref);
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
    var def = document.querySelector('[data-store-region="kanto"]') || tabs[0];
    def.click();
  }
})();
