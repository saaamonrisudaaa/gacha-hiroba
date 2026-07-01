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

/* ── Ranking tab data ── */
const rankingData = {
  national: [
    { rank:1, name:'ヨドバシAkiba ガチャコーナー',  area:'東京・秋葉原', machines:200, rating:'4.9', reviews:'3,241', badge:'HOT' },
    { rank:2, name:'アキバガチャ横丁',               area:'東京・秋葉原', machines:120, rating:'4.8', reviews:'2,108', badge:'NEW' },
    { rank:3, name:'なんばウォーク ガチャコーナー',   area:'大阪・なんば', machines:85,  rating:'4.7', reviews:'1,892', badge:''    },
    { rank:4, name:"池袋P'PARCO ガチャフロア",       area:'東京・池袋',   machines:78,  rating:'4.7', reviews:'1,654', badge:''    },
    { rank:5, name:'ラゾーナ川崎プラザ',              area:'神奈川・川崎', machines:65,  rating:'4.6', reviews:'1,203', badge:''    },
    { rank:6, name:'サンシャインシティ アルタ',        area:'東京・池袋',   machines:58,  rating:'4.4', reviews:'987',   badge:''    },
    { rank:7, name:'梅田LOFT ガチャコーナー',          area:'大阪・梅田',   machines:52,  rating:'4.5', reviews:'876',   badge:'NEW' },
    { rank:8, name:'大須ガチャガチャ通り',             area:'愛知・名古屋', machines:64,  rating:'4.5', reviews:'743',   badge:''    },
  ],
  tokyo: [
    { rank:1, name:'ヨドバシAkiba ガチャコーナー',   area:'東京・秋葉原', machines:200, rating:'4.9', reviews:'3,241', badge:'HOT' },
    { rank:2, name:'アキバガチャ横丁',                area:'東京・秋葉原', machines:120, rating:'4.8', reviews:'2,108', badge:'NEW' },
    { rank:3, name:"池袋P'PARCO ガチャフロア",        area:'東京・池袋',   machines:78,  rating:'4.7', reviews:'1,654', badge:''    },
    { rank:4, name:'サンシャインシティ アルタ',         area:'東京・池袋',   machines:58,  rating:'4.4', reviews:'987',   badge:''    },
    { rank:5, name:'渋谷マルキュー ガチャコーナー',     area:'東京・渋谷',   machines:45,  rating:'4.3', reviews:'623',   badge:''    },
  ],
  osaka: [
    { rank:1, name:'なんばウォーク ガチャコーナー',   area:'大阪・なんば', machines:85,  rating:'4.7', reviews:'1,892', badge:''    },
    { rank:2, name:'梅田LOFT ガチャコーナー',          area:'大阪・梅田',   machines:52,  rating:'4.5', reviews:'876',   badge:'NEW' },
    { rank:3, name:'阪急三番街 ガチャ広場',            area:'大阪・梅田',   machines:40,  rating:'4.3', reviews:'541',   badge:''    },
  ],
  other: [
    { rank:1, name:'大須ガチャガチャ通り',            area:'愛知・名古屋', machines:64,  rating:'4.5', reviews:'743',   badge:''    },
    { rank:2, name:'ラゾーナ川崎プラザ',              area:'神奈川・川崎', machines:65,  rating:'4.6', reviews:'1,203', badge:''    },
    { rank:3, name:'博多マルイ ガチャフロア',          area:'福岡・博多',   machines:48,  rating:'4.3', reviews:'487',   badge:''    },
    { rank:4, name:'札幌パルコ ガチャコーナー',        area:'北海道・札幌', machines:35,  rating:'4.2', reviews:'312',   badge:''    },
  ],
};

function badgeHTML(b) {
  if (b === 'HOT') return '<span class="gh-badge gh-badge--hot">HOT</span>';
  if (b === 'NEW') return '<span class="gh-badge gh-badge--new">NEW</span>';
  return '';
}

function renderRanking(key) {
  const tbody = document.querySelector('#rankingTable tbody');
  if (!tbody) return;
  const rows = rankingData[key] || rankingData.national;
  const rankCls = r => r === 1 ? 'gh-rank--1' : r === 2 ? 'gh-rank--2' : r === 3 ? 'gh-rank--3' : '';
  tbody.innerHTML = rows.map(r => `
    <tr class="${r.rank === 1 ? 'gh-table__row--top' : ''}">
      <td><span class="gh-rank ${rankCls(r.rank)}">${r.rank}</span></td>
      <td><a href="location.html" class="gh-table__link">${r.name}</a>${badgeHTML(r.badge)}</td>
      <td>${r.area}</td>
      <td class="gh-num">${r.machines}</td>
      <td class="gh-num"><span class="gh-rating">★ ${r.rating}</span></td>
      <td class="gh-num">${r.reviews}</td>
      <td><a href="location.html" class="gh-btn gh-btn--xs">詳細</a></td>
    </tr>
  `).join('');
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

/* ── OpenStreetMap via Leaflet (map.html) ── */
(function () {
  const el = document.getElementById('osmMap');
  if (!el || typeof L === 'undefined') return;   // only on map.html, after Leaflet loads

  // Sample spots around Akihabara (approximate coordinates)
  const spots = [
    { name: 'ヨドバシAkiba ガチャコーナー',   area: '東京都千代田区外神田1丁目', lat: 35.69857, lon: 139.77448, rating: '4.9', machines: '200台', main: true },
    { name: 'アキバガチャ横丁',               area: '東京都千代田区外神田4丁目', lat: 35.70180, lon: 139.77205, rating: '4.8', machines: '120台' },
    { name: '秋葉原UDX ガチャコーナー',        area: '東京都千代田区外神田4丁目', lat: 35.70192, lon: 139.77330, rating: '4.3', machines: '45台'  },
    { name: '末広町ガチャ専門店',             area: '東京都千代田区外神田3丁目', lat: 35.70320, lon: 139.77165, rating: '4.1', machines: '30台'  },
    { name: '御茶ノ水マルイ ガチャコーナー',   area: '東京都千代田区神田小川町1丁目', lat: 35.69963, lon: 139.76540, rating: '4.0', machines: '22台'  },
  ];

  const map = L.map(el, { scrollWheelZoom: false }).setView([35.7005, 139.7715], 15);

  // OpenStreetMap tiles (attribution is required by the ODbL licence)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const latlngs = [];
  spots.forEach(s => {
    const marker = L.marker([s.lat, s.lon]).addTo(map);
    marker.bindPopup(
      '<strong>' + s.name + '</strong><br>' +
      '<span style="color:#6b7280">' + s.area + '</span><br>' +
      '★ ' + s.rating + ' ・ ' + s.machines + '<br>' +
      '<a href="location.html">詳細を見る →</a>'
    );
    if (s.main) marker.openPopup();
    latlngs.push([s.lat, s.lon]);
  });
  if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [40, 40] });

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
  const slots = document.querySelectorAll('.gh-ad');
  if (!slots.length) return;

  const products = (cfg.products || []).filter(p => p && (p.html || (p.url && p.title)));
  if (!products.length) return;                        // 未設定ならプレースホルダー維持

  const max = cfg.maxPerSlot || 4;
  const esc = s => { const d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; };
  const hrefOf = htmlStr => { const d = document.createElement('div'); d.innerHTML = htmlStr; const a = d.querySelector('a'); return a ? a.getAttribute('href') : ''; };
  const RK_HEADS = ['🛒 楽天市場', '🎁 楽天市場でチェック', '🔎 楽天市場で探す'];

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

  const html = '<div class="gh-affil">' + products.slice(0, max).map(card).join('') + '</div>' +
    (cfg.disclosure ? '<p class="gh-affil__disc">' + esc(cfg.disclosure) + '</p>' : '');

  slots.forEach(slot => {
    const body = slot.querySelector('.gh-ad__body') || slot;
    body.innerHTML = html;
    slot.classList.add('gh-ad--filled');
  });
})();
