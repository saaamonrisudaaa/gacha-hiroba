import { readFileSync } from 'node:fs';

const spotsUrl = new URL('../data/spots.js', import.meta.url);
const queueUrl = new URL('../data/spots-queue.json', import.meta.url);

const errors = [];
const warnings = [];

function loadSpots() {
  const text = readFileSync(spotsUrl, 'utf8');
  const filterMarker = '/* 閉店店舗の自動非表示';
  const markerIndex = text.indexOf(filterMarker);
  const dataOnly = markerIndex === -1 ? text : text.slice(0, markerIndex);
  const win = {};
  try {
    new Function('window', dataOnly)(win);
  } catch (error) {
    errors.push('data/spots.js を読み込めません: ' + error.message);
  }
  return Array.isArray(win.GH_SPOTS) ? win.GH_SPOTS : [];
}

function loadQueue() {
  try {
    return JSON.parse(readFileSync(queueUrl, 'utf8'));
  } catch (error) {
    errors.push('data/spots-queue.json を読み込めません: ' + error.message);
    return {};
  }
}

const spots = loadSpots();
const queueData = loadQueue();
const queue = Array.isArray(queueData.queue) ? queueData.queue : [];

const prefRegion = new Map(Object.entries({
  北海道: 'tohoku', 青森県: 'tohoku', 岩手県: 'tohoku', 宮城県: 'tohoku', 秋田県: 'tohoku', 山形県: 'tohoku', 福島県: 'tohoku', 新潟県: 'tohoku',
  茨城県: 'kanto', 栃木県: 'kanto', 群馬県: 'kanto', 埼玉県: 'kanto', 千葉県: 'kanto', 東京都: 'kanto', 神奈川県: 'kanto', 山梨県: 'kanto',
  富山県: 'tokai', 石川県: 'tokai', 福井県: 'tokai', 長野県: 'tokai', 岐阜県: 'tokai', 静岡県: 'tokai', 愛知県: 'tokai', 三重県: 'tokai',
  滋賀県: 'kansai', 京都府: 'kansai', 大阪府: 'kansai', 兵庫県: 'kansai', 奈良県: 'kansai', 和歌山県: 'kansai',
  鳥取県: 'chugoku', 島根県: 'chugoku', 岡山県: 'chugoku', 広島県: 'chugoku', 山口県: 'chugoku', 徳島県: 'chugoku', 香川県: 'chugoku', 愛媛県: 'chugoku', 高知県: 'chugoku',
  福岡県: 'kyushu', 佐賀県: 'kyushu', 長崎県: 'kyushu', 熊本県: 'kyushu', 大分県: 'kyushu', 宮崎県: 'kyushu', 鹿児島県: 'kyushu', 沖縄県: 'kyushu'
}));
const requiredFields = ['id', 'brand', 'name', 'region', 'pref', 'area', 'address'];
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (value) => {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const normalize = (value) => String(value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s\u3000・･#＃()（）\[\]［］「」『』\-ー~〜]/gu, '');

function validateStore(store, label, requireProvenance) {
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    errors.push(label + ' は店舗オブジェクトではありません');
    return;
  }
  for (const field of requiredFields) {
    if (typeof store[field] !== 'string' || !store[field].trim()) {
      errors.push(label + ': ' + field + ' がありません');
    }
  }
  if (store.id && !idPattern.test(store.id)) {
    errors.push(label + ': id は半角小文字・数字・ハイフンのみ使用できます (' + store.id + ')');
  }
  const expectedRegion = prefRegion.get(store.pref);
  if (!expectedRegion) {
    errors.push(label + ': 未知の都道府県です (' + store.pref + ')');
  } else if (store.region !== expectedRegion) {
    errors.push(label + ': ' + store.pref + ' の region は ' + expectedRegion + ' です (' + store.region + ')');
  }

  const hasLat = store.lat !== undefined && store.lat !== null;
  const hasLon = store.lon !== undefined && store.lon !== null;
  if (hasLat !== hasLon) {
    errors.push(label + ': lat と lon はセットで指定してください');
  } else if (hasLat) {
    if (!Number.isFinite(store.lat) || store.lat < 20 || store.lat > 46) {
      errors.push(label + ': lat が日本国内の範囲外です (' + store.lat + ')');
    }
    if (!Number.isFinite(store.lon) || store.lon < 122 || store.lon > 154) {
      errors.push(label + ': lon が日本国内の範囲外です (' + store.lon + ')');
    }
  }
  if (store.machines !== undefined && (!Number.isInteger(store.machines) || store.machines < 1)) {
    errors.push(label + ': machines は1以上の整数にしてください');
  }
  if (store.closedAfter !== undefined && !isValidDate(store.closedAfter)) {
    errors.push(label + ': closedAfter は YYYY-MM-DD 形式にしてください');
  }
  if (store.verifiedAt !== undefined && !isValidDate(store.verifiedAt)) {
    errors.push(label + ': verifiedAt は YYYY-MM-DD 形式にしてください');
  }

  if (store.sourceUrl !== undefined) {
    try {
      const source = new URL(store.sourceUrl);
      if (source.protocol !== 'https:') throw new Error('HTTPSではありません');
    } catch {
      errors.push(label + ': sourceUrl は有効なHTTPS URLにしてください');
    }
  }
  if (requireProvenance) {
    if (!store.sourceUrl) errors.push(label + ': 公式情報の sourceUrl が必要です');
    if (!store.verifiedAt) errors.push(label + ': verifiedAt が必要です');
  }
}

spots.forEach((store, index) => validateStore(store, 'spots[' + index + ']', false));
queue.forEach((store, index) => validateStore(store, 'queue[' + index + ']', true));

const seenIds = new Map();
for (const [kind, stores] of [['spots', spots], ['queue', queue]]) {
  stores.forEach((store, index) => {
    if (!store || !store.id) return;
    const previous = seenIds.get(store.id);
    if (previous) errors.push(kind + '[' + index + ']: id が ' + previous + ' と重複しています (' + store.id + ')');
    else seenIds.set(store.id, kind + '[' + index + ']');
  });
}

const publishedNames = new Map();
spots.forEach((store, index) => {
  const key = normalize(store.name);
  if (!key) return;
  const list = publishedNames.get(key) || [];
  list.push('spots[' + index + ']');
  publishedNames.set(key, list);
});
for (const [name, entries] of publishedNames) {
  if (entries.length > 1) warnings.push('既存データ内に同名店舗があります: ' + name + ' (' + entries.join(', ') + ')');
}

const queuedNames = new Map();
queue.forEach((store, index) => {
  const key = normalize(store && store.name);
  if (!key) return;
  if (publishedNames.has(key)) {
    errors.push('queue[' + index + ']: 掲載済みの店名です (' + store.name + ')');
  }
  const previous = queuedNames.get(key);
  if (previous !== undefined) errors.push('queue[' + index + ']: queue[' + previous + '] と店名が重複しています (' + store.name + ')');
  else queuedNames.set(key, index);
});

if (!Array.isArray(queueData.queue)) {
  errors.push('queue は配列にしてください');
}
if (!isValidDate(queueData.lastRunDate)) {
  errors.push('lastRunDate は有効な YYYY-MM-DD 形式にしてください');
}
if (queueData.dripPerDay !== 4) {
  errors.push('dripPerDay は4である必要があります (' + queueData.dripPerDay + ')');
}
if (queueData.dailyMix !== undefined && !Array.isArray(queueData.dailyMix)) {
  errors.push('dailyMix は配列にしてください');
}

const requireIndex = process.argv.indexOf('--require-queue');
if (requireIndex !== -1) {
  const required = Number(process.argv[requireIndex + 1]);
  if (!Number.isInteger(required) || required < 1) {
    errors.push('--require-queue には1以上の整数を指定してください');
  } else {
    const publishedIds = new Set(spots.map((store) => store.id));
    const candidates = queue.filter((store) => store && store.id && !publishedIds.has(store.id));
    if (candidates.length < required) {
      errors.push('追加可能なキューが不足しています: ' + candidates.length + '件 / 必要' + required + '件');
    }
  }
}

warnings.forEach((message) => console.warn('validate-stores: warning: ' + message));
if (errors.length) {
  errors.forEach((message) => console.error('validate-stores: error: ' + message));
  console.error('validate-stores: ' + errors.length + '件のエラーがあります');
  process.exit(1);
}

console.log('validate-stores: OK / 掲載データ ' + spots.length + '件 / キュー ' + queue.length + '件 / 1日 ' + queueData.dripPerDay + '件');
