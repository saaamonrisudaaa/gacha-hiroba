/*
 * 都道府県・ブランド別の似た静的ページを公開物から除外する。
 * 絞り込み機能は /stores.html?pref=... / ?brand=... に集約し、noindexで提供する。
 */
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';

const dirs = [new URL('../area/', import.meta.url), new URL('../brand/', import.meta.url)];
let removed = 0;

for (const dir of dirs) {
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.html')) continue;
    unlinkSync(new URL(file, dir));
    removed++;
  }
}

console.log(`gen-landing-pages: 量産エリア・ブランドページを公開対象から除外しました（${removed}件削除）`);
