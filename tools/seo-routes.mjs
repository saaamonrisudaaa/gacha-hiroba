/* Search-friendly static route names shared by the page generators. */
export const PREF_SLUG = Object.freeze({
  '北海道': 'hokkaido', '青森県': 'aomori', '岩手県': 'iwate', '宮城県': 'miyagi',
  '秋田県': 'akita', '山形県': 'yamagata', '福島県': 'fukushima', '茨城県': 'ibaraki',
  '栃木県': 'tochigi', '群馬県': 'gunma', '埼玉県': 'saitama', '千葉県': 'chiba',
  '東京都': 'tokyo', '神奈川県': 'kanagawa', '新潟県': 'niigata', '富山県': 'toyama',
  '石川県': 'ishikawa', '福井県': 'fukui', '山梨県': 'yamanashi', '長野県': 'nagano',
  '岐阜県': 'gifu', '静岡県': 'shizuoka', '愛知県': 'aichi', '三重県': 'mie',
  '滋賀県': 'shiga', '京都府': 'kyoto', '大阪府': 'osaka', '兵庫県': 'hyogo',
  '奈良県': 'nara', '和歌山県': 'wakayama', '鳥取県': 'tottori', '島根県': 'shimane',
  '岡山県': 'okayama', '広島県': 'hiroshima', '山口県': 'yamaguchi', '徳島県': 'tokushima',
  '香川県': 'kagawa', '愛媛県': 'ehime', '高知県': 'kochi', '福岡県': 'fukuoka',
  '佐賀県': 'saga', '長崎県': 'nagasaki', '熊本県': 'kumamoto', '大分県': 'oita',
  '宮崎県': 'miyazaki', '鹿児島県': 'kagoshima', '沖縄県': 'okinawa'
});

export const BRAND_SLUG = Object.freeze({
  'ガチャガチャの森': 'gacha-no-mori',
  'ガシャポンのデパート': 'gashapon-department-store',
  '#C-pla（シープラ）': 'c-pla',
  'カプセル楽局': 'capsule-rakkyoku',
  'ガシャポンバンダイオフィシャルショップ': 'gashapon-bandai-official-shop',
  'gashacoco（ガシャココ）': 'gashacoco',
  'ドリームカプセル': 'dream-capsule',
  'ガシャポン（バンダイ）': 'gashapon-bandai',
  'ヨドバシカメラ': 'yodobashi-camera',
  'ケンエレスタンド': 'kenele-stand',
  'CAPSULE LAB（カプコン）': 'capsule-lab',
  'ガチャステ': 'gacha-station',
  'がちゃ処': 'gachadokoro',
  'カプセルマルシェ': 'capsule-marche',
  'TOYS SPOT PALO': 'toys-spot-palo',
  'ガチャ王国': 'gacha-okoku',
  'カプセルパーク': 'capsule-park'
});

/* 店舗・地域・ブランドの似た静的ページは、再審査中に大量公開しない。
   個別・絞り込みは noindex の機能画面へ集約し、基本一覧と独自編集ページだけを検索対象にする。 */
export const spotPath = (id, hash = '') => '/spot.html?id=' + encodeURIComponent(id) + hash;
export const prefPath = (pref) => '/stores.html?pref=' + encodeURIComponent(pref || '');
export const brandPath = (brand) => '/stores.html?brand=' + encodeURIComponent(brand || '');
export const guidePath = (slug) => '/guide/' + encodeURIComponent(slug) + '.html';
