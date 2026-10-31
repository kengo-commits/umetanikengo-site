# KENGO UMETANI OFFICIAL

梅谷憲吾 公式サイト（www.umetanikengo.com）のソース一式です。
GitHub に置くと、GitHub Pages で無料公開され、Instagram の新しい投稿が **3時間ごとに自動で** サイトの SNS 欄に反映されます。

## しくみ

1. GitHub Actions が3時間ごとに Instagram の公式API から最新の投稿を取得します。
2. 写真をWeb用に変換し、投稿の文章（1段落目をタイトル、2段落目を本文）と一緒に保存します。
3. サイト全体を作り直して、GitHub Pages に公開します。

閲覧者のブラウザが Instagram に接続することはないので、Cookie は使いません。
Instagram に接続できなかったときは、前回の投稿をそのまま表示します。

## フォルダ構成

| 場所 | 内容 |
|---|---|
| `build.py` | サイトを作るプログラム（`dist/` に出力） |
| `data/content.json` | CREATIVE の施設紹介など |
| `data/instagram.json` | 表示中の Instagram 投稿（自動更新） |
| `data/instagram-settings.json` | 先頭に固定する投稿・表示件数 |
| `assets/` | 共通のデザイン（CSS）と動き（JS） |
| `images/` | サイトの写真。`images/instagram/` は自動更新 |
| `world/` | KENGO'S SYNESTHESIA のページ。`world/news.json` は毎朝のニュース、`world/plates.json` は毎日の作品、`world/weekly.json` は日曜の Weekly、`world/art/` は毎日のデジタルアートの静止画（共有用） |
| `scripts/world_pages.py` | KENGO'S SYNESTHESIA の日付ページ（`/synesthesia-world/YYYY/MM/DD/`）、Notes / Weekly / From Japan / Objects / Rights、英語版 `/en/`、フィード（`feed.xml` `feed.json` `pins.xml`）、検索用 `search.json` を生成 |
| `scripts/render_art.py` | 毎日のデジタルアートを OGP 用（1200×630）とストーリーズ用（1080×1920）の PNG に描き出す |
| `scripts/weekly_report.py` | 週次レポート（`reports/`）。アクセス解析と Instagram のフォロワー数をまとめる |
| `.github/workflows/weekly-report.yml` | 毎週月曜に週次レポートを書く設定 |
| `scripts/fetch_instagram.py` | Instagram から投稿を取得するプログラム |
| `.github/workflows/deploy.yml` | 自動更新と公開の設定 |
| `friends-app/` | KENGO FRIEND SNS（友人だけのSNS）の画面。`/friends/app/` として公開されます |
| `friends-api/` | KENGO FRIEND SNS の裏側（Cloudflare Worker + D1 + R2）。`data/friends-api.json` に公開先のアドレスが記録されます |
| `.github/workflows/friends-api.yml` | KENGO FRIEND SNS の裏側を Cloudflare に配備する設定 |

## 初回の設定（1回だけ）

### 1. Instagram をプロアカウントにする
Instagram アプリの「設定とアクティビティ」→「アカウントの種類とツール」から、**プロアカウント（クリエイターまたはビジネス）** に切り替えます。無料です。

### 2. Meta のアプリを作り、アクセストークンを発行する
1. https://developers.facebook.com/ に Facebook アカウントでログインし、開発者登録をします。
2. 「アプリを作成」→ 用途で **Instagram（Instagram API）** を選びます。
3. 「Instagram ログインによる API の設定」で、Instagram アカウント（@kengo_umetani）を追加します。
4. 「アクセストークンを生成」を押し、表示された **長期アクセストークン** をコピーします（約60日有効。以降は自動で延長します）。

画面の名前は Meta 側で変わることがあります。迷ったら画面のスクリーンショットを制作担当に送ってください。

### 3. GitHub にリポジトリを作る
1. https://github.com/ でアカウントを作り、新しいリポジトリ（例：`umetanikengo-site`）を作成します。
2. このフォルダの中身をすべてアップロードします。

### 4. トークンを登録する
リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で、次の2つを登録します。

| 名前 | 中身 |
|---|---|
| `IG_TOKEN` | 手順2でコピーした Instagram の長期アクセストークン |
| `GH_PAT` | GitHub の個人アクセストークン（Fine-grained、このリポジトリの **Secrets: Read and write** 権限）。トークンの自動延長を保存するために使います |

`GH_PAT` がなくても動きますが、その場合は約60日ごとに `IG_TOKEN` を手で更新する必要があります。

### 5. GitHub Pages を有効にする
**Settings → Pages** で、Source を **GitHub Actions** にします。
その後 **Actions** タブで「Update Instagram and publish」を選び、「Run workflow」を押すと初回の公開が始まります。

### 6. ドメインをつなぐ
**Settings → Pages → Custom domain** に `www.umetanikengo.com` を入力し、ドメインの管理画面（現在のJimdo、またはドメインを取得した会社）で次の DNS を設定します。

| 種類 | ホスト | 値 |
|---|---|---|
| CNAME | www | `<GitHubのユーザー名>.github.io` |
| A | @ | 185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153 |

反映まで数時間かかることがあります。反映後、「Enforce HTTPS」にチェックを入れてください。

## ふだんの使い方

- **Instagram に投稿するだけ**で、3時間以内にサイトに反映されます。すぐ反映したいときは Actions タブで「Run workflow」を押します。
- **先頭に固定する投稿**は、`data/instagram-settings.json` の `pinned` に投稿URLの `/p/` の後ろの文字列を並べます。Instagram のプロフィールで固定表示している投稿と同じものにしておくと、並び順がプロフィールとそろいます（API からは固定表示の情報が取れないため）。
- **表示件数**は同じファイルの `count` で変えられます（初期値 12）。
- 文章や写真を直したいときは、`data/` と `images/` を更新します。

## KENGO FRIEND SNS（友人だけのSNS）

`https://www.kengo-umetani.com/friends/` が入口ページ、`/friends/app/` が本体です。投稿やメッセージのデータは Cloudflare（D1）に、写真・動画は Cloudflare R2 に保存されます。無料枠（R2 は 10GB、Worker は1日10万リクエスト）の範囲なら料金はかかりません。

### 初回の設定（1回だけ）

1. https://dash.cloudflare.com/ でアカウントを作ります（無料）。
2. 左メニューの **Workers & Pages** を開きます。初回はサブドメイン（例：`kengo-umetani`）を決める画面が出るので登録します。
3. 左メニューの **R2 Object Storage** を開き、案内に従って R2 を有効にします（支払い情報の登録が求められますが、無料枠の範囲では請求されません）。
4. 右上のプロフィール → **API Tokens** → **Create Token** → テンプレート **Edit Cloudflare Workers** を選び、権限に次の2つを追加して作成します。
   - **Account / D1 / Edit**
   - **Account / Workers R2 Storage / Edit**
   表示されたトークンをコピーします（この画面を閉じると二度と表示されません）。
5. GitHub のリポジトリで **Settings → Secrets and variables → Actions → New repository secret** から、次を登録します（上の欄 Name に名前、下の欄 Secret に中身）。

   | 名前 | 中身 |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | 手順4のトークン |

   Account ID（ダッシュボードのアドレスの先頭にある32文字）は `.github/workflows/friends-api.yml` の `CLOUDFLARE_ACCOUNT_ID` に書いてあります。アカウントを変えたときはそこを書き換えます。
6. **初期設定キー（`OWNER_SETUP_KEY`）を Worker の Secret に登録します。** 最初に登録した人が管理者になる仕組みなので、このキーを知らない人が先に管理者になれないようにするためのものです。
   手元のPCで（`friends-api/` フォルダで `npm ci` を済ませてから）次を実行し、長めのランダムな文字列を入力します。入力した値は手順8で使うので控えておきます。

   ```sh
   cd friends-api
   CLOUDFLARE_API_TOKEN=手順4のトークン CLOUDFLARE_ACCOUNT_ID=アカウントID npx wrangler secret put OWNER_SETUP_KEY
   ```

   （Cloudflare ダッシュボードの **Workers & Pages → kengo-friend-sns → Settings → Variables and Secrets** から `OWNER_SETUP_KEY` を Secret として追加しても同じです。）管理者の登録が終わったあとは、このキーは使われません。

7. **Actions** タブで「Deploy FRIEND SNS API」を選び、**Run workflow** を押します。データベースと保存場所が自動で作られ、裏側が配備され、サイトが再公開されます（5分ほど）。
8. `https://www.kengo-umetani.com/friends/app/` を開き、**最初のメンバー（管理者）として登録**します。このとき手順6の**初期設定キー**と、友人に伝える**合言葉**を入力します。
9. **サインイン画面への総当たり対策（Cloudflare のレート制限ルール）を1つ追加します。** Worker の中にも簡易的な制限（同じIPから1分に10回まで）は入っていますが、Cloudflare 側のルールのほうが確実です。
   ダッシュボードの **Security → WAF → Rate limiting rules → Create rule**（Workers の場合は **Workers & Pages → kengo-friend-sns → Settings → Triggers / Security** 配下に表示されることもあります）で次のように設定します。

   | 項目 | 値 |
   |---|---|
   | Rule name | `friend-sns-auth` |
   | If incoming requests match | URI Path **starts with** `/auth/` |
   | With the same characteristics | IP |
   | When rate exceeds | **10** requests per **1 minute** |
   | Then take action | Block（期間 1 minute 以上） |

### しくみのメモ（セキュリティ）

- 写真・動画（`/media/:id`）はメンバー以外には配信されません。アプリが `/auth/me` と `/sync` で受け取る短命の署名付きトークン（有効1時間）を `?t=` として付けて取得します。
- パスワードは PBKDF2-SHA256（100,000回）で保存します。以前の形式（6,000回）で保存されているメンバーは、次回サインインしたときに自動で新しい形式に置き換わります（本人の操作は不要）。
- サインインの有効期限は30日です。期限が切れたら、ユーザー名とパスワードでサインインし直すだけです。
- `wrangler.toml` の本番用の許可オリジンに `localhost` は含めていません。手元で動かすときは `npx wrangler dev --env dev` を使います。

### ふだんの使い方

- 友人には「`https://www.kengo-umetani.com/friends/`」と「合言葉」を伝えるだけで参加できます。
- 合言葉の変更、メンバーの利用停止、パスワードの再設定、容量の確認は、アプリの **その他 → 設定**（管理者のみ表示）から行えます。
- `friends-api/` や `friends-app/` を変更して main に push すると、裏側とサイトが自動で更新されます。
