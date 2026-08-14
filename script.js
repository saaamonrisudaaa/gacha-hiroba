'use strict';

/* ── Google Analytics 4 (gtag.js) ── 測定ID: G-6KSGDTM1VJ
   ここ1か所で管理。プライバシーページなど data-gh-no-tracking を付けたページでは
   外部計測を読み込まない。IDを変えるときは下の GA_ID を書き換えるだけ。 */
if (!document.body?.hasAttribute('data-gh-no-tracking') && !/\/privacy\.html$/.test(location.pathname)) {
  (function () {
    var GA_ID = 'G-6KSGDTM1VJ';
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  })();
}

/* ── GA4 event helper ──
   流入後に「検索→店舗詳細→経路」まで進めたかを判定するための最小イベント。 */
function ghTrack(name, params) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params || {});
}

/* ── Hamburger menu ── */
const hamburger = document.querySelector('.gh-hamburger');
const navTabs   = document.querySelector('.gh-nav-tabs');
if (hamburger && navTabs) {
  hamburger.addEventListener('click', () => {
    const open = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', String(!open));
    navTabs.classList.toggle('gh-nav-tabs--open', !open);
  });
  navTabs.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.setAttribute('aria-expanded', 'false');
      navTabs.classList.remove('gh-nav-tabs--open');
    });
  });
}

/* ── Footer trust link fallback ──
   古い静的ページでも運営情報・編集方針へ辿れるようにする。生成テンプレート側にも
   同じリンクを持たせ、すでに存在するページでは重複させない。 */
(function () {
  document.querySelectorAll('.gh-footer__links').forEach(links => {
    if (links.querySelector('a[href$="about.html"]')) return;
    const groups = Array.from(links.children);
    const infoGroup = groups.find(group => {
      const heading = group.querySelector('strong');
      return heading && heading.textContent.trim() === '情報';
    }) || groups[groups.length - 1];
    if (!infoGroup) return;
    const about = document.createElement('a');
    about.href = '/about.html';
    about.textContent = '運営情報・編集方針';
    infoGroup.appendChild(about);
  });
})();

/* ── Prevent form submissions (no backend yet) ── */
document.querySelectorAll('form').forEach(form => {
  form.addEventListener('submit', e => e.preventDefault());
});

/* ── ヘッダー検索：入力語で店舗を検索（stores.html?q=…）── */
document.querySelectorAll('.gh-search').forEach(form => {
  const input = form.querySelector('.gh-search__input');
  if (!input) return;
  // 検索結果ページでは入力欄に検索語を残す
  try {
    const q = new URLSearchParams(location.search).get('q');
    if (q && /stores\.html$/.test(location.pathname)) input.value = q;
  } catch (e) {}
  form.addEventListener('submit', () => {
    const q = input.value.trim();
    if (q) {
      ghTrack('search_submit', { search_term: q, search_location: 'header' });
      location.href = '/stores.html?q=' + encodeURIComponent(q);
    }
    else input.focus();
  });
});

/* ── サイドバーの「エリア・駅名で検索」ウィジェット：都道府県で店舗一覧へ ── */
document.querySelectorAll('.gh-widget__form').forEach(form => {
  const sel = form.querySelector('.gh-select');
  if (!sel) return;
  form.addEventListener('submit', () => {
    const pref = sel.value.trim();
    if (pref) {
      ghTrack('area_select', { area_name: pref, search_location: 'sidebar' });
      location.href = window.GH_PREF_URL ? window.GH_PREF_URL(pref) : '/stores.html?pref=' + encodeURIComponent(pref);
    }
    else sel.focus();
  });
});

/* ── Supabase 接続情報（publishable=公開キー。書き込みはRLS・関数で制御） ── */
const GH_SUPA_URL = 'https://vyzdekctlynzuaowopso.supabase.co';
const GH_SUPA_KEY = 'sb_publishable_1GOi0AxMP1emK7hOC_wMeQ_jqmEL47E';

/* ── アクセス数（裏側データ）──
   ランキングの並び順にだけ使い、数値はどこにも表示しない。
   Supabase の spot_views（閲覧カウント）を読み、多い順に順位を変動させる。
   未設定・オフライン時は従来どおり設置台数順にフォールバック。 */
let GH_VIEWS = null;                                    // { 店舗id: 閲覧数 }
const ghViewsOf = s => (GH_VIEWS && GH_VIEWS[s.id]) || 0;

/* ── Ranking: 実店舗（data/spots.js）をアクセス数→設置台数順に描画 ── */
function renderRanking(key) {
  const tbody = document.querySelector('#rankingTable tbody');
  if (!tbody) return;
  const spots = window.GH_SPOTS || [];
  const esc = s => { const d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; };
  const machinesText = n => (n == null || n === '') ? '—' : '約' + Number(n).toLocaleString('ja-JP') + '台';
  const rankCls = r => r === 1 ? 'gh-rank--1' : r === 2 ? 'gh-rank--2' : r === 3 ? 'gh-rank--3' : '';
  const inTab = s => {
    if (key === 'tokyo') return s.pref === '東京都';
    if (key === 'osaka') return s.pref === '大阪府';
    if (key === 'other') return s.pref !== '東京都' && s.pref !== '大阪府';
    return true;                                   // national
  };

  /* オープン前の店舗（opensOn が未来日）は台数ランキングに載せない。
     まだ1台も回せない店が上位に並ぶと順位の意味が壊れるため。 */
  const jstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const open = s => !(s.opensOn && s.opensOn > jstToday);

  const rows = spots.filter(s => inTab(s) && open(s)).sort((a, b) =>
    (ghViewsOf(b) - ghViewsOf(a)) || ((b.machines || 0) - (a.machines || 0)));
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gh-muted);padding:22px">この地域の店舗は現在準備中です。</td></tr>';
    return;
  }

  const table = tbody.closest('table');
  const limit = table ? parseInt(table.dataset.limit || '0', 10) : 0;
  /* ランキングページは初期30件だけ出し、残りはボタンで展開する
     （289件を最初から並べると、上位を見たいだけの人が延々スクロールすることになる） */
  const more = document.querySelector('[data-gh-rank-more]');
  const shown = limit > 0 ? rows.slice(0, limit) : rows;
  if (more) {
    const rest = rows.length - shown.length;
    more.hidden = rest <= 0;
    more.textContent = rest > 0 ? '残り ' + rest + '件を表示 ▼' : '';
    more.onclick = () => {
      if (table) table.removeAttribute('data-limit');
      more.hidden = true;
      renderRanking(key);
    };
  }

  tbody.innerHTML = shown.map((s, i) => {
    const rank = i + 1;
    const url = '/spot/' + encodeURIComponent(s.id) + '.html';
    return `
    <tr class="${rank === 1 ? 'gh-table__row--top' : ''}">
      <td><span class="gh-rank ${rankCls(rank)}">${rank}</span></td>
      <td><a href="${url}" class="gh-table__link">${esc(s.name)}</a></td>
      <td>${esc(s.area)}</td>
      <td class="gh-num">${machinesText(s.machines)}</td>
      <td><a href="${url}" class="gh-btn gh-btn--xs">詳細</a></td>
    </tr>`;
  }).join('');
}

/* Ranking tab switch */
document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.gh-tab-group').querySelectorAll('.gh-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderRanking(btn.dataset.tab);
  });
});

/* ── Detail page content tabs (詳細 / 掲示板) ── */
const detailTabs = document.querySelectorAll('.gh-detail-tabs [data-panel]');
detailTabs.forEach(btn => {
  btn.addEventListener('click', () => {
    detailTabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const target = btn.dataset.panel;
    document.querySelectorAll('.gh-tab-panel').forEach(p => {
      p.hidden = p.dataset.panel !== target;
    });
    // 掲示板タブでは店舗情報ヒーローを隠して、スレッドに集中できるようにする
    const hero = document.querySelector('.gh-quote');
    if (hero) hero.hidden = (target === 'board');
    document.body.classList.toggle('gh-board-mode', target === 'board');
  });
});
// Open the 掲示板 panel directly when arriving via #board (e.g. from board.html)
if (location.hash === '#board') {
  const boardTab = document.querySelector('.gh-detail-tabs [data-panel="board"]');
  if (boardTab) boardTab.click();
}

/* ── 5ch-style bulletin board: Supabase (shared) with localStorage fallback (location.html) ── */
(function () {
  const list   = document.getElementById('bbsList');
  const body   = document.getElementById('bbsBody');
  const nameIn = document.getElementById('bbsName');
  const submit = document.getElementById('bbsSubmit');
  const count  = document.getElementById('bbsCount');
  if (!list || !body || !submit) return;

  /* Supabase 設定は共通定数（GH_SUPA_URL / GH_SUPA_KEY）を使用 */
  const SPOT = (window.GH_SPOT_ID || 'yodobashi-akiba'); // 掲示板ID。データ方式の店舗ページは spots-ui.js が設定

  const STORE_KEY = 'gh-bbs:' + SPOT;                 // オフライン時のフォールバック保存（スレッドごとに分離）
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const pad  = n => String(n).padStart(2, '0');

  function fmtDate(d) {
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${days[d.getDay()]}) ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function nowStr() { return fmtDate(new Date()); }
  function randomId() {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = ''; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; return s;
  }
  function idHash(str) {                               // 投稿ごとに安定した5ch風ID
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 8; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; s += c[(h >>> 16) % 62]; }
    return s;
  }
  function escapeHtml(str) {
    const div = document.createElement('div'); div.textContent = (str == null ? '' : String(str)); return div.innerHTML;
  }
  function renderBody(raw) {
    return escapeHtml(raw)
      .replace(/&gt;&gt;(\d+)/g, '<a href="#res$1" class="gh-bbs__anchor">&gt;&gt;$1</a>')
      .replace(/\n/g, '<br>');
  }
  function makePost(p) {
    const post = document.createElement('article');
    post.className = 'gh-bbs__post';
    post.id = 'res' + p.num;
    post.innerHTML =
      '<div class="gh-bbs__resline">' +
        '<span class="gh-bbs__num">' + p.num + '</span>' +
        '<span class="gh-bbs__name">' + escapeHtml(p.name) + '</span>' +
        '<span class="gh-bbs__date">' + escapeHtml(p.date) + '</span>' +
        '<span class="gh-bbs__id">ID:' + escapeHtml(p.id) + '</span>' +
      '</div>' +
      '<p class="gh-bbs__body">' + renderBody(p.body) + '</p>';
    return post;
  }

  /* ── スパム対策（クライアント側の一次防御。本当の強制は Supabase トリガーで） ── */
  const SPAM = {
    cooldownMs: 15000,                  // 連続投稿の最短間隔（15秒）
    maxBody: 500,                       // 本文の最大文字数
    maxName: 20,                        // 名前の最大文字数
    ngWords: ['死ね', '殺す', 'ぶっ殺']  // ★ NGワードはここに追加していけます
  };
  const LAST_KEY = 'gh-bbs-last-post';
  function validate(name, text) {
    if (!text) return { ok: false };                                              // 空 → フォーカスのみ
    if ([...text].length > SPAM.maxBody) return { ok: false, msg: `本文は${SPAM.maxBody}文字以内で入力してください。` };
    if (name && [...name].length > SPAM.maxName) return { ok: false, msg: `名前は${SPAM.maxName}文字以内にしてください。` };
    const hay = name + '\n' + text;
    for (const w of SPAM.ngWords) { if (w && hay.includes(w)) return { ok: false, msg: '不適切な語句が含まれているため投稿できません。' }; }
    let last = 0; try { last = Number(localStorage.getItem(LAST_KEY)) || 0; } catch (e) {}
    const wait = SPAM.cooldownMs - (Date.now() - last);
    if (wait > 0) return { ok: false, msg: `連続投稿はできません。あと約${Math.ceil(wait / 1000)}秒お待ちください。` };
    return { ok: true };
  }
  function markPosted() { try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch (e) {} }

  /* 送信は一度だけ配線し、実処理は currentHandler の差し替えで切り替える */
  let currentHandler = function () {};
  submit.addEventListener('click', () => currentHandler());
  body.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); currentHandler(); }
  });

  const canSupa = !!(window.supabase && typeof window.supabase.createClient === 'function');
  if (canSupa) startSharedBoard(); else startLocalBoard();

  /* ---------- Supabase 共有モード（全員の投稿を共有） ---------- */
  function startSharedBoard() {
    const sb = window.supabase.createClient(GH_SUPA_URL, GH_SUPA_KEY);
    let total = 0;
    const toView = (p, num) => ({
      num, name: p.name || '名無しのガチャー', date: fmtDate(new Date(p.created_at)),
      id: idHash(String(p.id) + p.created_at), body: p.body
    });

    currentHandler = async function post() {
      const text = body.value.trim();
      const name = (nameIn && nameIn.value.trim()) || '名無しのガチャー';
      const v = validate(name, text);
      if (!v.ok) { if (v.msg) alert(v.msg); else body.focus(); return; }
      submit.disabled = true;
      try {
        const { data, error } = await sb.from('posts').insert({ spot: SPOT, name, body: text }).select();
        if (error) throw error;
        markPosted();
        const empty = document.getElementById('bbsEmpty'); if (empty) empty.remove();
        total += 1;
        const el = makePost(toView(data[0], total));
        list.insertBefore(el, list.firstElementChild);   // newest on top
        if (count) count.textContent = String(total);
        body.value = '';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        console.error('board insert failed', err);
        alert('投稿に失敗しました。通信環境を確認して、もう一度お試しください。');
      } finally {
        submit.disabled = false;
      }
    };

    sb.from('posts').select('*').eq('spot', SPOT).order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error;
        list.innerHTML = '';
        data.forEach((p, i) => list.insertBefore(makePost(toView(p, i + 1)), list.firstElementChild));
        total = data.length;
        if (count) count.textContent = String(total);
        if (total === 0) {
          const empty = document.createElement('p');
          empty.className = 'gh-bbs__empty';
          empty.id = 'bbsEmpty';
          empty.textContent = 'まだ投稿がありません。最初の1件を書き込んでみましょう！';
          list.appendChild(empty);
        }
      })
      .catch(err => { console.warn('Supabase load failed → local fallback', err); startLocalBoard(); });
  }

  /* ---------- localStorage フォールバック（Supabase未読込/オフライン時） ---------- */
  function startLocalBoard() {
    const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; } };
    const persist   = a  => { try { localStorage.setItem(STORE_KEY, JSON.stringify(a)); } catch (e) {} };

    const saved = loadSaved();
    if (saved.length) { const e = document.getElementById('bbsEmpty'); if (e) e.remove(); }
    saved.forEach(p => list.insertBefore(makePost(p), list.firstElementChild));
    if (count) count.textContent = String(list.querySelectorAll('.gh-bbs__post').length);

    currentHandler = function post() {
      const text = body.value.trim();
      const name = (nameIn && nameIn.value.trim()) || '名無しのガチャー';
      const v = validate(name, text);
      if (!v.ok) { if (v.msg) alert(v.msg); else body.focus(); return; }
      const p = {
        num:  list.querySelectorAll('.gh-bbs__post').length + 1,
        name: name,
        body: text, date: nowStr(), id: randomId()
      };
      const empty = document.getElementById('bbsEmpty'); if (empty) empty.remove();
      list.insertBefore(makePost(p), list.firstElementChild);
      const arr = loadSaved(); arr.push(p); persist(arr);
      markPosted();
      if (count) count.textContent = String(p.num);
      body.value = '';
      const el = document.getElementById('res' + p.num);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }
})();

/* ── Chart bar tooltips ── */
document.querySelectorAll('.gh-chart__bar').forEach(bar => {
  bar.setAttribute('tabindex', '0');
  const tip = bar.querySelector('.gh-chart__tip');
  if (!tip) return;
  bar.addEventListener('mouseenter', () => { tip.style.opacity = '1'; });
  bar.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
  bar.addEventListener('focus',      () => { tip.style.opacity = '1'; });
  bar.addEventListener('blur',       () => { tip.style.opacity = '0'; });
});

/* ── Favourite button (detail tab) ── */
const favBtn = document.getElementById('favoriteBtn');
if (favBtn) {
  favBtn.addEventListener('click', () => {
    const on = favBtn.classList.toggle('is-faved');
    favBtn.textContent = on ? '♥ お気に入り済み' : '♡ お気に入り登録';
  });
}

/* ── Copy URL ── */
const copyBtn = document.getElementById('copyUrlBtn');
if (copyBtn) {
  copyBtn.addEventListener('click', async e => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(location.href);
      const orig = copyBtn.textContent;
      copyBtn.textContent = '✓ コピーしました';
      setTimeout(() => { copyBtn.textContent = orig; }, 2000);
    } catch { /* not available */ }
  });
}

/* ── Region filter tabs (area.html) ── */
document.querySelectorAll('[data-region]').forEach(btn => {
  if (!btn.matches('button')) return;
  btn.addEventListener('click', () => {
    btn.closest('.gh-tab-group').querySelectorAll('.gh-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const region = btn.dataset.region;
    document.querySelectorAll('.gh-area-section').forEach(sec => {
      sec.hidden = region !== 'all' && sec.dataset.region !== region;
    });
  });
});

/* ── News filter tabs (news.html) ── */
document.querySelectorAll('[data-news]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.gh-tab-group').querySelectorAll('.gh-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.news;
    document.querySelectorAll('#newsFeed .gh-news-article').forEach(art => {
      art.hidden = cat !== 'all' && art.dataset.news !== cat;
    });
  });
});

/* ── Generic tab group (period switcher, etc.) ── */
document.querySelectorAll('.gh-tab-group:not([data-tab-group-handled])').forEach(group => {
  group.setAttribute('data-tab-group-handled', '1');
  group.querySelectorAll('.gh-tab:not([data-tab]):not([data-filter]):not([data-region]):not([data-news])').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.gh-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});

/* ── Initial ranking render (ranking.html has empty tbody) ── */
renderRanking('national');

/* ── アクセス数を取得してランキングを並べ替え（index.html / ranking.html） ── */
(function () {
  if (!document.querySelector('#rankingTable tbody')) return;
  if (!(window.supabase && typeof window.supabase.createClient === 'function')) return;
  try {
    const sb = window.supabase.createClient(GH_SUPA_URL, GH_SUPA_KEY);
    sb.from('spot_views').select('spot,views')
      .then(({ data, error }) => {
        if (error || !data || !data.length) return;      // テーブル未作成なら台数順のまま
        GH_VIEWS = {};
        data.forEach(r => { GH_VIEWS[r.spot] = Number(r.views) || 0; });
        const active = document.querySelector('[data-tab].active');
        renderRanking(active ? active.dataset.tab : 'national');
      })
      .catch(() => { /* fallback: 台数順のまま */ });
  } catch (e) { /* fallback */ }
})();

/* ── 閲覧カウント（spot.html）: 裏側データとして記録。画面には出さない ──
   同じタブでの再読み込み連打はカウントしない（sessionStorage ガード）。 */
(function () {
  if (!document.getElementById('spotDetail')) return;
  const sid = (window.GH_SPOT_ID || '').replace(/^spot-/, '');
  if (!sid) return;
  if (!(window.supabase && typeof window.supabase.createClient === 'function')) return;
  const SEEN = 'gh-viewed:' + sid;
  try { if (sessionStorage.getItem(SEEN)) return; } catch (e) {}
  try {
    const sb = window.supabase.createClient(GH_SUPA_URL, GH_SUPA_KEY);
    sb.rpc('increment_spot_view', { p_spot: sid }).then(({ error }) => {
      if (!error) { try { sessionStorage.setItem(SEEN, '1'); } catch (e) {} }
    }).catch(() => {});
  } catch (e) {}
})();

/* ===========================================================================
   現在地から探すマップ（map.html）
   ★ このページの役目は「いまいる場所の近くにガチャがあるか」を一目で見せること。
      現在地を取る → 半径で絞る → 地図と一覧を "同じ並び・同じ番号" で描く、の順。
      番号を揃えているのは、地図のピンと一覧の行を目で往復できるようにするため。
   ★ 位置情報は端末の中だけで使い、サーバーにも localStorage にも保存しない。
   ★ Leaflet（CDN）が読めない環境でも一覧だけは動くよう、地図処理はすべて任意扱い。
   =========================================================================== */
(function () {
  var listBox = document.querySelector('[data-gh-map-list]');
  var mapEl = document.getElementById('osmMap');
  if (!listBox && !mapEl) return;                 /* map.html 以外では何もしない */

  var esc = function (s) {
    var d = document.createElement('div');
    d.textContent = (s == null ? '' : String(s));
    return d.innerHTML;
  };
  var machinesText = function (n) {
    return (n == null || n === '') ? '—' : '約' + Number(n).toLocaleString('ja-JP') + '台';
  };
  var ALL = (window.GH_SPOTS || []).filter(function (s) { return s.lat != null && s.lon != null; });

  var NEAR_LIMIT = 20;        /* 「範囲指定なし」で出す件数 */
  var FAR_LIMIT = 60;         /* 現在地なしのとき、地図に出すピンの上限 */
  var RADIUS_STEPS = [0.5, 1, 3, 5, 10];

  /* 2点間の距離（km・ハーバサイン）。国内の距離なら十分な精度 */
  function distKm(la1, lo1, la2, lo2) {
    var r = Math.PI / 180, R = 6371;
    var a = Math.pow(Math.sin((la2 - la1) * r / 2), 2) +
            Math.cos(la1 * r) * Math.cos(la2 * r) * Math.pow(Math.sin((lo2 - lo1) * r / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  /* 店舗の緯度経度は「施設のおよその位置」なので、1m単位まで出すと精度を偽ることになる。
     10m単位に丸め、50m未満はまとめて「50m以内」と表示する。 */
  function distText(km) {
    var m = km * 1000;
    if (m < 50) return '50m以内';
    return km < 1 ? Math.round(m / 10) * 10 + 'm' : (Math.round(km * 10) / 10) + 'km';
  }
  function radiusText(km) {
    return !km ? '範囲指定なし' : km < 1 ? Math.round(km * 1000) + 'm' : km + 'km';
  }
  /* 徒歩の目安（分速80m）。「1.2km」より「徒歩15分」のほうが行くかどうか決めやすい。
     100m未満は距離表示だけで足りるので添えない */
  function walkText(km) {
    if (km * 1000 < 100) return '';
    var min = Math.round(km * 1000 / 80);
    return min <= 1 ? 'すぐ' : min <= 40 ? '徒歩' + min + '分' : '';
  }

  var JST_TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  function isPreOpen(s) { return !!(s.opensOn && s.opensOn > JST_TODAY); }
  function soonText(s) { return s.opensOn.slice(5).split('-').map(Number).join('/'); }

  /* 検索の正規化（全角→半角・小文字化・ハイフン/#除去）。「Cpla」「#C-pla」を同一視 */
  function norm(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFKC'); } catch (e) {}
    return s.toLowerCase().replace(/[#\-‐‑–—−]/g, '');
  }
  var GENERIC = 'ガチャ ガチャガチャ ガチャポン ガシャポン カプセルトイ カプセル 専門店 店舗';

  /* ── 画面の状態 ─────────────────────────────────────────── */
  var st = {
    here: null,        /* [lat, lon]。現在地が取れていなければ null */
    acc: null,         /* 位置精度（m） */
    radiusKm: 1,       /* 0 = 範囲指定なし（近い順に上位だけ） */
    pref: '',
    minMachines: 0,
    query: '',
    viewportMode: false, /* true = 検索語・半径よりも、いま見えている地図範囲を優先 */
    selectedId: ''     /* 地図で開いている店舗。一覧側の強調表示にも使う */
  };

  /* ── 絞り込み ───────────────────────────────────────────── */
  function filtered() {
    var arr = ALL.filter(function (s) {
      if (st.pref && s.pref !== st.pref) return false;
      if (st.minMachines && !(Number(s.machines) >= st.minMachines)) return false;
      /* 地図を自分で動かした後は、検索語を外して「見えている範囲」を優先する。 */
      if (st.query && !st.viewportMode) {
        var terms = norm(st.query).split(/\s+/).filter(Boolean);
        var hay = norm([s.name, s.brand, s.area, s.pref, s.address, s.access]
          .map(function (f) { return f == null ? '' : String(f); }).join(' ') + ' ' + GENERIC);
        var flat = hay.replace(/\s+/g, '');
        var ok = terms.every(function (t) {
          return hay.indexOf(t) !== -1 || flat.indexOf(t.replace(/\s+/g, '')) !== -1;
        });
        if (!ok) return false;
      }
      return true;
    });

    /* 検索結果を入口に地図を広げたら、現在の表示範囲に入る全店舗を反映する。
       都道府県・台数の明示的なセレクト条件だけはそのまま尊重する。 */
    if (st.viewportMode && mapReady && map && typeof map.getBounds === 'function') {
      var bounds = map.getBounds();
      var inView = arr.filter(function (s) { return bounds.contains([s.lat, s.lon]); });
      if (st.here) {
        inView.sort(function (a, b) {
          return distKm(st.here[0], st.here[1], a.lat, a.lon) -
            distKm(st.here[0], st.here[1], b.lat, b.lon);
        });
      } else {
        inView.sort(function (a, b) { return (b.machines || 0) - (a.machines || 0); });
      }
      return { rows: inView, total: inView.length, nearestOutside: null };
    }

    /* 現在地なし：設置台数の多い順。ピンが多すぎると読めないので上限を掛ける */
    if (!st.here) {
      var byMach = arr.slice().sort(function (a, b) { return (b.machines || 0) - (a.machines || 0); });
      return { rows: byMach.slice(0, FAR_LIMIT), total: byMach.length, nearestOutside: null };
    }

    /* 現在地あり：距離順。半径の外は落とすが「1件も無い」で行き止まりにしないため
       いちばん近い1件を控えておき、半径を広げる提案に使う */
    var withDist = arr.map(function (s) {
      return { s: s, km: distKm(st.here[0], st.here[1], s.lat, s.lon) };
    }).sort(function (a, b) { return a.km - b.km; });

    if (!st.radiusKm) {
      return {
        rows: withDist.slice(0, NEAR_LIMIT).map(function (x) { return x.s; }),
        total: withDist.length, nearestOutside: null
      };
    }
    var inside = withDist.filter(function (x) { return x.km <= st.radiusKm; });
    return {
      rows: inside.map(function (x) { return x.s; }),
      total: inside.length,
      nearestOutside: inside.length ? null : (withDist[0] || null)
    };
  }

  /* いちばん近い店舗が収まる最小の既定半径。10kmでも届かなければ 0（指定なし） */
  function suggestRadius(km) {
    for (var i = 0; i < RADIUS_STEPS.length; i++) if (km <= RADIUS_STEPS[i]) return RADIUS_STEPS[i];
    return 0;
  }

  /* ── 一覧 ───────────────────────────────────────────────── */
  function directionsUrl(s) {
    /* 出発地をURLへ埋め込まない。Google マップ側が端末の現在地を使うため、
       このサイトから位置情報を外部へ渡さずに経路画面を開ける。 */
    return 'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(String(s.lat) + ',' + String(s.lon));
  }

  function rowHtml(s, i) {
    var km = st.here ? distKm(st.here[0], st.here[1], s.lat, s.lon) : null;
    var walk = km == null ? '' : walkText(km);
    var selected = st.selectedId === s.id;
    return '<div class="gh-map-spot-row' + (selected ? ' gh-map-spot-row--selected' : '') + '" ' +
      'data-gh-spot-row="' + esc(s.id) + '">' +
      '<a href="/spot/' + encodeURIComponent(s.id) + '.html" class="gh-map-spot' +
        (selected ? ' gh-map-spot--selected' : '') + '"' + (selected ? ' aria-current="location"' : '') + '>' +
        '<div class="gh-map-spot__num' + (i === 0 ? ' gh-map-spot__num--1' : '') + '">' + (i + 1) + '</div>' +
        '<div class="gh-map-spot__info">' +
          '<strong class="gh-map-spot__name">' + esc(s.name) +
            (isPreOpen(s) ? '<span class="gh-badge gh-badge--soon">' + esc(soonText(s)) + ' オープン予定</span>' : '') +
          '</strong>' +
          '<span class="gh-map-spot__area">' + esc(s.area) + '</span>' +
          '<div class="gh-map-spot__meta">' +
            (km == null ? '' : '<span class="gh-map-spot__dist">📍 ' + distText(km) +
              (walk ? '（' + walk + '）' : '') + '</span>') +
            '<span>🎰 ' + machinesText(s.machines) + '</span>' +
            '<span>🕒 ' + esc(s.hours || '—') + '</span>' +
          '</div>' +
        '</div>' +
      '</a>' +
      '<div class="gh-map-spot__actions">' +
        (mapReady ? '<button type="button" class="gh-map-spot__pin" data-gh-focus="' + esc(s.id) + '" ' +
          'aria-label="' + esc(s.name) + 'を地図で見る" aria-pressed="' + (selected ? 'true' : 'false') + '">地図</button>' : '') +
        '<a class="gh-map-spot__route" href="' + esc(directionsUrl(s)) + '" target="_blank" rel="noopener" ' +
          'aria-label="' + esc(s.name) + 'までの経路をGoogle マップで開く">経路</a>' +
      '</div>' +
    '</div>';
  }

  function renderList(res) {
    if (!listBox) return;
    var count = document.querySelector('.gh-map-list__count');
    var heading = document.querySelector('.gh-map-list__header strong');
    if (heading) heading.textContent = st.viewportMode ? '地図内のスポット' : (st.query ? '検索結果' : '周辺スポット');

    if (!res.rows.length) {
      var near = res.nearestOutside;
      var wide = near ? suggestRadius(near.km) : null;
      listBox.innerHTML = '<div class="gh-map-empty">' +
        '<p class="gh-map-empty__title">' +
          (st.viewportMode
            ? '現在の地図範囲内に、条件に合う店舗はありませんでした。'
            : st.here
            ? '現在地から' + radiusText(st.radiusKm) + '以内に、条件に合う店舗はありませんでした。'
            : '条件に合う店舗が見つかりませんでした。') +
        '</p>' +
        (near
          ? '<p class="gh-map-empty__text">いちばん近いのは <a href="/spot/' + encodeURIComponent(near.s.id) + '.html">' +
              esc(near.s.name) + '</a>（<strong>' + distText(near.km) + '</strong>・' + esc(near.s.area) + '）です。</p>' +
            '<button type="button" class="gh-btn gh-btn--primary gh-btn--sm" data-gh-widen="' + wide + '">' +
              (wide ? '半径' + radiusText(wide) + 'まで広げて表示' : '範囲をはずして近い順に表示') + '</button>'
          : '<p class="gh-map-empty__text">キーワードや条件を変えてお試しください。</p>') +
      '</div>';
      if (count) count.textContent = '0件';
      return;
    }

    listBox.innerHTML = res.rows.map(rowHtml).join('');
    if (count) {
      var capped = res.total > res.rows.length ? '（全' + res.total + '件中）' : '';
      count.textContent = st.viewportMode
        ? '表示範囲 ' + res.rows.length + '件'
        : st.here
        ? (st.radiusKm ? radiusText(st.radiusKm) + '以内 ' + res.rows.length + '件' : '近い順 ' + res.rows.length + '件' + capped)
        : '台数の多い順 ' + res.rows.length + '件' + capped;
    }
  }

  /* ── 結果サマリー（「一目でわかる」の要） ── */
  function renderSummary(res) {
    var box = document.querySelector('[data-gh-nearme-result]');
    if (!box) return;
    if (st.viewportMode) {
      if (st.here) {
        box.innerHTML = '地図を動かしたため、現在地の半径ではなく<strong>表示範囲内</strong>の店舗を表示しています。半径表示に戻すには範囲を選び直してください。';
        box.hidden = false;
      } else {
        box.hidden = true;
      }
      return;
    }
    if (!st.here) { box.hidden = true; return; }
    var n = res.rows.length;
    var txt = st.radiusKm
      ? '現在地から<strong>' + radiusText(st.radiusKm) + '以内</strong>に <strong class="gh-nearme__num">' + n + '件</strong>'
      : '現在地から近い順に <strong class="gh-nearme__num">' + n + '件</strong>';
    if (n) {
      var top = res.rows[0];
      var km = distKm(st.here[0], st.here[1], top.lat, top.lon);
      txt += '。いちばん近いのは <a href="/spot/' + encodeURIComponent(top.id) + '.html">' + esc(top.name) +
             '</a>（' + distText(km) + (walkText(km) ? '・' + walkText(km) : '') + '）';
    }
    box.innerHTML = txt;
    box.hidden = false;
  }

  /* ── 地図 ───────────────────────────────────────────────── */
  var map = null, mapReady = false;
  var spotLayer = null, meLayer = null;
  var markerById = {};

  function initMap() {
    if (!mapEl || typeof L === 'undefined') return false;
    map = L.map(mapEl, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    spotLayer = L.layerGroup().addTo(map);
    meLayer = L.layerGroup().addTo(map);
    /* ページスクロールを奪わないよう、クリックで初めてホイールズームを許可 */
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    mapReady = true;
    return true;
  }

  function popupHtml(s, km) {
    return '<strong>' + esc(s.name) + '</strong><br>' +
      (isPreOpen(s) ? '<span style="color:#c2410c;font-weight:700">' + esc(soonText(s)) + ' オープン予定</span><br>' : '') +
      (km == null ? '' : '<span style="color:#1d4ed8;font-weight:700">📍 現在地から' + distText(km) +
        (walkText(km) ? '（' + walkText(km) + '）' : '') + '</span><br>') +
      '<span style="color:#6b7280">' + esc(s.area) + '</span><br>' +
      '🎰 ' + machinesText(s.machines) + ' ・ 🕒 ' + esc(s.hours || '—') + '<br>' +
      '<div class="gh-map-popup__actions">' +
        '<a href="/spot/' + encodeURIComponent(s.id) + '.html">詳細・掲示板</a>' +
        '<a href="' + esc(directionsUrl(s)) + '" target="_blank" rel="noopener">経路を見る ↗</a>' +
      '</div>';
  }

  /* しずく型のピンを SVG で描く。先端（下の頂点）が店舗の座標に刺さるよう、
     iconAnchor を [幅/2, 高さ] にしている（丸ピンのように中心に置くと、
     見た目の位置が実際の座標より上にずれる）。中の数字は一覧の番号と同じ。 */
  function pinIcon(label, variant, big) {
    var w = big ? 34 : 28;
    var h = big ? 48 : 40;
    var fill = variant === 'soon' ? '#ea580c' : variant === 'first' ? '#e94560' : '#1d4ed8';
    var svg =
      '<svg class="gh-pin__svg" width="' + w + '" height="' + h + '" viewBox="0 0 28 40" ' +
        'aria-hidden="true" focusable="false">' +
        '<path d="M14 1a13 13 0 0 0-13 13c0 9.9 13 25 13 25s13-15.1 13-25A13 13 0 0 0 14 1z" ' +
          'fill="' + fill + '" stroke="#fff" stroke-width="2"/>' +
        '<text x="14" y="19" text-anchor="middle" fill="#fff" ' +
          'font-size="' + (String(label).length > 2 ? 11 : 13) + '" font-weight="700" ' +
          'font-family="system-ui, -apple-system, sans-serif">' + esc(label) + '</text>' +
      '</svg>';
    return L.divIcon({
      className: 'gh-pin-wrap' + (big ? ' gh-pin-wrap--first' : ''),
      html: svg,
      iconSize: [w, h],
      iconAnchor: [Math.round(w / 2), h],     /* 先端を座標に合わせる */
      popupAnchor: [0, -h + 4]
    });
  }

  function drawSpots(rows) {
    if (!mapReady) return [];
    spotLayer.clearLayers();
    markerById = {};
    var pts = [];
    rows.forEach(function (s, i) {
      var km = st.here ? distKm(st.here[0], st.here[1], s.lat, s.lon) : null;
      var variant = isPreOpen(s) ? 'soon' : (i === 0 ? 'first' : '');
      var m = L.marker([s.lat, s.lon], {
        icon: pinIcon(i + 1, variant, i === 0),
        title: s.name,
        /* 近い順の上位を手前に重ねる（ピンが密集する繁華街で1番が隠れないように） */
        zIndexOffset: Math.max(0, 1000 - i)
      }).addTo(spotLayer);
      m.bindPopup(popupHtml(s, km));
      /* ピンを選ぶと右の一覧でも同じ店舗を強調する。 */
      m.on('click', function () { selectSpot(s.id, true); });
      markerById[s.id] = m;
      pts.push([s.lat, s.lon]);
    });
    return pts;
  }

  function drawMe() {
    if (!mapReady) return;
    meLayer.clearLayers();
    if (!st.here) return;
    /* 位置精度の円（薄い）→ 検索半径の円（破線）→ 現在地の点、の重ね順 */
    if (st.acc && st.acc > 30) {
      L.circle(st.here, { radius: st.acc, weight: 0, fillColor: '#1d4ed8', fillOpacity: .08, interactive: false })
        .addTo(meLayer);
    }
    if (st.radiusKm && !st.viewportMode) {
      L.circle(st.here, {
        radius: st.radiusKm * 1000, color: '#1d4ed8', weight: 1.5, dashArray: '5,5',
        fillColor: '#1d4ed8', fillOpacity: .04, interactive: false
      }).addTo(meLayer);
    }
    L.circleMarker(st.here, { radius: 8, color: '#fff', weight: 3, fillColor: '#1d4ed8', fillOpacity: 1 })
      .addTo(meLayer).bindPopup('現在地');
  }

  function fitView(pts) {
    if (!mapReady) return;
    var all = (pts || []).slice();
    if (st.here) {
      all.push(st.here);
      /* 半径の円が画面に収まるよう、円の外周も範囲に入れる（約111km=1度で換算） */
      if (st.radiusKm && !st.viewportMode) {
        var d = st.radiusKm / 111;
        all.push([st.here[0] + d, st.here[1]]);
        all.push([st.here[0] - d, st.here[1]]);
      }
    }
    /* ピンは座標から上に伸びるので、上側の余白を厚めに取って頭が切れないようにする */
    var fitOpts = { paddingTopLeft: [40, 56], paddingBottomRight: [40, 24], maxZoom: 17, animate: false };
    suppressViewportRefresh = true;
    if (all.length > 1) map.fitBounds(all, fitOpts);
    else if (all.length === 1) map.setView(all[0], 15, { animate: false });
    else map.setView([35.68, 139.76], 9, { animate: false });
    suppressViewportRefresh = false;
  }

  function render(opts) {
    var res = filtered();
    if (st.selectedId && !res.rows.some(function (s) { return s.id === st.selectedId; })) {
      st.selectedId = '';
    }
    renderList(res);
    renderSummary(res);
    var pts = drawSpots(res.rows);
    drawMe();
    if (!opts || opts.fit !== false) fitView(pts);
  }

  /* ── 現在地の取得 ── */
  function setStatus(msg, kind) {
    var el = document.querySelector('[data-gh-locate-status]');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'gh-nearme__status' + (kind ? ' gh-nearme__status--' + kind : '');
    el.hidden = !msg;
  }

  function locate() {
    var btn = document.querySelector('[data-gh-locate]');
    if (!navigator.geolocation) {
      setStatus('このブラウザは位置情報に対応していません。駅名やエリア名での検索をお使いください。', 'warn');
      return;
    }
    st.viewportMode = false;
    ghTrack('nearby_search', { map_context: 'current_location' });
    if (btn) { btn.disabled = true; btn.textContent = '現在地を取得中…'; }
    setStatus('現在地を取得しています…');
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        st.here = [pos.coords.latitude, pos.coords.longitude];
        st.acc = pos.coords.accuracy;
        if (btn) { btn.disabled = false; btn.textContent = '現在地を再取得'; }
        setStatus('現在地を取得しました（誤差およそ' + Math.round(st.acc) + 'm）。位置情報は端末の中だけで使い、送信していません。', 'ok');
        render();
        var anchor = document.querySelector('[data-gh-nearme-result]');
        if (anchor && anchor.scrollIntoView) {
          try { anchor.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        }
      },
      function (err) {
        if (btn) { btn.disabled = false; btn.textContent = '現在地から探す'; }
        var msg = err && err.code === 1
          ? '位置情報の利用が許可されていません。ブラウザの設定で位置情報を許可すると使えます。'
          : err && err.code === 3
            ? '位置情報の取得に時間がかかっています。電波の良い場所でもう一度お試しください。'
            : '位置情報を取得できませんでした。駅名やエリア名での検索をお使いください。';
        setStatus(msg, 'warn');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  /* ── 操作の配線 ─────────────────────────────────────────── */
  var suppressViewportRefresh = false;
  var ignoreNextMoveEnd = false;
  initMap();

  /* 検索で移動したときは結果を維持し、利用者自身が地図を動かしたときだけ
     「表示範囲の店舗」へ切り替える。 */
  function activateViewportMode() {
    if (!mapReady || suppressViewportRefresh) return;
    if (ignoreNextMoveEnd) { ignoreNextMoveEnd = false; return; }
    st.viewportMode = true;
    st.query = '';
    var mapInput = document.querySelector('.gh-map-search-input');
    if (mapInput) mapInput.value = '';
    render({ fit: false });
  }
  if (mapReady) {
    map.on('moveend', activateViewportMode);
    /* ポップアップが端で自動的に地図をずらした場合は、利用者の地図操作として扱わない。 */
    map.on('autopanstart', function () { ignoreNextMoveEnd = true; });
  }

  /* 都道府県セレクトは実データから作る（掲載の無い県を選べないようにする） */
  (function buildPrefSelect() {
    var sel = document.querySelector('[data-gh-pref]');
    if (!sel) return;
    var counts = {};
    ALL.forEach(function (s) { counts[s.pref] = (counts[s.pref] || 0) + 1; });
    var prefs = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    sel.innerHTML = '<option value="">都道府県：すべて</option>' + prefs.map(function (p) {
      return '<option value="' + esc(p) + '">' + esc(p) + '（' + counts[p] + '件）</option>';
    }).join('');
  })();

  var locBtns = document.querySelectorAll('[data-gh-locate]');
  for (var i = 0; i < locBtns.length; i++) locBtns[i].addEventListener('click', locate);

  var radiusSel = document.querySelector('[data-gh-radius]');
  if (radiusSel) {
    st.radiusKm = Number(radiusSel.value || 1);
    radiusSel.addEventListener('change', function () {
      st.viewportMode = false;
      st.radiusKm = Number(radiusSel.value || 0);
      render();
    });
  }
  var prefSel = document.querySelector('[data-gh-pref]');
  if (prefSel) prefSel.addEventListener('change', function () {
    st.viewportMode = false;
    st.pref = prefSel.value;
    render();
  });

  var machSel = document.querySelector('[data-gh-min-machines]');
  if (machSel) machSel.addEventListener('change', function () {
    st.minMachines = Number(machSel.value || 0);
    render({ fit: !st.viewportMode });
  });

  var form = document.querySelector('.gh-map-search-form');
  var input = document.querySelector('.gh-map-search-input');
  if (form && input) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      st.viewportMode = false;
      st.query = input.value.trim();
      if (st.query) ghTrack('search_submit', { search_term: st.query, search_location: 'map' });
      render();
    });
  }

  function focusSpot(id) {
    var m = markerById[id];
    if (!m || !mapReady) return;
    selectSpot(id, false);
    suppressViewportRefresh = true;
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 16), { animate: false });
    suppressViewportRefresh = false;
    m.openPopup();
    if (mapEl && mapEl.scrollIntoView) {
      try { mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }
  }

  function selectSpot(id, scrollList) {
    st.selectedId = id || '';
    if (!listBox) return;

    var rows = listBox.querySelectorAll('[data-gh-spot-row]');
    var selectedRow = null;
    for (var i = 0; i < rows.length; i++) {
      var active = rows[i].getAttribute('data-gh-spot-row') === st.selectedId;
      rows[i].classList.toggle('gh-map-spot-row--selected', active);
      var link = rows[i].querySelector('.gh-map-spot');
      var pin = rows[i].querySelector('[data-gh-focus]');
      if (link) {
        link.classList.toggle('gh-map-spot--selected', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
      if (pin) pin.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) selectedRow = rows[i];
    }

    /* PCの一覧がスクロール領域になっている場合だけ、該当行を領域内へ移動する。
       スマホではページ全体を勝手に下へ飛ばさない。 */
    if (scrollList && selectedRow) {
      var panel = selectedRow.closest('.gh-map-list');
      if (panel && panel.scrollHeight > panel.clientHeight) {
        var targetTop = panel.scrollTop + selectedRow.getBoundingClientRect().top -
          panel.getBoundingClientRect().top - 48;
        if (typeof panel.scrollTo === 'function') panel.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        else panel.scrollTop = Math.max(0, targetTop);
      }
    }
  }

  /* 一覧の「地図」ボタン→該当ピンを開く。行そのものは詳細ページへのリンクのまま */
  if (listBox) {
    listBox.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var widen = t.closest('[data-gh-widen]');
      if (widen) {
        e.preventDefault();
        st.viewportMode = false;
        st.radiusKm = Number(widen.getAttribute('data-gh-widen') || 0);
        if (radiusSel) radiusSel.value = String(st.radiusKm);
        render();
        return;
      }
      var pin = t.closest('[data-gh-focus]');
      if (pin) {
        e.preventDefault();
        focusSpot(pin.getAttribute('data-gh-focus'));
      }
    });
  }

  /* 初期描画（現在地なし＝台数の多い順） */
  render();

  /* 他ページから ?near=1 で来たら、そのまま現在地取得へ進む */
  try {
    if (new URLSearchParams(location.search).get('near') === '1') locate();
  } catch (e) {}
})();

/* 主要な回遊リンクは遷移直前にイベントを送る。委譲で動的描画にも対応。 */
document.addEventListener('click', function (event) {
  var target = event.target && event.target.closest ? event.target.closest('a[href]') : null;
  if (!target) return;
  var href = target.getAttribute('href') || '';
  if (/^\/spot\/[a-z0-9_-]+\.html(?:#.*)?$/i.test(href)) {
    ghTrack('store_detail_click', { link_url: href });
  } else if (/google\.com\/maps|openstreetmap\.org/.test(target.href || '')) {
    ghTrack('route_click', { link_url: target.href });
  } else if (/\/area\/[a-z0-9-]+\.html$/i.test(href)) {
    ghTrack('area_page_click', { link_url: href });
  } else if (/\/brand\/[a-z0-9-]+\.html$/i.test(href)) {
    ghTrack('brand_page_click', { link_url: href });
  } else if (/\/guide\/[a-z0-9-]+\.html$/i.test(href)) {
    ghTrack('guide_page_click', { link_url: href });
  } else if (/\/releases\/\d{4}-\d{2}\.html$/i.test(href)) {
    ghTrack('release_hub_click', { link_url: href });
  } else if (target.classList.contains('gh-official-source') || target.classList.contains('gh-rel__src')) {
    ghTrack('official_source_click', { link_url: target.href });
  }
});

/* ── 言語ヒントバナー：非日本語ブラウザに英語ガイドを案内（英語ページ以外） ── */
(function () {
  try {
    if (/english\.html/.test(location.pathname)) return;
    if (/^ja/i.test(navigator.language || 'ja')) return;
    if (localStorage.getItem('gh-lang-hint-closed')) return;
    const bar = document.createElement('div');
    bar.className = 'gh-langbar';
    bar.innerHTML =
      '<span>🌐 Visiting from abroad?</span>' +
      '<a href="/english.html">Read our English guide to gachapon stores →</a>' +
      '<button type="button" class="gh-langbar__close" aria-label="Close">×</button>';
    bar.querySelector('.gh-langbar__close').addEventListener('click', () => {
      bar.remove();
      try { localStorage.setItem('gh-lang-hint-closed', '1'); } catch (e) {}
    });
    document.body.prepend(bar);
  } catch (e) { /* no-op */ }
})();

/* ===========================================================================
   トップページのライブ更新モジュール
   Supabase の posts を定期取得し、ユーザー投稿から作られるセクションを
   まとめて描き直す。ページを開いたままでも中身と経過時間が進み続ける。

   ・掲示板フィード  [data-gh-community-feed]
   ・急上昇ワード    [data-gh-trending]
   ・最新画像        [data-gh-photos]
   ・新着口コミ      [data-gh-recent-reviews]
   ・今日話題の商品  [data-gh-hot-items]（発売情報×掲示板での言及数）
   ・活発な掲示板    [data-gh-active-boards]
   ・ライブ状況      [data-gh-live-status]

   取得できないとき（オフライン・RLS変更など）は各セクションを非表示のままにし、
   既存の他セクションには影響させない。
   ※ posts に likes / image_url など列が増えた場合は自動で表示に反映される
     （行に含まれていれば使い、無ければ出さない設計）。
   =========================================================================== */
(function () {
  const $ = sel => document.querySelector(sel);
  const feedBox   = $('[data-gh-community-feed]');
  const trendBox  = $('[data-gh-trending]');
  const photoBox  = $('[data-gh-photos]');
  const reviewBox = $('[data-gh-recent-reviews]');
  const hotBox    = $('[data-gh-hot-items]');
  const activeBox = $('[data-gh-active-boards]');
  const statusBox = $('[data-gh-live-status]');
  const plazaBox  = $('[data-gh-plaza]');
  const inviteBox = $('[data-gh-invite]');
  if (!window.fetch) return;
  if (!feedBox && !trendBox && !photoBox && !reviewBox && !hotBox && !activeBox && !statusBox && !plazaBox) return;

  const POLL_MS = 60000;   /* 投稿の再取得間隔 */
  const TICK_MS = 15000;   /* 「○分前」の再計算間隔 */
  const LIMIT   = 100;

  const esc = s => { const d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; };
  const spots = () => window.GH_SPOTS || [];

  const ago = iso => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (!(m >= 0)) return '';
    if (m < 1) return 'たった今';
    if (m < 60) return m + '分前';
    const h = Math.floor(m / 60);
    if (h < 24) return h + '時間前';
    const d = Math.floor(h / 24);
    return d < 30 ? d + '日前' : new Date(iso).toLocaleDateString('ja-JP');
  };
  /* 経過時間はあとから書き換えられるよう <time data-ts> で出す */
  const agoTag = (iso, cls) =>
    '<time class="' + cls + '" data-ts="' + esc(iso) + '" datetime="' + esc(iso) + '">' + esc(ago(iso)) + '</time>';
  function tickTimes(root) {
    (root || document).querySelectorAll('[data-ts]').forEach(el => {
      const s = ago(el.getAttribute('data-ts'));
      if (s && el.textContent !== s) el.textContent = s;
    });
  }

  const dateLabel = iso => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const p = n => String(n).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + d.getDate() + '(' + days[d.getDay()] + ') ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  const storeOf = spot => {
    const sid = String(spot || '').replace(/^spot-/, '');
    return spots().find(s => s.id === sid) || null;
  };
  const boardHref = store => (store ? '/spot/' + encodeURIComponent(store.id) + '.html#board' : '/board.html');
  const spotHref  = store => (store ? '/spot/' + encodeURIComponent(store.id) + '.html' : '/board.html');

  /* 投稿に紐づく画像URL（将来 image_url 列が増えても、本文中のURLでも拾える） */
  const IMG_RE = /https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s"'<>]*)?/ig;
  function photosOf(p) {
    const out = [];
    if (p.image_url) out.push(String(p.image_url));
    if (p.photo) out.push(String(p.photo));
    const m = String(p.body || '').match(IMG_RE);
    if (m) m.forEach(u => out.push(u));
    return out.filter(u => /^https:\/\//i.test(u));
  }
  const hasPhoto = p => photosOf(p).length > 0;
  /* 画像をサムネイルで見せるので、本文からは画像URLを取り除いて読みやすくする */
  const textOf = p => String(p.body || '').replace(IMG_RE, '').replace(/[ \t]{2,}/g, ' ').trim();

  /* 表示名から色と頭文字を決めるアバター。同じ名前なら常に同じ見た目になる。
     （写真ではなく名前から作るだけなので、無い情報を作っていることにはならない） */
  const AV_COLORS = ['#e94560', '#ff8c42', '#f59e0b', '#16a34a', '#0ea5e9',
                     '#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#64748b'];
  function avatarHtml(name, cls) {
    const s = String(name || '名無しのガチャー');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
    const ch = Array.from(s)[0] || '？';
    return '<span class="gh-av ' + (cls || '') + '" style="background:' + AV_COLORS[h % AV_COLORS.length] + '"' +
      ' aria-hidden="true">' + esc(ch) + '</span>';
  }

  /* 板ごとにレス番号を振り、本文の「>>番号」から返信数を数える。
     取得できている範囲での実数。数が無ければ何も出さない（作らない）。 */
  function replyIndex(rows) {
    const byBoard = {};
    rows.forEach(p => { (byBoard[p.spot] = byBoard[p.spot] || []).push(p); });
    const num = {}, replies = {};
    Object.keys(byBoard).forEach(spot => {
      const list = byBoard[spot].slice()
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      const byNum = {};
      list.forEach((p, i) => { num[String(p.id)] = i + 1; byNum[i + 1] = p; });
      list.forEach(p => {
        const m = String(p.body || '').match(/(?:>>|＞＞|»)\s*(\d+)/g);
        if (!m) return;
        m.forEach(t => {
          const n = Number(String(t).replace(/[^0-9]/g, ''));
          const target = byNum[n];
          if (target && String(target.id) !== String(p.id)) {
            replies[String(target.id)] = (replies[String(target.id)] || 0) + 1;
          }
        });
      });
    });
    return { num: num, replies: replies };
  }

  /* いいね：posts に likes 列があるときだけ有効になる。
     列が無い間はボタンを出さない（押せないボタンを置かない）。 */
  const likedKey = 'gh-liked';
  function likedSet() {
    try { return new Set(JSON.parse(localStorage.getItem(likedKey) || '[]')); }
    catch (e) { return new Set(); }
  }
  function markLiked(id) {
    try {
      const set = likedSet(); set.add(String(id));
      localStorage.setItem(likedKey, JSON.stringify(Array.from(set)));
    } catch (e) {}
  }

  /* 5ch風の匿名ID（投稿ごとに安定） */
  const shortId = str => {
    let h = 2166136261 >>> 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 6; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; out += c[(h >>> 16) % 62]; }
    return out;
  };

  /* ── 状態 ── */
  const state = {
    seen: new Set(),      /* 既に表示した投稿id（新着ハイライト判定に使う） */
    first: true,          /* 初回描画かどうか */
    total: null,          /* Supabase 側の総投稿数（Content-Range から取得） */
    lastAt: null,         /* 最終取得時刻 */
    newCount: 0           /* 前回取得以降に増えた件数 */
  };

  /* ── ① ライブ状況バー ── */
  function renderStatus(rows) {
    if (!statusBox) return;
    const todayJst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const today = rows.filter(p => {
      const d = new Date(new Date(p.created_at).getTime() + 9 * 3600 * 1000);
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === todayJst;
    }).length;
    const boards = new Set(rows.map(p => p.spot)).size;
    const total = state.total == null ? rows.length : state.total;
    statusBox.innerHTML =
      '<span class="gh-live__dot" aria-hidden="true"></span>' +
      '<span class="gh-live__label">みんなの投稿</span>' +
      '<span class="gh-live__stat"><strong>' + total.toLocaleString('ja-JP') + '</strong>件</span>' +
      '<span class="gh-live__sep" aria-hidden="true">/</span>' +
      '<span class="gh-live__stat">本日 <strong>' + today + '</strong>件</span>' +
      '<span class="gh-live__sep" aria-hidden="true">/</span>' +
      '<span class="gh-live__stat">板 <strong>' + boards + '</strong></span>' +
      (state.newCount > 0 ? '<span class="gh-live__new">新着 ' + state.newCount + '件</span>' : '') +
      '<span class="gh-live__updated">更新 ' +
        (state.lastAt ? agoTag(state.lastAt, 'gh-live__updated-time') : '—') + '</span>';
    statusBox.hidden = false;
  }

  /* いちばん書き込みが多い板（投稿導線の行き先に使う） */
  function busiestBoard(counts) {
    const spot = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return spot ? storeOf(spot) : null;
  }

  /* ── 広場の顔ぶれ：直近に書き込んだ人のアイコンを並べる ── */
  function renderPlaza(rows, counts) {
    if (!plazaBox) return;
    const seen = [];
    rows.forEach(p => {
      const n = String(p.name || '名無しのガチャー');
      if (seen.length < 7 && seen.indexOf(n) === -1) seen.push(n);
    });
    if (!seen.length) return;
    const store = busiestBoard(counts);
    plazaBox.innerHTML =
      '<span class="gh-plaza__faces">' + seen.map(n => avatarHtml(n, 'gh-av--face')).join('') + '</span>' +
      '<span class="gh-plaza__text">' +
        '<strong>' + esc(seen[0]) + '</strong> さんたちが書き込んでいます' +
        '<small>入荷・在庫・混雑のひとことが、次に行く誰かの役に立ちます</small>' +
      '</span>' +
      '<a class="gh-plaza__cta" href="' + boardHref(store) + '">✏️ あなたも書き込む</a>';
    plazaBox.hidden = false;
  }

  /* ── 投稿のお誘い（フィードの下） ── */
  function renderInvite(rows, counts) {
    if (!inviteBox) return;
    const store = busiestBoard(counts);
    inviteBox.innerHTML =
      '<img class="gh-invite__icon" src="/assets/mascot-icon.png" alt="" width="44" height="44" />' +
      '<span class="gh-invite__body">' +
        '<strong class="gh-invite__title">あなたのガチャ活も教えてください</strong>' +
        '<small class="gh-invite__note">' +
          '「○○店に△△が入荷してた」「土曜の夕方は空いてた」だけでも助かります。' +
          '登録不要・名前なしで書き込めます。</small>' +
      '</span>' +
      '<span class="gh-invite__actions">' +
        '<a class="gh-btn gh-btn--primary gh-invite__go" href="' + boardHref(store) + '">' +
          '✏️ <span>' + esc(store ? store.name : '掲示板') + '</span> の掲示板へ</a>' +
        '<a class="gh-btn" href="/stores.html">よく行く店を探す</a>' +
      '</span>';
    inviteBox.hidden = false;
  }

  /* ── ② 掲示板フィード（トップの主役＝人） ── */
  function renderFeed(rows, counts) {
    if (!feedBox) return;
    const list = rows.slice(0, 12);
    if (!list.length) return;
    const idx = replyIndex(rows);
    const liked = likedSet();
    /* likes 列を実際に持っている投稿（＝DB上の実投稿）にだけ、いいねを出す */
    const hasLikes = p => p && Object.prototype.hasOwnProperty.call(p, 'likes');
    feedBox.innerHTML = list.map(p => {
      const store = storeOf(p.spot);
      const where = store ? store.name : '総合掲示板';
      const area = store ? store.area : '';
      const href = boardHref(store);
      const raw = textOf(p);
      const body = raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
      const threadCount = counts[p.spot] || 1;
      const likes = Number(p.likes);
      const pics = photosOf(p);
      const resNo = idx.num[String(p.id)];
      const replyN = idx.replies[String(p.id)] || 0;
      const isLiked = liked.has(String(p.id));
      /* 初回表示では光らせない。2回目以降に増えた投稿だけをハイライトする */
      const isNew = !state.first && !state.seen.has(String(p.id));
      return '<article class="gh-post' + (isNew ? ' gh-post--new' : '') + '">' +
        (isNew ? '<span class="gh-post__newbadge">NEW</span>' : '') +
        '<div class="gh-post__head">' +
          avatarHtml(p.name, 'gh-av--post') +
          '<span class="gh-post__name">' + esc(p.name || '名無しのガチャー') + '</span>' +
          (resNo ? '<span class="gh-post__no">' + resNo + '</span>' : '') +
          '<span class="gh-post__date">' + esc(dateLabel(p.created_at)) + '</span>' +
          '<span class="gh-post__id">ID:' + esc(shortId(String(p.id || '') + p.created_at)) + '</span>' +
          agoTag(p.created_at, 'gh-post__ago') +
        '</div>' +
        '<a class="gh-post__body" href="' + href + '">' + esc(body) + '</a>' +
        (pics.length
          ? '<a class="gh-post__thumb" href="' + href + '"><img src="' + esc(pics[0]) +
            '" alt="" loading="lazy" referrerpolicy="no-referrer" /></a>'
          : '') +
        '<div class="gh-post__foot">' +
          '<a class="gh-post__store" href="' + spotHref(store) + '">' +
            '🏬 ' + esc(where) + (area ? '<span class="gh-post__area">' + esc(area) + '</span>' : '') +
          '</a>' +
          '<span class="gh-post__stats">' +
            (pics.length ? '<span class="gh-post__stat gh-post__stat--photo" title="写真あり">📷 ' + pics.length + '</span>' : '') +
            (replyN ? '<a class="gh-post__stat gh-post__stat--link" href="' + href + '" title="この投稿への返信">↩ ' + replyN + '</a>' : '') +
            (hasLikes(p)
              ? '<button type="button" class="gh-post__like' + (isLiked ? ' is-liked' : '') + '" data-like="' + esc(String(p.id)) + '" ' +
                'aria-pressed="' + (isLiked ? 'true' : 'false') + '" aria-label="いいね">' +
                '<span aria-hidden="true">♥</span><span class="gh-post__like-n">' + (Number.isFinite(likes) ? likes : 0) + '</span></button>'
              : '') +
            '<a class="gh-post__stat gh-post__stat--link" href="' + href + '" title="この板の書き込み数">💬 ' + threadCount + '</a>' +
            '<a class="gh-post__reply" href="' + href + '">返信する</a>' +
          '</span>' +
        '</div>' +
      '</article>';
    }).join('');
    wireLikes();
    /* 読めない画像はサムネごと消す（リンク切れの枠を残さない） */
    dropBrokenImages(feedBox.querySelectorAll('.gh-post__thumb img'), img => {
      const t = img.closest('.gh-post__thumb');
      if (t) t.remove();
    });
    const sec = feedBox.closest('.gh-community-sec');
    if (sec) sec.hidden = false;
  }

  /* いいね：クリックで Supabase の RPC を呼ぶ。押した記録はこの端末に残して
     二重送信を防ぐ。RPC が無い環境では見た目を元に戻すだけで、数は作らない。 */
  let likesWired = false;
  function wireLikes() {
    if (likesWired || !feedBox) return;
    likesWired = true;
    feedBox.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-like]');
      if (!btn || btn.classList.contains('is-liked')) return;
      ev.preventDefault();
      const id = btn.getAttribute('data-like');
      const nEl = btn.querySelector('.gh-post__like-n');
      const before = Number(nEl.textContent) || 0;
      btn.classList.add('is-liked');
      btn.setAttribute('aria-pressed', 'true');
      nEl.textContent = before + 1;
      fetch(GH_SUPA_URL + '/rest/v1/rpc/gh_like_post', {
        method: 'POST',
        headers: {
          apikey: GH_SUPA_KEY,
          Authorization: 'Bearer ' + GH_SUPA_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ post_id: id })
      })
        .then(r => { if (!r.ok) throw new Error('http ' + r.status); markLiked(id); })
        .catch(() => {                       /* 送れなかったら見た目を戻す */
          btn.classList.remove('is-liked');
          btn.setAttribute('aria-pressed', 'false');
          nEl.textContent = before;
        });
    });
  }

  /* ── ③ 急上昇ワード（実投稿＋掲載データから算出。捏造しない） ── */
  function renderTrending(rows, counts) {
    if (!trendBox) return;
    if (!rows.length) return;
    const score = {};
    const bump = (w, n) => { if (w && w.length >= 2) score[w] = (score[w] || 0) + n; };
    Object.keys(counts).forEach(spot => {
      const store = storeOf(spot);
      if (!store) return;
      const areaWord = (store.area || '').split('・')[1] || store.area;
      bump(areaWord, counts[spot] * 3);
      bump((store.brand || '').replace(/（.*?）/g, ''), counts[spot] * 2);
    });
    const known = new Set();
    spots().forEach(s => {
      const a = (s.area || '').split('・')[1] || s.area;
      if (a) known.add(a);
      const b = (s.brand || '').replace(/（.*?）/g, '');
      if (b) known.add(b);
    });
    /* 発売中の商品名（data/releases.js）も候補に加える＝いま話題の語を拾う */
    releaseKeywords().forEach(k => known.add(k.word));
    rows.forEach(p => {
      const body = String(p.body || '');
      known.forEach(w => { if (w.length >= 2 && body.indexOf(w) !== -1) bump(w, 3); });
    });
    const areaCount = {};
    spots().forEach(s => {
      const a = (s.area || '').split('・')[1] || s.area;
      if (a) areaCount[a] = (areaCount[a] || 0) + 1;
    });
    Object.keys(areaCount).forEach(a => bump(a, Math.min(areaCount[a], 4)));

    const words = Object.keys(score).sort((a, b) => score[b] - score[a]).slice(0, 8);
    if (!words.length) return;
    trendBox.innerHTML = words.map((w, i) => {
      const rankCls = i < 3 ? ' gh-trend__item--hot' : '';
      return '<a class="gh-trend__item' + rankCls + '" href="/stores.html?q=' + encodeURIComponent(w) + '">' +
        '<span class="gh-trend__rank">' + (i + 1) + '</span>' +
        '<span class="gh-trend__word">' + esc(w) + '</span>' +
      '</a>';
    }).join('');
    const sec = trendBox.closest('.gh-trend-sec');
    if (sec) sec.hidden = false;
  }

  /* ── ④ 最新画像（投稿に含まれる画像だけ。無ければセクションごと非表示） ── */
  function renderPhotos(rows) {
    if (!photoBox) return;
    const items = [];
    rows.forEach(p => {
      photosOf(p).forEach(u => {
        if (items.length < 8 && !items.some(x => x.url === u)) items.push({ url: u, post: p });
      });
    });
    if (!items.length) return;
    photoBox.innerHTML = items.map(it => {
      const store = storeOf(it.post.spot);
      return '<a class="gh-photo" href="' + boardHref(store) + '" title="' + esc(store ? store.name : '総合掲示板') + '">' +
        '<img src="' + esc(it.url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" />' +
        '<span class="gh-photo__meta">' + esc(store ? store.name : '総合掲示板') + '</span>' +
      '</a>';
    }).join('');
    const sec = photoBox.closest('.gh-photo-sec');
    /* 1枚でも実際に表示できたときだけセクションを出す。
       全部リンク切れなら空の枠を出さない（ここが「動いていない」印象の元になるため） */
    const show = () => { if (sec) sec.hidden = false; };
    dropBrokenImages(photoBox.querySelectorAll('.gh-photo img'), img => {
      const t = img.closest('.gh-photo');
      if (t) t.remove();
      if (!photoBox.querySelector('.gh-photo') && sec) sec.hidden = true;
    }, show);
  }

  /* 画像の読み込み結果に応じて後始末する。
     innerHTML 直後は既に error/load が済んでいる場合があるので complete も見る。 */
  function dropBrokenImages(imgs, onBroken, onOk) {
    Array.prototype.forEach.call(imgs, img => {
      const broken = () => onBroken(img);
      const ok = () => { if (onOk) onOk(img); };
      if (img.complete) { (img.naturalWidth ? ok : broken)(); return; }
      img.addEventListener('error', broken, { once: true });
      img.addEventListener('load', ok, { once: true });
    });
  }

  /* ── ⑤ 新着口コミ ── */
  function renderReviews(rows) {
    if (!reviewBox) return;
    const list = rows.filter(p => textOf(p).length >= 30).slice(0, 4);
    if (!list.length) return;
    reviewBox.innerHTML = list.map(p => {
      const store = storeOf(p.spot);
      const where = store ? store.name : '総合掲示板';
      const href = boardHref(store);
      const raw = textOf(p);
      const body = raw.length > 110 ? raw.slice(0, 110) + '…' : raw;
      return '<a class="gh-review" href="' + href + '">' +
        '<p class="gh-review__body">' + esc(body) + '</p>' +
        '<span class="gh-review__meta">' +
          avatarHtml(p.name, 'gh-av--sm') +
          '<span class="gh-review__who">' +
            '<strong>' + esc(where) + '</strong>' +
            '<span>' + esc(p.name || '名無しのガチャー') + '・' + agoTag(p.created_at, 'gh-review__ago') + '</span>' +
          '</span>' +
        '</span>' +
      '</a>';
    }).join('');
    const sec = reviewBox.closest('.gh-review-sec');
    if (sec) sec.hidden = false;
  }

  /* ── ⑥ 今日話題の商品 ──
     data/releases.js の発売情報に、掲示板での言及数を掛け合わせて並べ替える。
     言及があるものは「掲示板で N件」を出し、無ければ出さない（数を作らない）。 */
  function releaseKeywords() {
    return (window.GH_RELEASES || [])
      .filter(r => r && r.date && r.title)
      .map(r => {
        const t = String(r.title);
        const q = t.match(/[『「]([^』」]+)[』」]/);       /* 『チェンソーマン レゼ篇』→ チェンソーマン */
        const word = (q ? q[1] : t).split(/[\s　]/)[0];
        return { release: r, word: word };
      })
      .filter(k => k.word && k.word.length >= 2);
  }
  function renderHotItems(rows) {
    if (!hotBox) return;
    const bodies = rows.map(p => String(p.body || ''));
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    const today = now.toISOString().slice(0, 10);
    const dayMs = 86400000;
    const diff = d => Math.round((new Date(d + 'T00:00:00+09:00').getTime() -
      new Date(today + 'T00:00:00+09:00').getTime()) / dayMs);

    const items = releaseKeywords().map(k => {
      const mentions = bodies.reduce((n, b) => n + (b.indexOf(k.word) !== -1 ? 1 : 0), 0);
      return { r: k.release, word: k.word, mentions: mentions, d: diff(k.release.date) };
    });
    if (!items.length) return;
    /* 言及が多い順 → 本日発売 → 直近の発売予定 → 少し前に出た新作。
       発売がまだ先の商品が先頭に来ないよう、日付の降順ではなく今日からの近さで並べる。 */
    const rank = it => (it.d === 0 ? [0, 0] : it.d > 0 ? [1, it.d] : [2, -it.d]);
    items.sort((a, b) => {
      if (b.mentions !== a.mentions) return b.mentions - a.mentions;
      const x = rank(a), y = rank(b);
      return (x[0] - y[0]) || (x[1] - y[1]);
    });

    /* 発売日が「○月第2週」のように週単位でしか公表されていない商品は、
       date を並び順にだけ使い、バッジは label の表記をそのまま出す。 */
    const badge = it => {
      const cls = it.d === 0 ? ' gh-hot__badge--today' : it.d > 0 ? ' gh-hot__badge--soon' : '';
      const text = it.r.label
        ? it.r.label
        : (it.d === 0 ? '本日発売' : it.r.date.slice(5).replace('-', '/') + ' 発売');
      return '<span class="gh-hot__badge' + cls + '">' + esc(text) + '</span>';
    };
    const cell = (it, lead) => {
      const inner = badge(it) +
        '<strong class="gh-hot__title">' + esc(it.r.title) + '</strong>' +
        '<small class="gh-hot__meta">' + esc(it.r.maker || '') +
          (it.r.price ? '<span class="gh-hot__price">' + esc(it.r.price) + '</span>' : '') +
          (it.mentions ? '<span class="gh-hot__mentions">💬 掲示板で' + it.mentions + '件</span>' : '') +
          (lead && it.r.note ? '<span class="gh-hot__note">' + esc(it.r.note) + '</span>' : '') +
        '</small>';
      const cls = 'gh-hot' + (lead ? ' gh-hot--lead' : ' gh-hot--row');
      return it.r.source
        ? '<a class="' + cls + ' gh-official-source" href="' + esc(it.r.source) + '" target="_blank" rel="noopener">' + inner + '</a>'
        : '<div class="' + cls + '">' + inner + '</div>';
    };
    const shown = items.slice(0, 7);
    hotBox.innerHTML = cell(shown[0], true) +
      (shown.length > 1
        ? '<div class="gh-hot-rest">' + shown.slice(1).map(x => cell(x, false)).join('') + '</div>'
        : '');
    const sec = hotBox.closest('.gh-hot-sec');
    if (sec) sec.hidden = false;
  }

  /* ── ⑦ サイドバー：いま書き込みが多い掲示板 ── */
  function renderActiveBoards(rows, counts) {
    if (!activeBox) return;
    const listEl = activeBox.querySelector('.gh-active-boards');
    if (!listEl) return;
    const latest = {};
    rows.forEach(p => {
      const t = new Date(p.created_at).getTime();
      if (!(latest[p.spot] > t)) latest[p.spot] = t;
    });
    const boards = Object.keys(counts)
      .sort((a, b) => (counts[b] - counts[a]) || (latest[b] - latest[a]))
      .slice(0, 6);
    if (!boards.length) return;
    listEl.innerHTML = boards.map(spot => {
      const store = storeOf(spot);
      const where = store ? store.name : '総合掲示板';
      const area = store ? store.area : '';
      return '<li class="gh-active-board"><a href="' + boardHref(store) + '">' +
        '<span class="gh-active-board__name">' + esc(where) + '</span>' +
        '<span class="gh-active-board__meta">' + esc(area) + (area ? '・' : '') +
          '書き込み ' + counts[spot] + '件・' + agoTag(new Date(latest[spot]).toISOString(), 'gh-active-board__ago') +
        '</span>' +
      '</a></li>';
    }).join('');
    activeBox.hidden = false;
  }

  function render(rows) {
    rows = Array.isArray(rows) ? rows : [];
    const counts = {};
    rows.forEach(p => { counts[p.spot] = (counts[p.spot] || 0) + 1; });
    renderStatus(rows);
    renderPlaza(rows, counts);
    renderFeed(rows, counts);
    renderInvite(rows, counts);
    renderTrending(rows, counts);
    renderPhotos(rows);
    renderReviews(rows);
    renderHotItems(rows);
    renderActiveBoards(rows, counts);
    /* 次回の「新着」判定用に、いま表示した投稿を覚えておく */
    rows.forEach(p => state.seen.add(String(p.id)));
    state.first = false;
    return true;
  }

  /* ── 取得 → 描画 ── */
  function refresh() {
    return fetch(GH_SUPA_URL + '/rest/v1/posts?select=*&order=created_at.desc&limit=' + LIMIT, {
      headers: {
        apikey: GH_SUPA_KEY,
        Authorization: 'Bearer ' + GH_SUPA_KEY,
        Prefer: 'count=exact'                      /* 総投稿数を Content-Range で受け取る */
      }
    })
      .then(r => {
        if (!r.ok) throw new Error('http ' + r.status);
        const cr = r.headers.get('content-range');   /* 例: "0-59/123" */
        const n = cr && cr.split('/')[1];
        if (n && /^\d+$/.test(n)) state.total = Number(n);
        return r.json();
      })
      .then(rows => {
        const fresh = (rows || []).filter(p => !state.seen.has(String(p.id)));
        state.newCount = state.first ? 0 : fresh.length;
        state.lastAt = new Date().toISOString();
        render(rows || []);
      })
      .catch(() => {
        /* 投稿取得に失敗しても、発売情報など投稿に依存しない欄は表示する。 */
        if (state.first) { state.lastAt = new Date().toISOString(); render([]); }
      });
  }

  /* 発売情報は掲示板の取得結果を待たずに表示し、取得後に言及数だけ反映する。 */
  renderHotItems([]);
  refresh();

  /* 経過時間は取得を待たずに進める（「○分前」が止まって見えないように） */
  setInterval(() => tickTimes(), TICK_MS);

  /* タブが見えているときだけ再取得する（無駄な通信をしない） */
  let timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { tickTimes(); refresh(); }
  });
  window.addEventListener('pagehide', () => clearInterval(timer));
})();

/* ===========================================================================
   店舗ページ：掲示板プレビュー
   詳細タブにも最新の書き込みを出し、タブを切り替えなくても人の気配が見えるようにする。
   #bbsList の描画結果をそのまま流用するので、通信は増やさない。
   =========================================================================== */
(function () {
  const box = document.querySelector('[data-gh-bbs-preview]');
  const list = document.querySelector('[data-gh-bbs-preview-list]');
  const src = document.getElementById('bbsList');
  if (!box || !list || !src) return;

  const countEl = document.querySelector('[data-gh-bbs-preview-count]');
  const badge = document.querySelector('[data-gh-board-badge]');
  const boardTab = document.querySelector('.gh-detail-tabs [data-panel="board"]');

  /* 「すべて見る」「書き込む」は掲示板タブへ切り替える */
  document.querySelectorAll('[data-gh-open-board]').forEach(a => {
    a.addEventListener('click', ev => {
      if (!boardTab) return;
      ev.preventDefault();
      boardTab.click();
      const form = document.getElementById(a.classList.contains('gh-btn') ? 'bbsForm' : 'bbsList');
      if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  function sync() {
    const posts = src.querySelectorAll('.gh-bbs__post');
    const n = posts.length;
    if (badge) { badge.textContent = n ? String(n) : ''; badge.hidden = !n; }
    if (countEl) countEl.textContent = n ? '書き込み ' + n + '件' : '';
    if (!n) {                                   /* 0件でも「最初の1件を」と誘う */
      list.innerHTML = '<p class="gh-bbs-preview__empty">まだ書き込みがありません。' +
        'あなたの1件が、次に来る人の助けになります。</p>';
      box.hidden = false;
      return;
    }
    list.innerHTML = '';
    Array.prototype.slice.call(posts, 0, 3).forEach(el => {
      const clone = el.cloneNode(true);
      clone.classList.add('gh-bbs__post--preview');
      list.appendChild(clone);
    });
    box.hidden = false;
  }

  sync();
  /* 掲示板の描画・投稿にあわせて追従する */
  new MutationObserver(sync).observe(src, { childList: true });
})();

/* ── Spot exterior photo: upload + localStorage persistence (location.html) ── */
(function () {
  const input = document.getElementById('spotPhotoInput');
  const img   = document.getElementById('spotPhoto');
  const note  = document.getElementById('spotPhotoNote');
  if (!input || !img) return;

  const KEY = 'gh-spot-photo:' + location.pathname;   // per-spot photo

  function showUserPhoto(dataUrl) {
    img.src = dataUrl;
    img.classList.add('is-user');
    img.alt = 'アップロードされた店舗外観写真';
    if (note) note.hidden = true;
  }

  // Restore a previously uploaded photo (survives reload, this browser only)
  try { const saved = localStorage.getItem(KEY); if (saved) showUserPhoto(saved); } catch (e) {}

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file || !/^image\//.test(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Downscale so the data URL fits comfortably in localStorage
      const tmp = new Image();
      tmp.onload = () => {
        const MAX = 1000;
        let w = tmp.width, h = tmp.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        let dataUrl;
        try {
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(tmp, 0, 0, w, h);
          dataUrl = c.toDataURL('image/jpeg', 0.82);
        } catch (e) {
          dataUrl = reader.result;   // fallback: store original
        }
        showUserPhoto(dataUrl);
        try { localStorage.setItem(KEY, dataUrl); } catch (e) { /* quota exceeded */ }
      };
      tmp.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
})();

/* ── 未実装リンク（href="#"）でページ先頭に飛ばないようにするガード ── */
document.addEventListener('click', e => {
  const dead = e.target.closest('a[href="#"]');
  if (dead) e.preventDefault();
});

/* ── シェアボタン：本物の共有リンクにする ── */
(function () {
  const x = document.querySelector('.gh-share__btn--x');
  const line = document.querySelector('.gh-share__btn--line');
  const url = encodeURIComponent(location.href);
  const text = encodeURIComponent(document.title);
  if (x) {
    x.href = 'https://twitter.com/intent/tweet?text=' + text + '&url=' + url;
    x.target = '_blank'; x.rel = 'noopener';
  }
  if (line) {
    line.href = 'https://social-plugins.line.me/lineit/share?url=' + url;
    line.target = '_blank'; line.rel = 'noopener';
  }
})();

/* ── Daily random hashtags (index.html) ──
   毎日5つをランダム表示。同じ日は固定、日付が変わると入れ替わる。
   ★ ハッシュタグを増やすときは、下の HASHTAGS 配列に追記するだけ。 */
(function () {
  const box = document.getElementById('dailyHashtags');
  if (!box) return;

  const HASHTAGS = [
    '#ガチャガチャ', '#ガチャ', '#カプセルトイ', '#ガシャポン', '#ガチャポン',
    '#ガチャ活', '#ガチャガチャ好き', '#カプセルトイ好き', '#ガチャ好き', '#ガシャポン好き',
    '#ミニチュア', '#フィギュア', '#ミニフィギュア', '#キャラクターグッズ', '#推し活',
    '#オタ活', '#コレクション', '#コレクター', '#コンプリート', '#フルコンプ',
    '#ガチャ結果', '#ガチャ開封', '#開封動画', '#購入品紹介', '#新作ガチャ',
    '#最新ガチャ', '#再販ガチャ', '#人気ガチャ', '#おすすめガチャ', '#ガチャ巡り',
    '#ガチャ探し', '#ガチャ設置場所', '#カプセルトイ専門店', '#ガチャガチャ専門店', '#ガチャガチャの森',
    '#ガシャポンのデパート', '#バンダイガシャポン', '#ガチャガチャ沼', '#カプセルトイ沼', '#ミニチュア雑貨',
    '#可愛いガチャ', '#かわいいガチャ', '#面白いガチャ', '#変なガチャ', '#癒しグッズ',
    '#サンリオガチャ', '#ちいかわガチャ', '#ディズニーガチャ', '#ポケモンガチャ', '#アニメグッズ',
    '#めじるしアクセサリー', '#めじるしアクセサリーガチャ', '#めじるしチャーム', '#傘マーカー', '#アンブレラマーカー',
    '#ペットボトルマーカー'
  ];

  // 日付をシードにした擬似乱数（mulberry32）で「その日の並び」を決定
  const d = new Date();
  let seed = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) >>> 0;
  const rand = () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  // 日付シードでシャッフルして先頭5つを採用
  const arr = HASHTAGS.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const pick = arr.slice(0, 5);

  box.innerHTML = pick.map(tag =>
    '<a class="gh-hashtag" href="https://twitter.com/search?q=' + encodeURIComponent(tag) +
    '&src=hashtag_click" target="_blank" rel="noopener">' + tag + '</a>'
  ).join('');
})();

/* ── Affiliate modules (data/ads.js → 文脈別広告・サイドバー) ── */
(function () {
  const cfg = window.GH_ADS;
  if (!cfg) return;

  const esc = value => {
    const node = document.createElement('div');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  };
  const campaigns = cfg.campaigns || {};
  const discHtml = cfg.disclosure
    ? '<p class="gh-affil__disc">' + esc(cfg.disclosure) + '</p>'
    : '';
  const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
  const creativeFor = (campaign, mode) => {
    if (mode === 'sidebar') return campaign.sidebarCreative || campaign.mobileCreative || campaign.desktopCreative || 'sidebar';
    return isMobile()
      ? (campaign.mobileCreative || campaign.desktopCreative || 'mobile')
      : (campaign.desktopCreative || campaign.mobileCreative || 'desktop');
  };
  const trackingAttrs = (campaign, placement, mode) =>
    ' data-ad-track="unit"' +
    ' data-ad-id="' + esc(campaign.id || '') + '"' +
    ' data-ad-placement="' + esc(placement) + '"' +
    ' data-ad-creative="' + esc(creativeFor(campaign, mode)) + '"' +
    ' data-ad-creative-desktop="' + esc(campaign.desktopCreative || '') + '"' +
    ' data-ad-creative-mobile="' + esc(campaign.mobileCreative || '') + '"';
  const campaignPicture = (campaign, mode) => {
    const fallback = mode === 'sidebar'
      ? (campaign.sidebarImage || campaign.mobileImage || campaign.desktopImage)
      : (campaign.desktopImage || campaign.mobileImage);
    if (!fallback) return '';
    if (mode === 'sidebar') {
      return '<img src="' + esc(fallback) + '" alt="' + esc(campaign.imageAlt || campaign.title) + '" loading="lazy" />';
    }
    return '<picture>' +
      (campaign.mobileImage ? '<source media="(max-width: 600px)" srcset="' + esc(campaign.mobileImage) + '" />' : '') +
      '<img src="' + esc(fallback) + '" alt="' + esc(campaign.imageAlt || campaign.title) + '" loading="lazy" />' +
    '</picture>';
  };
  const campaignCard = (campaign, placement) => {
    const imageLabel = (campaign.shop || campaign.title) + 'の商品ページを開く';
    return '<article class="gh-commerce__card"' + trackingAttrs(campaign, placement, 'context') + '>' +
      '<div class="gh-commerce__media">' +
        '<a href="' + esc(campaign.url) + '" target="_blank" rel="nofollow sponsored noopener" aria-label="' + esc(imageLabel) + '" data-ad-cta="image">' +
          campaignPicture(campaign, 'context') +
          '<span class="gh-commerce__image-fallback">画像を読み込めませんでした</span>' +
        '</a>' +
      '</div>' +
      '<div class="gh-commerce__body">' +
        '<div class="gh-commerce__meta"><span class="gh-affil__pr">PR</span><span>' + esc(campaign.shop || '楽天市場') + '</span></div>' +
        (campaign.eyebrow ? '<p class="gh-commerce__eyebrow">' + esc(campaign.eyebrow) + '</p>' : '') +
        '<h3 class="gh-commerce__title">' + esc(campaign.title) + '</h3>' +
        (campaign.description ? '<p class="gh-commerce__desc">' + esc(campaign.description) + '</p>' : '') +
        (campaign.price ? '<p class="gh-commerce__price">' + esc(campaign.price) + '</p>' : '') +
        '<a class="gh-commerce__cta" href="' + esc(campaign.ctaUrl || campaign.url) + '" target="_blank" rel="nofollow sponsored noopener" data-ad-cta="' + esc(campaign.cta || '商品詳細を見る') + '">' +
          esc(campaign.cta || '商品詳細を見る') + '<span aria-hidden="true">→</span>' +
        '</a>' +
        (campaign.note ? '<small class="gh-commerce__note">' + esc(campaign.note) + '</small>' : '') +
      '</div>' +
    '</article>';
  };

  /* ページごとの閲覧目的に合わせた固定枠。日替わり表示にはしない。 */
  document.querySelectorAll('[data-gh-commerce]').forEach(box => {
    const placement = box.dataset.ghCommerce;
    const campaignKeys = (cfg.placements && cfg.placements[placement]) || [];
    const selected = campaignKeys.map(key => campaigns[key]).filter(Boolean);
    if (!selected.length) return;
    box.innerHTML = '<div class="gh-commerce">' +
      selected.map(campaign => campaignCard(campaign, placement)).join('') +
      '</div>' + discHtml;
    const section = box.closest('.gh-commerce-sec');
    if (section) section.hidden = false;
  });

  /* ガチャ関連グッズ。各リンクを個別に計測する。 */
  document.querySelectorAll('[data-gh-gacha-goods]').forEach(box => {
    const goods = (cfg.gachaGoods || []).filter(g => g && g.url && g.title);
    if (!goods.length) return;
    box.innerHTML = '<div class="gh-goods">' + goods.map(g =>
      '<a class="gh-goods__card" href="' + esc(g.url) + '" target="_blank" rel="nofollow sponsored noopener"' +
        ' data-ad-track="unit" data-ad-id="' + esc(g.id || 'rk_goods') + '" data-ad-placement="goods" data-ad-creative="text_card" data-ad-cta="' + esc(g.title) + '">' +
        '<span class="gh-goods__emoji" aria-hidden="true">' + esc(g.emoji || '🎁') + '</span>' +
        '<span class="gh-goods__body"><strong class="gh-goods__title">' + esc(g.title) + '</strong>' +
        '<small class="gh-goods__note">' + esc(g.note || '') + '</small></span>' +
        '<span class="gh-goods__arrow" aria-hidden="true">▶</span>' +
      '</a>').join('') + '</div>' + discHtml;
    const section = box.closest('.gh-goods-sec');
    if (section) {
      const heading = section.querySelector('.gh-section__title');
      if (heading && cfg.gachaGoodsHeading) {
        heading.innerHTML = esc(cfg.gachaGoodsHeading) + ' <span class="gh-affil__pr">PR</span>';
      }
      section.hidden = false;
    }
  });

  document.querySelectorAll('.gh-commerce__media img').forEach(img => {
    const markUnavailable = () => {
      const media = img.closest('.gh-commerce__media');
      if (media) media.classList.add('is-unavailable');
    };
    img.addEventListener('error', markUnavailable);
    if (img.complete && !img.naturalWidth) markUnavailable();
  });

  /* 未設定の広告枠は仮表示を残さず、商品を描画できた枠だけ表示する。 */
  const slots = document.querySelectorAll('.gh-ad');
  slots.forEach(slot => {
    slot.hidden = true;
    slot.classList.remove('gh-ad--filled');
  });
  /* 本文に文脈広告があるページでは、同じ画面のサイドバー広告を重ねない。 */
  if (document.querySelector('.gh-commerce__card')) {
    slots.forEach(slot => { slot.hidden = true; });
    return;
  }
  const products = (cfg.products || []).map(product => {
    if (!product || !product.campaignId) return product;
    const campaign = campaigns[product.campaignId];
    return campaign ? { ...campaign, campaignId: product.campaignId } : null;
  }).filter(product => product && product.url && product.title);
  if (!slots.length || !products.length) return;

  const max = cfg.maxPerSlot || 3;
  const day = Math.floor((Date.now() + 9 * 3600 * 1000) / 86400000);
  const sidebarCampaignIds = new Set(products.map(product => product.id).filter(Boolean));
  const goodsAll = (cfg.gachaGoods || []).filter(g =>
    g && g.url && g.title && !sidebarCampaignIds.has(g.id));
  const goodsStart = goodsAll.length ? day % goodsAll.length : 0;
  const rotatedGoods = goodsAll.slice(goodsStart).concat(goodsAll.slice(0, goodsStart)).slice(0, 2);
  const sidebarItems = rotatedGoods.concat(products).slice(0, max);

  const sidebarCard = item => {
    if (item.campaignId) {
      return '<article class="gh-affil__rk"' + trackingAttrs(item, 'sidebar', 'sidebar') + '>' +
        '<div class="gh-affil__rk-head"><span class="gh-affil__rk-shop">' + esc(item.shop || '楽天市場') + '</span><span class="gh-affil__pr">PR</span></div>' +
        '<a class="gh-affil__banner" href="' + esc(item.url) + '" target="_blank" rel="nofollow sponsored noopener" aria-label="' + esc((item.shop || item.title) + 'を開く') + '" data-ad-cta="image">' +
          campaignPicture(item, 'sidebar') +
        '</a>' +
        '<div class="gh-affil__rk-copy"><strong>' + esc(item.title) + '</strong><small>' + esc(item.note || '') + '</small></div>' +
        '<a class="gh-affil__cta" href="' + esc(item.ctaUrl || item.url) + '" target="_blank" rel="nofollow sponsored noopener" data-ad-cta="' + esc(item.cta || '商品詳細を見る') + '">' + esc(item.cta || '商品詳細を見る') + '&nbsp;▶</a>' +
      '</article>';
    }
    return '<a class="gh-affil__card" href="' + esc(item.url) + '" target="_blank" rel="nofollow sponsored noopener"' +
      ' data-ad-track="unit" data-ad-id="' + esc(item.id || 'rk_goods') + '" data-ad-placement="sidebar" data-ad-creative="text_card" data-ad-cta="' + esc(item.title) + '">' +
      '<span class="gh-affil__badge">PR</span><span class="gh-affil__emoji" aria-hidden="true">' + esc(item.emoji || '🛍️') + '</span>' +
      '<span class="gh-affil__text"><strong class="gh-affil__title">' + esc(item.title) + '</strong>' +
      (item.note ? '<small class="gh-affil__note">' + esc(item.note) + '</small>' : '') + '</span></a>';
  };

  const sidebarHtml = '<div class="gh-affil">' + sidebarItems.map(sidebarCard).join('') + '</div>' + discHtml;
  slots.forEach(slot => {
    const body = slot.querySelector('.gh-ad__body') || slot;
    body.innerHTML = sidebarHtml;
    slot.classList.add('gh-ad--filled');
    slot.hidden = false;
  });

  document.querySelectorAll('.gh-affil__banner img').forEach(img => {
    const markUnavailable = () => {
      const media = img.closest('.gh-affil__banner');
      if (media) media.classList.add('is-unavailable');
    };
    img.addEventListener('error', markUnavailable);
    if (img.complete && !img.naturalWidth) markUnavailable();
  });
})();

/* ── 広告計測：広告別の表示数・クリック数をGA4へ送る ── */
(function () {
  const activeCreative = node => {
    const unit = node.closest('[data-ad-track="unit"]') || node;
    if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) {
      return unit.dataset.adCreativeMobile || unit.dataset.adCreative || 'unknown';
    }
    return unit.dataset.adCreativeDesktop || unit.dataset.adCreative || 'unknown';
  };
  const metaFor = node => {
    const unit = node.closest('[data-ad-track="unit"]') || node;
    return {
      unit,
      adId: unit.dataset.adId || 'unknown',
      placement: unit.dataset.adPlacement || 'other',
      creative: activeCreative(unit)
    };
  };

  document.addEventListener('click', event => {
    const link = event.target.closest && event.target.closest('a[rel~="sponsored"]');
    if (!link || typeof window.gtag !== 'function') return;
    const meta = metaFor(link);
    try {
      window.gtag('event', 'ad_click', {
        ad_unit: meta.placement,
        ad_id: meta.adId,
        ad_placement: meta.placement,
        ad_creative: meta.creative,
        cta_label: (link.dataset.adCta || link.textContent || 'link').trim().slice(0, 80),
        page_path: (location.pathname || '/').slice(0, 120),
        link_url: (link.href || '').slice(0, 180)
      });
    } catch (error) {}
  }, true);

  if (!('IntersectionObserver' in window) || typeof window.gtag !== 'function') return;
  const seen = new Set();
  const timers = new WeakMap();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const target = entry.target;
      const currentTimer = timers.get(target);
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
        if (currentTimer) clearTimeout(currentTimer);
        timers.delete(target);
        return;
      }
      if (currentTimer) return;
      const timer = setTimeout(() => {
        const meta = metaFor(target);
        const key = meta.adId + '|' + meta.placement;
        if (seen.has(key)) {
          observer.unobserve(target);
          return;
        }
        seen.add(key);
        observer.unobserve(target);
        try {
          window.gtag('event', 'ad_impression', {
            ad_unit: meta.placement,
            ad_id: meta.adId,
            ad_placement: meta.placement,
            ad_creative: meta.creative,
            page_path: (location.pathname || '/').slice(0, 120)
          });
        } catch (error) {}
      }, 1000);
      timers.set(target, timer);
    });
  }, { threshold: [0.5] });

  document.querySelectorAll('[data-ad-track="unit"]').forEach(target => observer.observe(target));
})();


/* ===========================================================================
   オープン予定表示の鮮度合わせ
   ★ spot/ の静的HTMLは生成した時点の状態を持っている。開業日を過ぎたあとも
      ページを作り直すまで「オープン予定」と出続けてしまうので、開業日を過ぎた
      [data-gh-preopen] はここで取り除き、通常の営業中店舗として見せる。
      （逆に開業前なら何もしない＝JSが動かない環境でも予定表示は残る）
   =========================================================================== */
(function () {
  var nodes = document.querySelectorAll('[data-gh-preopen]');
  if (!nodes.length) return;
  var today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);  /* JST */
  for (var i = 0; i < nodes.length; i++) {
    var on = nodes[i].getAttribute('data-gh-preopen');
    if (on && on <= today && nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
  }
})();
