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
window.GH_RELEASES_CHECKED_ON = '2026-08-22';

window.GH_RELEASES = [
  {
    date: '2026-08-24',
    label: '8月24日発売',
    title: '殻からの脱出。 マスコットフィギュア',
    maker: 'Qualia',
    price: '1回400円／全6種',
    note: '「殻からの脱出。」を題材にした、全6種のマスコットフィギュア。',
    source: 'https://www.qualia-45.jp/product/view/2031'
  },
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
    title: 'にゃんこ大戦争 めじるしアクセサリー',
    maker: 'バンダイ（ガシャポン）',
    price: '1回300円／全6種',
    note: 'ネコ、タンクネコ、金ネコ、ネコカンなどをめじるしアクセサリー化。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582770053852000'
  },
  {
    date: '2026-08-10',
    label: '8月10日週 発売',
    title: 'つながリングチャーム どうぶつの森',
    maker: 'タカラトミーアーツ',
    price: '1回300円／全8種',
    note: '「どうぶつの森」の住民たちを、上下につなげて持ち物のめじるしにできるリングチャーム。',
    source: 'https://www.takaratomy-arts.co.jp/items/item.html?n=Y906893'
  },
  {
    date: '2026-08-10',
    label: '8月10日週 発売',
    title: 'トイ・ストーリー Hide&Seek かくれんぼフィギュア アンディのおもちゃ オールスターズ',
    maker: 'タカラトミーアーツ',
    price: '1回400円／全8種',
    note: '帽子や双眼鏡などのおなじみアイテムで顔を隠した、全8種のかくれんぼフィギュア。',
    source: 'https://www.takaratomy-arts.co.jp/items/item.html?n=Y909481'
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
    date: '2026-08-15',
    label: '8月15日週 発売',
    title: 'PEANUTS I LIKE... Color Face Pouch',
    maker: 'タカラトミーアーツ',
    price: '1回500円／全6種',
    note: '2026年テーマの表情とカラーを使った、カラビナ付きのスヌーピーフェイス型ポーチ。',
    source: 'https://www.takaratomy-arts.co.jp/items/item.html?n=Y908187'
  },
  {
    date: '2026-08-17',
    label: '8月第3週より順次',
    title: 'サンリオキャラクターズ Solid & Cool style めじるしアクセサリー',
    maker: 'バンダイ（ガシャポン）',
    price: '1回300円／全5種',
    note: 'サンリオキャラクターを、ビビッドな色使いとクールなポーズのストリートスタイルでデザイン。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4570118186805000'
  },
  {
    date: '2026-08-24',
    label: '8月第4週より順次',
    title: 'VIRUSWEETS figure collection ～Summer Festival～',
    maker: 'バンダイ（ガシャポン）',
    price: '1回400円／全6種',
    note: 'かき氷、りんご飴、チョコバナナをモチーフにした、夏祭りスイーツのフィギュア。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582770027471000'
  },
  {
    date: '2026-08-24',
    label: '8月第4週より順次',
    title: 'データカードダス アイカツ！ ミニチュアコレクション',
    maker: 'バンダイ（ガシャポン）',
    price: '1回500円／全5種',
    note: '歴代のデータカードダス筐体を小さく再現。ラインナップのうち2種は当時の音声を楽しめる仕様。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582769810541000'
  },
  {
    date: '2026-08-24',
    label: '8月第4週より順次',
    title: 'HG ONE PIECE 02',
    maker: 'バンダイ（ガシャポン）',
    price: '1回500円／全4種',
    note: 'ルフィ、シャンクス、ティーチ、バギーの「新四皇」をそろえたHGシリーズ第2弾。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4570118206626000'
  },
  {
    date: '2026-08-24',
    label: '2026年8月下旬発売',
    title: 'CAPWATCH ベーシックカラー1',
    maker: 'キタンクラブ',
    price: '1回500円／全7種',
    note: 'カプセルトイと腕時計を組み合わせた新シリーズ。7色のシリコンベルトを選べるアナログ時計。',
    source: 'https://kitan.jp/products/capwatch_basic/'
  },
  {
    date: '2026-08-31',
    label: '8月第5週より順次',
    title: 'ポケットモンスター スイングコレクション Type:Grass',
    maker: 'バンダイ（ガシャポン）',
    price: '1回300円／全5種',
    note: 'リーフィア、ドレディア、ナゾノクサ、モクロー、セレビィを集めた、くさタイプのスイング。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582770054132000'
  },
  {
    date: '2026-08-31',
    label: '8月第5週より順次',
    title: '米津玄師 ミニCDコレクション',
    maker: 'バンダイ（ガシャポン）',
    price: '1回500円／全11種',
    note: 'CD作品を開閉できるケース、見開きのブックレット、取り外せるディスクで表現。シークレット1種を含む。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582769911255000'
  },
  {
    date: '2026-08-31',
    label: '8月第5週より順次',
    title: 'TOY STORY5 ブリスターチャームコレクション',
    maker: 'バンダイ（ガシャポン）',
    price: '1回400円／全5種',
    note: 'ウッディやバズ・ライトイヤーなどを、ブリスターパッケージ風のチャームにした全5種。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4570118186607000'
  },
  {
    date: '2026-08-31',
    label: '8月第5週より順次',
    title: 'サンリオキャラクターズ みんなでおめかしフィギュア',
    maker: 'バンダイ（ガシャポン）',
    price: '1回300円／全5種',
    note: 'ハローキティ、ディアダニエル、クロミ、マイメロディ、ウサハナを個性の異なるメイク姿で立体化。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582769978920000'
  },
  {
    date: '2026-08-31',
    label: '8月第5週より順次',
    title: '僕のヒーローアカデミア すわらせ隊2',
    maker: 'バンダイ（ガシャポン）',
    price: '1回400円／全4種',
    note: '緑谷出久、爆豪勝己、オールマイト、死柄木弔を座り姿で立体化したシリーズ第2弾。',
    source: 'https://gashapon.jp/products/detail.php?jan_code=4582769995767000'
  }
];
