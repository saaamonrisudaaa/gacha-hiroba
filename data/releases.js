/* ===========================================================================
   新作ガチャの発売情報
   ★ トップページの「今日話題の商品」と新着情報ページに使われます。
      date: 'YYYY-MM-DD'（発売日または週単位告知の代表日）。トップページでは
      掲示板での言及数と発売日の近さで最大7件、新着情報ページでは当日・直近・
      発売予定の順で表示されます。古い項目は定時更新時に配列から整理します。
   ★ source は必ず一次情報（メーカー公式・公式ニュースリリース）を入れてください。
      公式画像は転載せず、商品名と確認できた事実だけを短く掲載します。
   ★ 任意フィールド
      label: バッジの表記を上書きする（例 '8月第2週 発売'）。ガシャポンは発売日が
             「○月第2週」のように週単位で告知されることが多く、日付を断定できない
             場合はこれを使う。date は並び順と表示期間の判定にだけ使われる。
      price: 1回いくらか（例 '1回500円／全4種'）。分かる場合だけ入れる。
   =========================================================================== */
/* 一次情報を実際に再確認した日。生成処理を走らせただけでは更新しないこと。 */
window.GH_RELEASES_CHECKED_ON = '2026-08-12';

window.GH_RELEASES = [
  {
    date: '2026-08-10',
    label: '8月第2週より順次',
    title: 'サンリオキャラクターズ くだものめじるしアクセサリー',
    maker: 'バンダイ（ガシャポン）',
    price: '1回300円／全5種',
    note: 'サンリオキャラクターが、くだものの姿になっためじるしアクセサリー。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4570118186683000'
  },
  {
    date: '2026-08-10',
    label: '8月第2週より順次',
    title: 'カードキャプターさくら ブリスターチャームコレクション',
    maker: 'バンダイ（ガシャポン）',
    price: '1回400円／全6種',
    note: '作中の杖や鍵、ケロちゃんをパッケージ入りのミニチュアチャームで再現。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4570118187123000'
  },
  {
    date: '2026-08-10',
    label: '8月第2週より順次',
    title: 'TVアニメ『ダンダダン』 つまんでつなげてますこっと',
    maker: 'バンダイ（ガシャポン）',
    price: '1回400円／全8種',
    note: 'オカルン、モモ、ジジ、ターボババアを2種類の取り付け方で楽しめるマスコット。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4570118196699000'
  },
  {
    date: '2026-08-10',
    label: '8月第2週より順次',
    title: 'HGドラゴンボール06 GOKU EDITION2',
    maker: 'バンダイ（ガシャポン）',
    price: '1回500円／全4種',
    note: '「孫悟空」にフィーチャーしたHGドラゴンボール第6弾。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4570118208408000'
  },
  {
    date: '2026-08-10',
    label: '8月第2週より順次',
    title: 'DEATH NOTE おくるみますこっとチャーム',
    maker: 'バンダイ（ガシャポン）',
    price: '1回400円／全5種',
    note: '夜神月、L、弥海砂、ニア、メロがおくるみに包まれたオリジナルデザイン。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4570118219169000'
  },
  {
    date: '2026-08-10',
    label: '8月第2週より順次',
    title: '日曜劇場『VIVANT』 まちぼうけ',
    maker: 'バンダイ（ガシャポン）',
    price: '1回500円／全6種',
    note: '乃木、野崎、薫、黒須、ノコル、ドラムが「まちぼうけ」シリーズに登場。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582769979637000'
  },
  {
    date: '2026-08-10',
    label: '8月第2週より順次',
    title: 'パワプロくん ゆれるんです。～セントラル・リーグ～',
    maker: 'バンダイ（ガシャポン）',
    price: '1回500円／全6種',
    note: 'セ・リーグ6球団のパワプロくんを、頭が揺れるボブルヘッド風フィギュアで展開。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582769935862000'
  },
  {
    date: '2026-08-10',
    label: '8月第2週より順次',
    title: 'にゃんこ大戦争 めじるしアクセサリー',
    maker: 'バンダイ（ガシャポン）',
    price: '1回300円／全6種',
    note: 'ネコ、タンクネコ、金ネコ、ネコカンなどをめじるしアクセサリー化。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582770053852000'
  },
  {
    date: '2026-08-10',
    label: '8月第2週より順次',
    title: 'Dr.MORICKY toymini series めじるしアクセサリー',
    maker: 'バンダイ（ガシャポン）',
    price: '1回300円／全5種',
    note: 'イラストレーターDr.MORICKYによる、本商品のための描き下ろしデザイン。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582769832185000'
  },
  {
    date: '2026-08-15',
    label: '8月15日週 発売',
    title: '宝箱 -The Treasure Box-',
    maker: 'タカラトミーアーツ',
    price: '1回300円／全8種',
    note: 'ふたが開閉する宝箱のミニチュア。中身やギミックの異なる全8種。',
    source: 'https://www.takaratomy-arts.co.jp/items/item.html?n=Y905742'
  },
  {
    date: '2026-08-24',
    label: '8月第4週より順次',
    title: 'VIRUSWEETS figure collection ～Summer Festival～',
    maker: 'バンダイ（ガシャポン）',
    price: '1回400円／全6種',
    note: 'かき氷、りんご飴、チョコバナナをモチーフにした、夏祭りスイーツのフィギュア。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582770027471000'
  }
];
