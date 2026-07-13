# gacha-hiroba

「ワクワクが、ここに集まる。」をコンセプトにした、オンラインガチャサービスのランディングページです。

## ローカルで確認

依存関係はありません。`index.html` をブラウザで開くか、任意の静的ファイルサーバーで配信してください。

## 公開

`main` ブランチへの push をきっかけに、GitHub ActionsからGitHub Pagesへ自動公開されます。リポジトリの Settings → Pages で、Source を **GitHub Actions** に設定してください。

Cloudflare Pages / Netlify / Vercel などでもそのまま公開できます。

## 店舗の毎日4件追加

- 掲載中データは `data/spots.js`、追加待ちは `data/spots-queue.json` です。
- `.github/workflows/daily-stores.yml` が毎日キュー先頭から正確に4件を反映します。4件未満なら部分追加せず失敗します。
- 反映時に店舗ページ、サイトマップ、フィードを再生成し、完了後は `.github/workflows/pages.yml` がGitHub Pagesを再公開します。
- キューへ追加する店舗は、公式運営元・公式施設・ガシャポン公式などの一次情報で営業中を確認し、`sourceUrl` と `verifiedAt` を保存してください。
- 追加前の検証は `node tools/validate-stores.mjs --require-queue 4`、選定だけ確認する場合はPowerShellで `$env:DRIP_FORCE='1'; $env:DRIP_DRY_RUN='1'; node tools/drip-stores.mjs` を使います。
- キューは最低28件（7日分）を維持し、全国の掲載数が少ない都道府県を優先します。

## カスタマイズ時の確認項目

- CTAのリンク先
- 問い合わせメールアドレス
- 利用規約、プライバシーポリシー、特商法表記の各URL
- 実際の商品画像、価格、ラインナップ
