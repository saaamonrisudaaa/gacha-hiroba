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

  /* ページ判定 */
  if (qs('spotDetail')) renderDetail();
  if (qs('storeList'))  renderList();

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
    var groups = {};
    SPOTS.forEach(function (s) { (groups[s.region] = groups[s.region] || []).push(s); });

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
    wireStoreTabs();
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
