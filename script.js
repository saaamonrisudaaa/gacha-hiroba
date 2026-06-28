'use strict';

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

/* ── 5ch-style bulletin board with localStorage persistence (location.html) ── */
(function () {
  const list   = document.getElementById('bbsList');
  const body   = document.getElementById('bbsBody');
  const nameIn = document.getElementById('bbsName');
  const submit = document.getElementById('bbsSubmit');
  const count  = document.getElementById('bbsCount');
  if (!list || !body || !submit) return;

  const STORE_KEY = 'gh-bbs:' + location.pathname;   // per-page board storage
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const pad  = n => String(n).padStart(2, '0');

  function nowStr() {
    const d = new Date();
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${days[d.getDay()]}) ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function randomId() {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch (e) { return []; }
  }
  function persist(arr) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(arr)); } catch (e) { /* disabled/full */ }
  }

  // Restore previously saved posts so they survive a page reload.
  // Saved oldest→newest; prepend each so the newest ends up on top.
  loadSaved().forEach(p => list.insertBefore(makePost(p), list.firstElementChild));
  if (count) count.textContent = String(list.querySelectorAll('.gh-bbs__post').length);

  function addPost() {
    const text = body.value.trim();
    if (!text) { body.focus(); return; }
    const post = {
      num:  list.querySelectorAll('.gh-bbs__post').length + 1,
      name: (nameIn && nameIn.value.trim()) || '名無しのガチャー',
      body: text,
      date: nowStr(),
      id:   randomId()
    };
    list.insertBefore(makePost(post), list.firstElementChild);   // newest on top
    const arr = loadSaved(); arr.push(post); persist(arr);
    if (count) count.textContent = String(post.num);
    body.value = '';
    const el = document.getElementById('res' + post.num);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  submit.addEventListener('click', addPost);
  // Ctrl/Cmd + Enter to submit
  body.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addPost(); }
  });
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
