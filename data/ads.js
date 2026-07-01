/* ===========================================================================
   アフィリエイト広告データ
   ★ ここに広告を1つ追加するだけで、全ページのサイドバー広告枠に表示されます。

   2種類の書き方に対応：
     A) 画像バナー等のHTMLをそのまま貼る： { html: '<a ...><img ...></a>' }
        （楽天アフィリエイトの「画像リンク」、ASPのバナータグなど）
        → 見出し＋「楽天市場で見る ▶」CTAボタン付きのカードで表示されます。
     B) シンプルな商品カード： { emoji:'🪙', title:'…', note:'…', url:'https://…', badge:'PR' }

   ※ <script> を使うウィジェット（楽天スライド等）は innerHTML では動かないため、
     HTMLに直接埋め込みます（例：index.html のトップ横長バナー）。
   ※ 掲載時は「広告」ラベル＋下部にアフィリエイト表記が自動で付きます（ステマ規制対応）。
   =========================================================================== */
window.GH_ADS = {

  /* 広告枠に添える表記（ステマ規制対応）。空文字にすると非表示。 */
  disclosure: '※ 当サイトは楽天アフィリエイト・Amazonアソシエイト等のアフィリエイトプログラムを利用しており、リンクを経由した購入により収入を得ることがあります。',

  /* 1枠に表示する最大件数 */
  maxPerSlot: 4,

  /* 広告（上から順に表示） */
  products: [

    /* 楽天アフィリエイト 画像リンク（そのまま掲載・タグ改変なし） */
    { html: '<a href="https://hb.afl.rakuten.co.jp/hsc/5547dfc6.546f7c0d.5547dfc7.ed412751/?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOiIxIiwiYmFuIjoyNzYyNDgyLCJhbXAiOmZhbHNlfQ%3D%3D" target="_blank" rel="nofollow sponsored noopener" style="word-wrap:break-word;"><img src="https://hbb.afl.rakuten.co.jp/hsb/5547dfc6.546f7c0d.5547dfc7.ed412751/?me_id=2100001&me_adv_id=2762482&t=pict" border="0" style="margin:2px" alt="" title=""></a>' },

    { html: '<a href="https://hb.afl.rakuten.co.jp/hsc/5564759c.96df2cee.5547dfc7.ed412751/?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOiI0NCIsImJhbiI6Mjc5NDg1OCwiYW1wIjpmYWxzZX0%3D" target="_blank" rel="nofollow sponsored noopener" style="word-wrap:break-word;"><img src="https://hbb.afl.rakuten.co.jp/hsb/5564759c.96df2cee.5547dfc7.ed412751/?me_id=1&me_adv_id=2794858&t=pict" border="0" style="margin:2px" alt="" title=""></a>' },

    { html: '<a href="https://hb.afl.rakuten.co.jp/hsc/556475fe.727454bc.5547dfc7.ed412751/?link_type=pict&ut=eyJwYWdlIjoic2hvcCIsInR5cGUiOiJwaWN0IiwiY29sIjoxLCJjYXQiOiI1OCIsImJhbiI6MzIzMDk1MCwiYW1wIjpmYWxzZX0%3D" target="_blank" rel="nofollow sponsored noopener" style="word-wrap:break-word;"><img src="https://hbb.afl.rakuten.co.jp/hsb/556475fe.727454bc.5547dfc7.ed412751/?me_id=1&me_adv_id=3230950&t=pict" border="0" style="margin:2px" alt="" title=""></a>' }

    /* ↓ 商品カードを足す例（// を外して url を差し替え）
    ,{ emoji:'🪙', title:'コインケース（200・500円硬貨用）', note:'ガチャ用の小銭入れ', url:'https://hb.afl.rakuten.co.jp/hgc/xxxxxxxx/', badge:'PR' }
    */

  ]
};
