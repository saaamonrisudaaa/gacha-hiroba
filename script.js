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

/* ── Ranking: 実店舗（data/spots.js）を設置台数順に描画。各行は個別ページへ ── */
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

  const rows = spots.filter(inTab).sort((a, b) => (b.machines || 0) - (a.machines || 0));
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

  /* Supabase 設定（publishable=公開キーなのでソースに書いてOK。読み書きはRLSで制御） */
  const SUPA_URL = 'https://vyzdekctlynzuaowopso.supabase.co';
  const SUPA_KEY = 'sb_publishable_1GOi0AxMP1emK7hOC_wMeQ_jqmEL47E';
  const SPOT     = (window.GH_SPOT_ID || 'yodobashi-akiba'); // 掲示板ID。データ方式の店舗ページは spots-ui.js が設定

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
    const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
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

/* ── OpenStreetMap via Leaflet (map.html): 実店舗（data/spots.js）を表示 ── */
(function () {
  const esc = s => { const d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; };
  const machinesText = n => (n == null || n === '') ? '—' : '約' + Number(n).toLocaleString('ja-JP') + '台';
  const spots = (window.GH_SPOTS || []).filter(s => s.lat != null && s.lon != null);

  // 周辺スポットのリスト（Leaflet 未読込でも描画）
  const listBox = document.querySelector('[data-gh-map-list]');
  if (listBox && spots.length) {
    const top = spots.slice().sort((a, b) => (b.machines || 0) - (a.machines || 0));
    listBox.innerHTML = top.map((s, i) =>
      '<a href="spot.html?id=' + encodeURIComponent(s.id) + '" class="gh-map-spot' + (i === 0 ? ' gh-map-spot--selected' : '') + '">' +
        '<div class="gh-map-spot__num' + (i === 0 ? ' gh-map-spot__num--1' : '') + '">' + (i + 1) + '</div>' +
        '<div class="gh-map-spot__info">' +
          '<strong class="gh-map-spot__name">' + esc(s.name) + '</strong>' +
          '<span class="gh-map-spot__area">' + esc(s.area) + '</span>' +
          '<div class="gh-map-spot__meta"><span>🎰 ' + machinesText(s.machines) + '</span><span>🕒 ' + esc(s.hours || '—') + '</span></div>' +
        '</div>' +
      '</a>'
    ).join('');
    const cnt = document.querySelector('.gh-map-list__count');
    if (cnt) cnt.textContent = top.length + '件表示中';
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

/* ── Bulletin-board hub sorting (board.html) ── */
(function () {
  const table = document.getElementById('boardTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const rows  = Array.from(tbody.querySelectorAll('tr'));

  const num = (r, k) => parseFloat(r.dataset[k]) || 0;
  const sorters = {
    popular:  (a, b) => (num(b, 'momentum') * num(b, 'posts')) - (num(a, 'momentum') * num(a, 'posts')),
    posts:    (a, b) => num(b, 'posts')    - num(a, 'posts'),
    momentum: (a, b) => num(b, 'momentum') - num(a, 'momentum'),
    new:      (a, b) => num(b, 'time')     - num(a, 'time'),
  };

  function reRank() {
    Array.from(tbody.querySelectorAll('tr')).forEach((r, i) => {
      const rk = r.querySelector('.gh-rank');
      if (!rk) return;
      rk.textContent = i + 1;
      rk.className = 'gh-rank' + (i === 0 ? ' gh-rank--1' : i === 1 ? ' gh-rank--2' : i === 2 ? ' gh-rank--3' : '');
      r.classList.toggle('gh-table__row--top', i === 0);
    });
  }

  document.querySelectorAll('[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.gh-tab-group').querySelectorAll('.gh-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      rows.sort(sorters[btn.dataset.sort] || sorters.popular);
      rows.forEach(r => tbody.appendChild(r));
      reRank();
    });
  });
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
