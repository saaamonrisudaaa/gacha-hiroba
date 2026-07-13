import { readFileSync } from 'node:fs';
import {
  POST_SLOTS,
  duplicateKey,
  validatePost
} from './x-post-rules.mjs';

const queue = JSON.parse(readFileSync(new URL('../data/x-posts.json', import.meta.url), 'utf8')).queue || [];
const log = JSON.parse(readFileSync(new URL('../data/x-posted-log.json', import.meta.url), 'utf8')).posts || [];
const errors = [];
const queuedKeys = new Map();
const postedKeys = new Set(log.map(post => duplicateKey(post.text)).filter(Boolean));

for (const [index, item] of queue.entries()) {
  const label = `queue[${index}]`;
  if (!POST_SLOTS.includes(item?.slot)) {
    errors.push(`${label}: slot は ${POST_SLOTS.join('/')} のいずれかにしてください`);
  }

  const result = validatePost(item?.text);
  for (const error of result.errors) errors.push(`${label}: ${error}`);
  if (!result.key) errors.push(`${label}: 本文が空です`);

  if (postedKeys.has(result.key)) {
    errors.push(`${label}: 投稿済みログと重複しています`);
  }
  if (queuedKeys.has(result.key)) {
    errors.push(`${label}: queue[${queuedKeys.get(result.key)}] と重複しています`);
  } else if (result.key) {
    queuedKeys.set(result.key, index);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`X投稿キュー検証OK: ${queue.length}件（3行・本文50字以内・URL・重複なし）`);
