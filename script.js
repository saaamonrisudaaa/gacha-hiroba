'use strict';

/* ── Google Analytics 4 (gtag.js) ── 測定ID: G-6KSGDTM1VJ
   ここ1か所で管理。script.js を読み込む全ページに自動適用されます。
   IDを変えるときは下の GA_ID を書き換えるだけ。 */
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
    if (q) location.href = 'stores.html?q=' + encodeURIComponent(q);
    else input.focus();
  });
});

/* ── サイドバーの「エリア・駅名で検索」ウィジェット：都道府県で店舗一覧へ ── */
document.querySelectorAll('.gh-widget__form').forEach(form => {
  const sel = form.querySelector('.gh-select');
  if (!sel) return;
  form.addEventListener('submit', () => {
    const pref = sel.value.trim();
    if (pref) location.href = 'stores.html?pref=' + encodeURIComponent(pref);
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

  const rows = spots.filter(inTab).sort((a, b) =>
    (ghViewsOf(b) - ghViewsOf(a)) || ((b.machines || 0) - (a.machines || 0)));
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gh-muted);padding:22px">この地域の店舗は現在準備中です。</td></tr>';
    return;
  }

  const table = tbody.closest('table');
  const limit = table ? parseInt(table.dataset.limit || '0', 10) : 0;
  const shown = limit > 0 ? rows.slice(0, limit) : rows;

  tbody.innerHTML = shown.map((s, i) => {
    const rank = i + 1;
    const url = 'spot.html?id=' + encodeURIComponent(s.id);
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
        list.innerHTML = '';                              // サンプル投稿を消してDBの投稿を表示
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

/* ── OpenStreetMap via Leaflet (map.html): 実店舗（data/spots.js）を表示 ── */
(function () {
  const esc = s => { const d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; };
  const machinesText = n => (n == null || n === '') ? '—' : '約' + Number(n).toLocaleString('ja-JP') + '台';
  const spots = (window.GH_SPOTS || []).filter(s => s.lat != null && s.lon != null);

  // 周辺スポットのリスト（Leaflet 未読込でも描画）
  const listBox = document.querySelector('[data-gh-map-list]');
  const distKm = (la1, lo1, la2, lo2) => {
    const r = Math.PI / 180, R = 6371;
    const a = Math.sin((la2 - la1) * r / 2) ** 2 +
              Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  const distText = km => km < 1 ? Math.round(km * 1000) + 'm' : (Math.round(km * 10) / 10) + 'km';
  const renderMapList = (arr, origin) => {
    if (!arr.length) {
      listBox.innerHTML = '<p style="padding:16px;font-size:13px;color:var(--gh-muted)">該当する店舗が見つかりませんでした。キーワードを変えてお試しください。</p>';
      const cnt0 = document.querySelector('.gh-map-list__count');
      if (cnt0) cnt0.textContent = '0件';
      return;
    }
    listBox.innerHTML = arr.map((s, i) =>
      '<a href="spot.html?id=' + encodeURIComponent(s.id) + '" class="gh-map-spot' + (i === 0 ? ' gh-map-spot--selected' : '') + '">' +
        '<div class="gh-map-spot__num' + (i === 0 ? ' gh-map-spot__num--1' : '') + '">' + (i + 1) + '</div>' +
        '<div class="gh-map-spot__info">' +
          '<strong class="gh-map-spot__name">' + esc(s.name) + '</strong>' +
          '<span class="gh-map-spot__area">' + esc(s.area) + '</span>' +
          '<div class="gh-map-spot__meta">' +
            (origin ? '<span class="gh-map-spot__dist">📍 ' + distText(distKm(origin[0], origin[1], s.lat, s.lon)) + '</span>' : '') +
            '<span>🎰 ' + machinesText(s.machines) + '</span><span>🕒 ' + esc(s.hours || '—') + '</span></div>' +
        '</div>' +
      '</a>'
    ).join('');
    const cnt = document.querySelector('.gh-map-list__count');
    if (cnt) cnt.textContent = origin ? '現在地から近い順・' + arr.length + '件' : arr.length + '件表示中';
  };
  if (listBox && spots.length) {
    renderMapList(spots.slice().sort((a, b) => (b.machines || 0) - (a.machines || 0)), null);
  }

  // マップ内キーワード検索：リストと地図をその場で絞り込み（スペース区切りAND検索）
  let fitToSpots = null;     // Leaflet 初期化後に差し込まれる
  const mapSearchForm = document.querySelector('.gh-map-search-form');
  const mapSearchInput = document.querySelector('.gh-map-search-input');
  if (mapSearchForm && mapSearchInput && listBox && spots.length) {
    mapSearchForm.addEventListener('submit', e => {
      e.preventDefault();
      const q = mapSearchInput.value.trim();
      const byMachines = arr => arr.slice().sort((a, b) => (b.machines || 0) - (a.machines || 0));
      if (!q) { renderMapList(byMachines(spots), null); return; }
      const terms = q.toLowerCase().split(/[\s　]+/).filter(Boolean);
      // 「ガチャ」「カプセルトイ」等の一般語は全店舗が該当するため常にマッチ扱い
      const GENERIC = 'ガチャ ガチャガチャ ガチャポン ガシャポン カプセルトイ カプセル 専門店 店舗';
      const hits = spots.filter(s => {
        const hay = ([s.name, s.brand, s.area, s.pref, s.address, s.access]
          .map(f => (f == null ? '' : String(f))).join(' ') + ' ' + GENERIC).toLowerCase();
        return terms.every(t => hay.includes(t));
      });
      renderMapList(byMachines(hits), null);
      if (hits.length) {
        const cnt = document.querySelector('.gh-map-list__count');
        if (cnt) cnt.textContent = '「' + q + '」' + hits.length + '件';
        if (fitToSpots) fitToSpots(hits);
      }
    });
  }

  // 「近い順」ボタン：現在地からの距離でリストを並べ替え（位置情報は端末内でのみ利用・送信しない）
  let centerOnUser = null;   // Leaflet 初期化後に差し込まれる
  const nearbyBtn = document.getElementById('nearbySortBtn');
  if (nearbyBtn && listBox && spots.length) {
    if (!navigator.geolocation) {
      nearbyBtn.style.display = 'none';
    } else {
      const origLabel = nearbyBtn.textContent;
      nearbyBtn.addEventListener('click', () => {
        nearbyBtn.disabled = true;
        nearbyBtn.textContent = '取得中…';
        navigator.geolocation.getCurrentPosition(
          pos => {
            const here = [pos.coords.latitude, pos.coords.longitude];
            renderMapList(
              spots.slice().sort((a, b) =>
                distKm(here[0], here[1], a.lat, a.lon) - distKm(here[0], here[1], b.lat, b.lon)),
              here
            );
            nearbyBtn.disabled = false;
            nearbyBtn.textContent = '✓ 近い順で表示中';
            if (centerOnUser) centerOnUser(here);
          },
          () => {
            nearbyBtn.disabled = false;
            nearbyBtn.textContent = '位置情報を取得できませんでした';
            setTimeout(() => { nearbyBtn.textContent = origLabel; }, 3000);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      });
    }
  }

  const el = document.getElementById('osmMap');
  if (!el || typeof L === 'undefined') return;   // only on map.html, after Leaflet loads

  const map = L.map(el, { scrollWheelZoom: false });

  // OpenStreetMap tiles (attribution is required by the ODbL licence)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const latlngs = [];
  spots.forEach(s => {
    const marker = L.marker([s.lat, s.lon]).addTo(map);
    marker.bindPopup(
      '<strong>' + esc(s.name) + '</strong><br>' +
      '<span style="color:#6b7280">' + esc(s.area) + '</span><br>' +
      '🎰 ' + machinesText(s.machines) + ' ・ 🕒 ' + esc(s.hours || '—') + '<br>' +
      '<a href="spot.html?id=' + encodeURIComponent(s.id) + '">詳細を見る →</a>'
    );
    latlngs.push([s.lat, s.lon]);
  });
  if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [40, 40] });
  else if (latlngs.length === 1) map.setView(latlngs[0], 15);
  else map.setView([35.68, 139.76], 9);

  // 「近い順」で現在地が取れたら地図も現在地中心へ
  centerOnUser = here => {
    map.setView(here, 13);
    L.circleMarker(here, { radius: 8, color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: .6 })
      .addTo(map).bindPopup('現在地').openPopup();
  };

  // キーワード検索のヒット店舗に地図をフィット
  fitToSpots = arr => {
    const pts = arr.filter(s => s.lat != null).map(s => [s.lat, s.lon]);
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] });
    else if (pts.length === 1) map.setView(pts[0], 15);
  };

  // Enable wheel-zoom only after the user clicks the map (avoids hijacking page scroll)
  map.on('click', () => map.scrollWheelZoom.enable());

  // "現在地" button → centre the map on the user's location (if permitted)
  const locBtn = document.getElementById('currentLocBtn');
  if (locBtn && navigator.geolocation) {
    locBtn.addEventListener('click', () => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const here = [pos.coords.latitude, pos.coords.longitude];
          map.setView(here, 16);
          L.circleMarker(here, { radius: 8, color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: .6 })
            .addTo(map).bindPopup('現在地').openPopup();
        },
        () => { /* permission denied / unavailable — ignore */ }
      );
    });
  }
})();

/* ── 掲示板の新着投稿（index.html サイドバー）: Supabase REST を素の fetch で読む ── */
(function () {
  const box = document.querySelector('[data-gh-recent-posts]');
  if (!box || !window.fetch) return;
  const listEl = box.querySelector('.gh-recent-posts');
  const esc = s => { const d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; };
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
  fetch(GH_SUPA_URL + '/rest/v1/posts?select=spot,name,body,created_at&order=created_at.desc&limit=5', {
    headers: { apikey: GH_SUPA_KEY, Authorization: 'Bearer ' + GH_SUPA_KEY }
  })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
    .then(rows => {
      if (!Array.isArray(rows) || !rows.length || !listEl) return;
      const spots = window.GH_SPOTS || [];
      listEl.innerHTML = rows.map(p => {
        const sid = String(p.spot || '').replace(/^spot-/, '');
        const store = spots.find(s => s.id === sid);
        const href = store ? 'spot.html?id=' + encodeURIComponent(store.id) + '#board' : 'board.html';
        const where = store ? store.name : '総合掲示板';
        const raw = String(p.body || '');
        const excerpt = raw.length > 42 ? raw.slice(0, 42) + '…' : raw;
        return '<a class="gh-recent-post" href="' + href + '">' +
          '<span class="gh-recent-post__body">' + esc(excerpt) + '</span>' +
          '<span class="gh-recent-post__meta">' + esc(p.name || '名無しのガチャー') + '・' + esc(where) + '・' + esc(ago(p.created_at)) + '</span>' +
        '</a>';
      }).join('');
      box.hidden = false;
    })
    .catch(() => { /* オフライン・RLS変更などで取れない場合はウィジェットごと非表示 */ });
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

/* ── Affiliate ad slots (data/ads.js → サイドバー広告枠) ──
   data/ads.js の products にアフィリエイトリンクを入れると、各ページの
   .gh-ad 枠に自動でカード表示。未設定なら既存のプレースホルダーのまま。 */
(function () {
  const cfg = window.GH_ADS;
  if (!cfg) return;                                    // ads.js を読み込んだページのみ
  const esc = s => { const d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; };
  const hrefOf = htmlStr => { const d = document.createElement('div'); d.innerHTML = htmlStr; const a = d.querySelector('a'); return a ? a.getAttribute('href') : ''; };
  const RK_HEADS = ['🛒 楽天市場', '🎁 楽天市場でチェック', '🔎 楽天市場で探す'];
  const discHtml = cfg.disclosure ? '<p class="gh-affil__disc">' + esc(cfg.disclosure) + '</p>' : '';

  /* ── 横長「楽天市場でチェック」セクション（featured を [data-gh-featured] に描画） ── */
  const featBox = document.querySelector('[data-gh-featured]');
  if (featBox) {
    const feat = (cfg.featured || []).filter(Boolean);
    if (feat.length) {
      featBox.innerHTML = feat.map(h => '<div class="gh-featured__item">' + h + '</div>').join('') + discHtml;
      const sec = featBox.closest('.gh-featured-sec');
      if (sec) sec.hidden = false;
    }
  }

  /* ── 下からスライドインするPRバナー（自前描画＝広告ブロッカーでも表示。閉じる可） ── */
  const bar = cfg.bottomBar;
  let barClosed = false;
  try { barClosed = sessionStorage.getItem('gh-bottombar-closed') === '1'; } catch (e) {}
  if (bar && bar.url && !barClosed) {
    const el = document.createElement('div');
    el.className = 'gh-bottombar';
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', '広告');
    el.innerHTML =
      '<span class="gh-affil__pr">PR</span>' +
      '<span class="gh-bottombar__emoji" aria-hidden="true">' + esc(bar.emoji || '🛒') + '</span>' +
      '<span class="gh-bottombar__text">' + esc(bar.text || '') + '</span>' +
      '<a class="gh-bottombar__cta" href="' + esc(bar.url) + '" target="_blank" rel="nofollow sponsored noopener">' + esc(bar.cta || '見てみる ▶') + '</a>' +
      '<button type="button" class="gh-bottombar__close" aria-label="広告を閉じる">×</button>';
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('is-open'), 900);   // 少し遅れてスッと出す
    el.querySelector('.gh-bottombar__close').addEventListener('click', () => {
      el.classList.remove('is-open');
      try { sessionStorage.setItem('gh-bottombar-closed', '1'); } catch (e) {}
      setTimeout(() => el.remove(), 400);
    });
  }

  /* ── サイドバー広告枠（.gh-ad を products で埋める） ── */
  const slots = document.querySelectorAll('.gh-ad');
  if (!slots.length) return;

  const products = (cfg.products || []).filter(p => p && (p.html || (p.url && p.title)));
  if (!products.length) return;                        // 未設定ならプレースホルダー維持

  const max = cfg.maxPerSlot || 4;
  // 件数が多いときは日替わりでローテーション（全バナーに露出を回す）
  const day = Math.floor(Date.now() / 86400000);
  const start = products.length ? day % products.length : 0;
  const rotated = products.slice(start).concat(products.slice(0, start));

  const card = (p, i) => {
    // バナーHTML（楽天の画像リンク等）→ 見出し＋枠付き画像＋CTAボタンのカードにして目立たせる
    if (p.html) {
      const href = hrefOf(p.html);
      return '<div class="gh-affil__rk">' +
               '<div class="gh-affil__rk-head">' +
                 '<span class="gh-affil__rk-shop">' + esc(RK_HEADS[i % RK_HEADS.length]) + '</span>' +
                 '<span class="gh-affil__pr">PR</span>' +
               '</div>' +
               '<div class="gh-affil__banner">' + p.html + '</div>' +
               (href ? '<a class="gh-affil__cta" href="' + esc(href) + '" target="_blank" rel="nofollow sponsored noopener">楽天市場で見る&nbsp;▶</a>' : '') +
             '</div>';
    }
    const media = p.img
      ? '<img class="gh-affil__img" src="' + esc(p.img) + '" alt="" loading="lazy" />'
      : '<span class="gh-affil__emoji" aria-hidden="true">' + esc(p.emoji || '🛍️') + '</span>';
    return '<a class="gh-affil__card" href="' + esc(p.url) + '" target="_blank" rel="sponsored nofollow noopener">' +
             '<span class="gh-affil__badge">' + esc(p.badge || 'PR') + '</span>' + media +
             '<span class="gh-affil__text">' +
               '<strong class="gh-affil__title">' + esc(p.title) + '</strong>' +
               (p.note ? '<small class="gh-affil__note">' + esc(p.note) + '</small>' : '') +
             '</span>' +
           '</a>';
  };

  const html = '<div class="gh-affil">' + rotated.slice(0, max).map(card).join('') + '</div>' + discHtml;

  slots.forEach(slot => {
    const body = slot.querySelector('.gh-ad__body') || slot;
    body.innerHTML = html;
    slot.classList.add('gh-ad--filled');
  });
})();
