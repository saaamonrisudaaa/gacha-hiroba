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
    if (q) location.href = '/stores.html?q=' + encodeURIComponent(q);
    else input.focus();
  });
});

/* ── サイドバーの「エリア・駅名で検索」ウィジェット：都道府県で店舗一覧へ ── */
document.querySelectorAll('.gh-widget__form').forEach(form => {
  const sel = form.querySelector('.gh-select');
  if (!sel) return;
  form.addEventListener('submit', () => {
    const pref = sel.value.trim();
    if (pref) location.href = '/stores.html?pref=' + encodeURIComponent(pref);
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
  /* シード投稿（data/board-seed.js）。実投稿より前の「古い投稿」として表示する */
  function seedViews() {
    const arr = (window.GH_BOARD_SEED || {})[SPOT] || [];
    return arr.map((s, i) => ({
      num: i + 1,
      name: s.name || '名無しのガチャー',
      date: s.date || '',
      id: idHash(SPOT + '-seed-' + i),
      body: s.body || ''
    }));
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
        const seeds = seedViews();                        // シード投稿を最古として先に描画
        seeds.forEach(s => list.insertBefore(makePost(s), list.firstElementChild));
        data.forEach((p, i) => list.insertBefore(makePost(toView(p, seeds.length + i + 1)), list.firstElementChild));
        total = seeds.length + data.length;
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

    const seeds = seedViews();                            // シード投稿を最古として先に描画
    const saved = loadSaved();
    if (seeds.length || saved.length) { const e = document.getElementById('bbsEmpty'); if (e) e.remove(); }
    seeds.forEach(s => list.insertBefore(makePost(s), list.firstElementChild));
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
      '<a href="/spot/' + encodeURIComponent(s.id) + '.html' + '" class="gh-map-spot' + (i === 0 ? ' gh-map-spot--selected' : '') + '">' +
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
      // 正規化（全角→半角・小文字化・ハイフン/#除去）で「Cpla」「#C-pla」等の表記ゆれを吸収
      const norm = s => {
        s = String(s == null ? '' : s);
        try { s = s.normalize('NFKC'); } catch (e) {}
        return s.toLowerCase().replace(/[#\-‐‑–—−]/g, '');
      };
      const terms = norm(q).split(/\s+/).filter(Boolean);
      // 「ガチャ」「カプセルトイ」等の一般語は全店舗が該当するため常にマッチ扱い
      const GENERIC = 'ガチャ ガチャガチャ ガチャポン ガシャポン カプセルトイ カプセル 専門店 店舗';
      const hits = spots.filter(s => {
        const hay = norm([s.name, s.brand, s.area, s.pref, s.address, s.access]
          .map(f => (f == null ? '' : String(f))).join(' ') + ' ' + GENERIC);
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
    /* オープン前の店舗は地図でも「まだ開いていない」と分かるようにする */
    const jstNow = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const soon = s.opensOn && s.opensOn > jstNow;
    marker.bindPopup(
      '<strong>' + esc(s.name) + '</strong><br>' +
      (soon ? '<span style="color:#c2410c;font-weight:700">' +
        esc(s.opensOn.slice(5).split('-').map(Number).join('/')) + ' オープン予定</span><br>' : '') +
      '<span style="color:#6b7280">' + esc(s.area) + '</span><br>' +
      '🎰 ' + machinesText(s.machines) + ' ・ 🕒 ' + esc(s.hours || '—') + '<br>' +
      '<a href="/spot/' + encodeURIComponent(s.id) + '.html' + '">詳細を見る →</a>'
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
    const total = (state.total == null ? rows.length : state.total + seedRows().length);
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
        ? '<a class="' + cls + '" href="' + esc(it.r.source) + '" target="_blank" rel="noopener">' + inner + '</a>'
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

  /* ── 各店舗ページの掲示板に常時表示しているシード投稿も同じフィードに載せる ── */
  let seedCache = null;
  function seedRows() {
    if (seedCache) return seedCache;
    const seed = window.GH_BOARD_SEED;
    if (!seed) { seedCache = []; return seedCache; }
    const out = [];
    Object.keys(seed).forEach(spot => {
      (seed[spot] || []).forEach((p, i) => {
        const m = String(p.date || '').match(/^(\d{4})\/(\d{2})\/(\d{2}).*?(\d{2}):(\d{2}):(\d{2})$/);
        if (!m) return;
        const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        out.push({ id: spot + '-seed-' + i, spot: spot, name: p.name, body: p.body, created_at: d.toISOString() });
      });
    });
    seedCache = out;
    return seedCache;
  }
  const merge = rows => (Array.isArray(rows) ? rows : []).concat(seedRows())
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  function render(rows) {
    if (!Array.isArray(rows) || !rows.length) return false;
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
        render(merge(rows));
      })
      .catch(() => {
        /* 取得できないときはシードだけで描画（初回のみ）。以降は現状維持。 */
        if (state.first) { state.lastAt = new Date().toISOString(); render(merge([])); }
      });
  }

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
    const featAll = (cfg.featured || []).filter(Boolean);
    /* 表示は featuredMax 件まで。開始位置を日替わりでずらして、
       件数を絞っても全商品が順番に露出するようにする。 */
    const featMax = Number(cfg.featuredMax) > 0 ? Number(cfg.featuredMax) : featAll.length;
    let feat = featAll;
    if (featAll.length > featMax) {
      const day = Math.floor((Date.now() + 9 * 3600 * 1000) / 86400000);
      const start = day % featAll.length;
      feat = featAll.concat(featAll).slice(start, start + featMax);
    }
    if (feat.length) {
      featBox.innerHTML = feat.map(h => '<div class="gh-featured__item">' + h + '</div>').join('') + discHtml;
      const sec = featBox.closest('.gh-featured-sec');
      if (sec) sec.hidden = false;
    }
  }

  /* ── ガチャ関連グッズユニット（[data-gh-gacha-goods] に描画。本命の文脈広告） ── */
  document.querySelectorAll('[data-gh-gacha-goods]').forEach(box => {
    const goods = (cfg.gachaGoods || []).filter(g => g && g.url && g.title);
    if (!goods.length) return;
    box.innerHTML =
      '<div class="gh-goods">' +
      goods.map(g =>
        '<a class="gh-goods__card" href="' + esc(g.url) + '" target="_blank" rel="nofollow sponsored noopener" data-ad-unit="goods">' +
          '<span class="gh-goods__emoji" aria-hidden="true">' + esc(g.emoji || '🎁') + '</span>' +
          '<span class="gh-goods__body">' +
            '<strong class="gh-goods__title">' + esc(g.title) + '</strong>' +
            '<small class="gh-goods__note">' + esc(g.note || '') + '</small>' +
          '</span>' +
          '<span class="gh-goods__arrow" aria-hidden="true">▶</span>' +
        '</a>').join('') +
      '</div>' + discHtml;
    const sec = box.closest('.gh-goods-sec');
    if (sec) sec.hidden = false;
  });

  /* ── 下からスライドインするPRバナー（自前描画＝広告ブロッカーでも表示。閉じる可） ── */
  const bar = cfg.bottomBar;
  let barClosed = false;
  try { barClosed = sessionStorage.getItem('gh-bottombar-closed') === '1'; } catch (e) {}
  /* banners があれば画像バナーを1つランダムに表示。無ければ従来のテキスト表示。 */
  const barBanners = (bar && Array.isArray(bar.banners) ? bar.banners : [])
    .filter(b => b && b.url && b.img);
  const barPick = barBanners.length ? barBanners[Math.floor(Math.random() * barBanners.length)] : null;
  if (bar && (barPick || bar.url) && !barClosed) {
    const el = document.createElement('div');
    el.className = 'gh-bottombar' + (barPick ? ' gh-bottombar--banner' : '');
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', '広告');
    const eyebrow =
      '<span class="gh-bottombar__eyebrow">' +
        '<span class="gh-bottombar__pr">PR</span>' +
        (bar.label ? '<span class="gh-bottombar__label">' + esc(bar.label) + '</span>' : '') +
      '</span>';
    const close = '<button type="button" class="gh-bottombar__close" aria-label="広告を閉じる">×</button>';
    if (barPick) {
      el.innerHTML =
        eyebrow +
        '<a class="gh-bottombar__banner" href="' + esc(barPick.url) + '" target="_blank" rel="nofollow sponsored noopener">' +
          '<img src="' + esc(barPick.img) + '" alt="' + esc(bar.label || '広告') + '" loading="lazy" />' +
        '</a>' +
        close;
    } else {
      el.innerHTML =
        '<span class="gh-bottombar__icon" aria-hidden="true">' + esc(bar.emoji || '🛒') + '</span>' +
        '<span class="gh-bottombar__body">' +
          eyebrow +
          '<strong class="gh-bottombar__text">' + esc(bar.text || '') + '</strong>' +
          (bar.sub ? '<small class="gh-bottombar__sub">' + esc(bar.sub) + '</small>' : '') +
        '</span>' +
        '<a class="gh-bottombar__cta" href="' + esc(bar.url) + '" target="_blank" rel="nofollow sponsored noopener">' +
          esc(bar.cta || '見てみる') + '<span aria-hidden="true">→</span></a>' +
        close;
    }
    document.body.appendChild(el);
    /* バナー画像が読めない場合（広告ブロッカー・配信停止など）は、
       中身のない枠を出しっぱなしにしないでバナーごと消す。 */
    const barImg = el.querySelector('.gh-bottombar__banner img');
    if (barImg) barImg.addEventListener('error', () => el.remove());
    setTimeout(() => { if (el.isConnected) el.classList.add('is-open'); }, 900);
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
  // ガチャ関連グッズを常に先頭へ（日替わり2件）。残り枠は汎用バナーのローテーション
  const day = Math.floor(Date.now() / 86400000);
  const goodsAll = (cfg.gachaGoods || []).filter(g => g && g.url && g.title);
  const gStart = goodsAll.length ? day % goodsAll.length : 0;
  const goodsRotated = goodsAll.slice(gStart).concat(goodsAll.slice(0, gStart)).slice(0, 2);
  const start = products.length ? day % products.length : 0;
  const rotated = goodsRotated.concat(products.slice(start).concat(products.slice(0, start)));

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

/* ── 広告クリック計測（GA4: ad_click）。rel=sponsored のリンクを対象 ── */
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[rel~="sponsored"]');
  if (!a || typeof window.gtag !== 'function') return;
  const unit = a.dataset.adUnit
    || (a.closest('.gh-goods') ? 'goods'
      : a.closest('.gh-bottombar') ? 'bottombar'
      : a.closest('.gh-affil') ? 'sidebar'
      : a.closest('.gh-featured') ? 'featured' : 'other');
  try { window.gtag('event', 'ad_click', { ad_unit: unit, link_url: (a.href || '').slice(0, 180) }); } catch (err) {}
}, true);


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
