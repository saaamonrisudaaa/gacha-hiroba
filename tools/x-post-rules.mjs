export const POST_SLOTS = ['morning', 'noon', 'afternoon', 'evening'];

const URL_PATTERN = /https?:\/\/\S+/gu;
const graphemeSegmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });

export function normalizeNewlines(value) {
  return String(value ?? '').replace(/\r\n?/gu, '\n');
}

export function duplicateKey(value) {
  return normalizeNewlines(value)
    .replace(URL_PATTERN, '')
    .replace(/\s+/gu, '')
    .normalize('NFKC');
}

export function bodyLength(value) {
  return [...graphemeSegmenter.segment(duplicateKey(value))].length;
}

export function validatePost(value) {
  const text = normalizeNewlines(value);
  const errors = [];
  const lines = text.split('\n');

  if (lines.length !== 3) {
    errors.push('投稿文はフック・本文・URLの3行にしてください');
  }
  if (lines.some(line => !line || line !== line.trim())) {
    errors.push('各行は空にせず、行頭・行末に空白を入れないでください');
  }

  const hook = lines[0] || '';
  const body = lines[1] || '';
  const url = lines[2] || '';
  if (/https?:\/\//u.test(hook) || /https?:\/\//u.test(body)) {
    errors.push('URLは3行目だけに置いてください');
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'gacha-hiroba.com' || parsed.href !== url) {
      errors.push('3行目は https://gacha-hiroba.com/ 配下のURLだけにしてください');
    }
  } catch {
    errors.push('3行目は有効なURLにしてください');
  }

  const length = bodyLength(text);
  if (length > 50) {
    errors.push(`本文はURLを除いて50文字以内にしてください（現在${length}文字）`);
  }

  return {
    valid: errors.length === 0,
    errors,
    text,
    hook,
    body,
    url,
    bodyLength: length,
    key: duplicateKey(text)
  };
}

export function jstDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jst.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function loggedJstDate(post) {
  return post?.jstDate || jstDateKey(post?.date);
}

export function wasSlotPosted(posts, dateKey, slot) {
  return (posts || []).some(post => post?.slot === slot && loggedJstDate(post) === dateKey);
}

export function wasLaterSlotPosted(posts, dateKey, slot) {
  const slotIndex = POST_SLOTS.indexOf(slot);
  if (slotIndex < 0) return false;
  return (posts || []).some(post => {
    const postedIndex = POST_SLOTS.indexOf(post?.slot);
    return loggedJstDate(post) === dateKey && postedIndex > slotIndex;
  });
}
