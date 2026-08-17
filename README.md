# gacha-hiroba

全国のガチャガチャ・カプセルトイ設置場所、新作発売情報、店舗別掲示板を掲載する静的サイトです。

## ローカルで確認

依存関係はありません。`index.html` をブラウザで開くか、任意の静的ファイルサーバーで配信してください。

## 公開

`main` ブランチへの push をきっかけに、GitHub ActionsからGitHub Pagesへ自動公開されます。リポジトリの Settings → Pages で、Source を **GitHub Actions** に設定してください。

Cloudflare Pages / Netlify / Vercel などでもそのまま公開できます。

## 店舗データと静的ページの自動更新

- 掲載中データは `data/spots.js`、追加待ちは `data/spots-queue.json` です。
- `.github/workflows/daily-stores.yml` が毎日キュー先頭から4件を反映します。4件未満なら部分追加せず正常終了します。
- 毎回、店舗・都道府県・ブランド・ガイド・月別新作ページとサイトマップ、RSSを再生成します。差分がある場合だけコミットし、`.github/workflows/pages.yml` がGitHub Pagesを再公開します。
- キューへ追加する店舗は、公式運営元・公式施設・ガシャポン公式などの一次情報で営業中を確認し、`sourceUrl` と `verifiedAt` を保存してください。
- 追加前の検証は `node tools/validate-stores.mjs --require-queue 4`、選定だけ確認する場合はPowerShellで `$env:DRIP_FORCE='1'; $env:DRIP_DRY_RUN='1'; node tools/drip-stores.mjs` を使います。
- キューを補充するときは、全国の掲載数が少ない都道府県を優先します。

## 新作ガチャ情報

- 一次情報を確認した商品を `data/releases.js` に保存します。
- `window.GH_RELEASES_CHECKED_ON` は、公式情報を実際に再確認した日だけ更新します。
- `node tools/validate-releases.mjs && node tools/gen-release-pages.mjs && node tools/gen-sitemap.mjs && node tools/validate-seo.mjs` で月別ページと検索用データを同期します。

## 流入分析

`GA4_PROPERTY_ID` と `GA4_SA_KEY` を設定して `node tools/fetch-analytics.mjs` を実行すると、直近28日と前28日の全体・チャネル・自然検索ランディングページを比較できます。今期0件まで落ちたページも減少順に表示します。

### 運営者アクセスをGA4から除外する

所有端末で設定済みの `gh-analytics-owner-excluded-v1` を全ページのGA4読込前に確認し、除外中はタグとイベント送信を停止します。設定済み端末以外から操作ページを閲覧できないよう、設定完了後は `analytics-control.html` と専用スクリプトを公開対象から削除しています。

- 除外中はGA4タグを読み込まず、検索や店舗詳細などのイベントも送信しません。
- 設定はブラウザのlocalStorageに保存されます。プライベートブラウズ、サイトデータの削除、別プロファイルでは再設定が必要です。
- localhost、GitHub Pagesのプレビュー、その他の非本番ホストは常に計測対象外です。
- 過去に記録済みの自己アクセスは遡って消えないため、公開・設定完了日以降をクリーンな比較期間として扱います。
- 新しい端末を追加するときだけ、Git履歴から設定ページを一時的に復元し、設定後に再び削除します。

## カスタマイズ時の確認項目

- CTAのリンク先
- 問い合わせメールアドレス
- 利用規約、プライバシーポリシー、特商法表記の各URL
- 実際の商品画像、価格、ラインナップ
