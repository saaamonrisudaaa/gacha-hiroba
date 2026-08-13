/* ==========================================================================
   アフィリエイト広告データ

   ガチャひろばの閲覧目的に合う広告だけを、ページ別の固定枠へ表示する。
   同じ案件の画像サイズ違いは重複掲載せず、画面幅に合わせて切り替える。
   ========================================================================== */
(function () {
  'use strict';

  const sanrioUrl = 'https://hb.afl.rakuten.co.jp/hgc/5599358c.6687774a.5547dfc7.ed412751/?pc=http%3A%2F%2Fwww.rakuten.co.jp%2Fsanrio%2F&link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOjEsImJhbiI6MjIyOSwiYW1wIjpmYWxzZX0%3D';
  const poohUrl = 'https://hb.afl.rakuten.co.jp/ichiba/5689e593.1b1cd114.5689e594.ce62ad0d/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fbook%2F18767964%2F&link_type=picttext&ut=eyJwYWdlIjoiaXRlbSIsInR5cGUiOiJwaWN0dGV4dCIsInNpemUiOiI0MDB4NDAwIiwibmFtIjoxLCJuYW1wIjoicmlnaHQiLCJjb20iOjEsImNvbXAiOiJkb3duIiwicHJpY2UiOjEsImJvciI6MSwiY29sIjoxLCJiYnRuIjoxLCJwcm9kIjowLCJhbXAiOmZhbHNlfQ%3D%3D';
  const poohCtaUrl = 'https://hb.afl.rakuten.co.jp/ichiba/5689e593.1b1cd114.5689e594.ce62ad0d/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fbook%2F18767964%2F%3Fscid%3Daf_pc_bbtn&link_type=picttext&ut=eyJwYWdlIjoiaXRlbSIsInR5cGUiOiJwaWN0dGV4dCIsInNpemUiOiI0MDB4NDAwIiwibmFtIjoxLCJuYW1wIjoicmlnaHQiLCJjb20iOjEsImNvbXAiOiJkb3duIiwicHJpY2UiOjEsImJvciI6MSwiY29sIjoxLCJiYnRuIjoxLCJwcm9kIjowLCJhbXAiOmZhbHNlfQ==';
  const waterUrl = 'https://hb.afl.rakuten.co.jp/ichiba/5689e5e4.64edded5.5689e5e5.3d7fcf79/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fdrink-partner%2Firohasu5p_2%2F&link_type=pict&ut=eyJwYWdlIjoiaXRlbSIsInR5cGUiOiJwaWN0Iiwic2l6ZSI6IjQwMHg0MDAiLCJuYW0iOjEsIm5hbXAiOiJyaWdodCIsImNvbSI6MSwiY29tcCI6ImRvd24iLCJwcmljZSI6MSwiYm9yIjoxLCJjb2wiOjEsImJidG4iOjEsInByb2QiOjAsImFtcCI6ZmFsc2V9';

  window.GH_ADS = {
    disclosure: '※ 当サイトは楽天アフィリエイト等のアフィリエイトプログラムを利用しており、リンクを経由した購入により収入を得ることがあります。',

    campaigns: {
      sanrio: {
        id: 'rk_sanrio_shop_2229',
        shop: 'サンリオ公式 楽天市場店',
        eyebrow: 'サンリオの新作が気になった方へ',
        title: 'サンリオ公式ショップでキャラクターグッズを探す',
        description: '楽天市場のサンリオ公式ショップで、気になるキャラクターの関連グッズを探せます。',
        note: '※価格・在庫はリンク先でご確認ください。',
        url: sanrioUrl,
        ctaUrl: sanrioUrl,
        cta: 'サンリオ公式ショップを見る',
        desktopImage: 'https://hbb.afl.rakuten.co.jp/hlb/5599358c.6687774a.5547dfc7.ed412751/?sid=1&shop=sanrio&size=2&kind=1&me_id=1200352&me_adv_id=2229&t=logo',
        mobileImage: 'https://hbb.afl.rakuten.co.jp/hlb/5599358c.6687774a.5547dfc7.ed412751/?sid=1&shop=sanrio&size=1&kind=2&me_id=1200352&me_adv_id=2229&t=logo',
        sidebarImage: 'https://hbb.afl.rakuten.co.jp/hlb/5599358c.6687774a.5547dfc7.ed412751/?sid=1&shop=sanrio&size=1&kind=1&me_id=1200352&me_adv_id=2229&t=logo',
        imageAlt: 'サンリオ公式 楽天市場店',
        desktopCreative: 'size2_kind1',
        mobileCreative: 'size1_kind2',
        sidebarCreative: 'size1_kind1'
      },
      pooh: {
        id: 'rk_pooh_hanyu_18767964',
        shop: '楽天ブックス',
        eyebrow: '関連コレクターアイテム',
        title: '羽生結弦とくまのプーさん メモリーブック',
        description: 'きせかえ衣装プーぬいぐるみ付き。商品内容や最新の在庫状況をリンク先で確認できます。',
        price: '価格：22,000円（税込・送料無料／2026年8月13日時点）',
        note: '※価格・在庫は変更される場合があります。',
        url: poohUrl,
        ctaUrl: poohCtaUrl,
        cta: '楽天ブックスで商品詳細を見る',
        desktopImage: 'https://hbb.afl.rakuten.co.jp/hgb/5689e593.1b1cd114.5689e594.ce62ad0d/?me_id=1213310&item_id=22065730&pc=https%3A%2F%2Fthumbnail.image.rakuten.co.jp%2F%400_mall%2Fbook%2Fcabinet%2F3392%2F9784065443392.jpg%3F_ex%3D400x400&s=400x400&t=picttext',
        mobileImage: 'https://hbb.afl.rakuten.co.jp/hgb/5689e593.1b1cd114.5689e594.ce62ad0d/?me_id=1213310&item_id=22065730&pc=https%3A%2F%2Fimage.rakuten.co.jp%2Fbook%2Fcabinet%2F3392%2F9784065443392_4.jpg%3F_ex%3D128x128&s=128x128&t=picttext',
        sidebarImage: 'https://hbb.afl.rakuten.co.jp/hgb/5689e593.1b1cd114.5689e594.ce62ad0d/?me_id=1213310&item_id=22065730&pc=https%3A%2F%2Fimage.rakuten.co.jp%2Fbook%2Fcabinet%2F3392%2F9784065443392_4.jpg%3F_ex%3D128x128&s=128x128&t=picttext',
        imageAlt: '羽生結弦とくまのプーさん メモリーブック',
        desktopCreative: '400x400',
        mobileCreative: '128x128',
        sidebarCreative: '128x128'
      },
      water: {
        id: 'rk_water_irohasu5p2',
        shop: '楽天市場',
        eyebrow: '店舗巡りのお出かけ前に',
        title: '外出用の飲み物を準備',
        description: '長時間のガチャ店舗巡りに備えて、持ち歩き用の飲み物を楽天市場で確認できます。',
        note: '※価格・在庫・商品内容はリンク先でご確認ください。',
        url: waterUrl,
        ctaUrl: waterUrl,
        cta: '楽天市場で商品詳細を見る',
        desktopImage: 'https://hbb.afl.rakuten.co.jp/hgb/5689e5e4.64edded5.5689e5e5.3d7fcf79/?me_id=1365950&item_id=10000297&pc=https%3A%2F%2Fimage.rakuten.co.jp%2Fdrink-partner%2Fcabinet%2Flp_img%2Fimgrc0095770734.jpg%3F_ex%3D400x400&s=400x400&t=pict',
        mobileImage: 'https://hbb.afl.rakuten.co.jp/hgb/5689e5e4.64edded5.5689e5e5.3d7fcf79/?me_id=1365950&item_id=10000297&pc=https%3A%2F%2Fimage.rakuten.co.jp%2Fdrink-partner%2Fcabinet%2Flp_img%2Fimgrc0095770734.jpg%3F_ex%3D400x400&s=400x400&t=pict',
        imageAlt: '外出時の飲み物の商品画像',
        desktopCreative: '400x400',
        mobileCreative: '400x400'
      }
    },

    placements: {
      homeHot: ['sanrio'],
      newsReleases: ['sanrio'],
      newsCollector: ['pooh'],
      releaseArchive: ['sanrio'],
      storeOuting: ['water']
    },

    gachaGoodsHeading: '🎁 ガチャ好き向けアイテム',
    gachaGoods: [
      { id: 'rk_search_gacha_machine', emoji: '🎰', title: '家庭用ガチャガチャマシン', note: '誕生日やイベントで使えるガチャ本体を探す', url: 'https://hb.afl.rakuten.co.jp/hgc/5599358c.6687774a.5547dfc7.ed412751/?pc=' + encodeURIComponent('https://search.rakuten.co.jp/search/mall/ガチャガチャ 本体 おもちゃ/') },
      { id: 'rk_search_capsule_set', emoji: '🥠', title: 'カプセルトイの詰め合わせ', note: 'カプセルトイのセット商品を探す', url: 'https://hb.afl.rakuten.co.jp/hgc/5599358c.6687774a.5547dfc7.ed412751/?pc=' + encodeURIComponent('https://search.rakuten.co.jp/search/mall/カプセルトイ 詰め合わせ/') },
      { id: 'rk_search_display_case', emoji: '🗄️', title: 'コレクションケース', note: '集めたミニフィギュアを飾るケースを探す', url: 'https://hb.afl.rakuten.co.jp/hgc/5599358c.6687774a.5547dfc7.ed412751/?pc=' + encodeURIComponent('https://search.rakuten.co.jp/search/mall/コレクションケース フィギュア/') },
      { id: 'rk_sanrio_shop_2229', emoji: '🎀', title: 'サンリオ公式 楽天市場店', note: 'キャラクター関連グッズを公式ショップで探す', url: sanrioUrl },
      { id: 'rk_search_chiikawa', emoji: '🧸', title: 'ちいかわのガチャ・グッズ', note: 'ちいかわ関連のカプセルトイやグッズを探す', url: 'https://hb.afl.rakuten.co.jp/hgc/5599358c.6687774a.5547dfc7.ed412751/?pc=' + encodeURIComponent('https://search.rakuten.co.jp/search/mall/ちいかわ ガチャ/') },
      { id: 'rk_search_keyholder_parts', emoji: '🔑', title: 'キーホルダー・交換用パーツ', note: 'ボールチェーンなどの交換用品を探す', url: 'https://hb.afl.rakuten.co.jp/hgc/5599358c.6687774a.5547dfc7.ed412751/?pc=' + encodeURIComponent('https://search.rakuten.co.jp/search/mall/キーホルダー パーツ カプセルトイ/') }
    ],

    /* サイドバーはガチャ関連2件＋公式ショップ1件に絞る。 */
    products: [{ campaignId: 'sanrio' }],
    maxPerSlot: 3
  };
})();
