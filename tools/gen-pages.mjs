/*
 * 店舗詳細は /spot.html?id=<id> の1画面に集約する。
 *
 * 以前は全店舗について似た構成の /spot/<id>.html を生成していたが、
 * AdSense再審査ではテンプレートページの大量公開を避ける。店舗検索と掲示板の
 * 機能は残し、検索エンジン向けには基本一覧、独自ガイド、調査レポートを公開する。
 */
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';

const outDir = new URL('../spot/', import.meta.url);
mkdirSync(outDir, { recursive: true });

let removed = 0;
for (const file of readdirSync(outDir)) {
  if (!file.endsWith('.html')) continue;
  unlinkSync(new URL(file, outDir));
  removed++;
}

console.log(`gen-pages: 量産店舗ページを公開対象から除外しました（${removed}件削除）`);
