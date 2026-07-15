import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bodyLength,
  completedPositions,
  duplicateKey,
  isSlotBatchComplete,
  jstDateKey,
  remainingIntervalMs,
  validatePlainPost,
  validatePost,
  wasLaterSlotPosted,
  wasPositionPosted,
  wasSlotPosted
} from './x-post-rules.mjs';

const url = 'https://gacha-hiroba.com/stores.html';

test('3行・サイトURL・50字以内の投稿を受理する', () => {
  const result = validatePost(`今週はどれを回す？\n新作を見つけるコツはこちら\n${url}`);
  assert.equal(result.valid, true);
  assert.equal(result.bodyLength, 22);
});

test('2行・4行・空行を拒否する', () => {
  assert.equal(validatePost(`フック\n${url}`).valid, false);
  assert.equal(validatePost(`フック\n本文\n補足\n${url}`).valid, false);
  assert.equal(validatePost(`フック\n\n${url}`).valid, false);
});

test('URLは3行目のガチャ広場URLだけを許可する', () => {
  assert.equal(validatePost(`https://example.com\n本文\n${url}`).valid, false);
  assert.equal(validatePost('フック\n本文\nhttps://example.com/').valid, false);
  assert.equal(validatePost(`フック\n本文\n${url} 補足`).valid, false);
});

test('本文50グラフェムを受理し51グラフェムを拒否する', () => {
  assert.equal(validatePost(`${'あ'.repeat(25)}\n${'い'.repeat(25)}\n${url}`).valid, true);
  assert.equal(validatePost(`${'あ'.repeat(25)}\n${'い'.repeat(26)}\n${url}`).valid, false);
});

test('絵文字を見た目どおり1文字として数える', () => {
  assert.equal(bodyLength(`🎰\n🎯\n${url}`), 2);
});

test('本文内の空白は文字数に含める', () => {
  assert.equal(bodyLength(`ガチャ 広場\n新作\n${url}`), 8);
});

test('URLなし投稿は厳密な2行・50文字以内だけを受理する', () => {
  const valid = validatePlainPost('今日の気になるガチャ店🎰\nガチャガチャの森 新宿サブナード店');
  assert.equal(valid.valid, true);
  assert.equal(validatePlainPost(`フック\n本文\n${url}`).valid, false);
  assert.equal(validatePlainPost('フックだけ').valid, false);
  assert.equal(validatePlainPost(`${'あ'.repeat(25)}\n${'い'.repeat(26)}`).valid, false);
});

test('URLなし投稿ではURLと裸ドメインを拒否する', () => {
  for (const value of [
    'フック\nhttps://example.com',
    'フック\nhttp://example.com',
    'フック\nwww.example.com',
    'フック\ngacha-hiroba.com'
  ]) {
    assert.equal(validatePlainPost(value).valid, false);
  }
});

test('重複キーはURLと空白の違いを無視する', () => {
  assert.equal(
    duplicateKey(`同じフック\n同じ本文\n${url}`),
    duplicateKey('同じフック 同じ本文\nhttps://gacha-hiroba.com/article.html?area=guide-find-new')
  );
});

test('JST日付をUTC時刻から正しく求める', () => {
  assert.equal(jstDateKey('2026-07-12T23:29:24.900Z'), '2026-07-13');
});

test('同日同枠と後続枠の投稿済み判定を行う', () => {
  const posts = [
    { date: '2026-07-12T23:29:24.900Z', slot: 'morning' },
    { jstDate: '2026-07-13', slot: 'afternoon' }
  ];
  assert.equal(wasSlotPosted(posts, '2026-07-13', 'morning'), true);
  assert.equal(wasLaterSlotPosted(posts, '2026-07-13', 'noon'), true);
  assert.equal(wasLaterSlotPosted(posts, '2026-07-13', 'evening'), false);
});

test('前の投稿から2分経つまでの残り時間を計算する', () => {
  assert.equal(remainingIntervalMs('2026-07-15T06:30:00Z', '2026-07-15T06:30:30Z'), 90000);
  assert.equal(remainingIntervalMs('2026-07-15T06:30:00Z', '2026-07-15T06:32:00Z'), 0);
});

test('3投稿の完了位置を判定し、旧ログは枠完了として扱う', () => {
  const partial = [
    { jstDate: '2026-07-15', slot: 'afternoon', position: 1 },
    { jstDate: '2026-07-15', slot: 'afternoon', position: 2 }
  ];
  assert.deepEqual([...completedPositions(partial, '2026-07-15', 'afternoon')], [1, 2]);
  assert.equal(wasPositionPosted(partial, '2026-07-15', 'afternoon', 2), true);
  assert.equal(isSlotBatchComplete(partial, '2026-07-15', 'afternoon'), false);

  const legacy = [{ jstDate: '2026-07-15', slot: 'afternoon' }];
  assert.deepEqual([...completedPositions(legacy, '2026-07-15', 'afternoon')], [1, 2, 3]);
  assert.equal(isSlotBatchComplete(legacy, '2026-07-15', 'afternoon'), true);
});
