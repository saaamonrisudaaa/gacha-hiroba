import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('../data/releases.js', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
const sandbox = { window: {} };

try {
  new vm.Script(source, { filename: 'data/releases.js' }).runInNewContext(sandbox);
} catch (error) {
  console.error('validate-releases: JavaScriptを読み込めません:', error.message);
  process.exit(1);
}

const releases = sandbox.window.GH_RELEASES;
const errors = [];
const allowedKeys = new Set(['date', 'label', 'title', 'maker', 'price', 'note', 'source']);
const seenTitles = new Map();
const seenSources = new Map();
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/\s+/g, '');

if (!Array.isArray(releases)) {
  errors.push('window.GH_RELEASES が配列ではありません');
} else {
  if (releases.length < 1 || releases.length > 20) {
    errors.push(`掲載件数は1〜20件にしてください（現在 ${releases.length}件）`);
  }

  releases.forEach((release, index) => {
    const at = `${index + 1}件目`;
    if (!release || typeof release !== 'object' || Array.isArray(release)) {
      errors.push(`${at}: オブジェクトではありません`);
      return;
    }

    Object.keys(release).forEach(key => {
      if (!allowedKeys.has(key)) errors.push(`${at}: 未対応の項目「${key}」があります`);
    });

    ['date', 'title', 'source'].forEach(key => {
      if (typeof release[key] !== 'string' || !release[key].trim()) {
        errors.push(`${at}: ${key} は空でない文字列が必要です`);
      }
    });
    ['label', 'maker', 'price', 'note'].forEach(key => {
      if (key in release && (typeof release[key] !== 'string' || !release[key].trim())) {
        errors.push(`${at}: ${key} を入れる場合は空でない文字列にしてください`);
      }
    });

    if (typeof release.date === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(release.date);
      if (!match) {
        errors.push(`${at}: date は YYYY-MM-DD 形式にしてください`);
      } else {
        const date = new Date(`${release.date}T00:00:00Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== release.date) {
          errors.push(`${at}: date が実在する日付ではありません（${release.date}）`);
        }
      }
    }

    if (typeof release.source === 'string') {
      try {
        const url = new URL(release.source);
        if (url.protocol !== 'https:') errors.push(`${at}: source は HTTPS URL にしてください`);
      } catch {
        errors.push(`${at}: source が有効なURLではありません`);
      }
    }

    if (typeof release.title === 'string' && typeof release.date === 'string') {
      const key = `${release.date}:${normalize(release.title)}`;
      if (seenTitles.has(key)) errors.push(`${at}: ${seenTitles.get(key)}件目と同じ日付・商品名です`);
      else seenTitles.set(key, index + 1);
    }
    if (typeof release.source === 'string') {
      const key = release.source.trim().toLowerCase();
      if (seenSources.has(key)) errors.push(`${at}: ${seenSources.get(key)}件目と同じsourceです`);
      else seenSources.set(key, index + 1);
    }
  });
}

if (errors.length) {
  console.error(`validate-releases: NG（${errors.length}件）`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`validate-releases: OK / 掲載データ ${releases.length}件`);
