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
| `world/` | SYNESTHESIA WORLD のページ。`world/news.json` は毎朝のニュース |
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
5. ダッシュボードの **Workers & Pages** 右側（または **Overview**）にある **Account ID** をコピーします。
6. GitHub のリポジトリで **Settings → Secrets and variables → Actions → New repository secret** から、次の2つを登録します。

   | 名前 | 中身 |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | 手順4のトークン |
   | `CLOUDFLARE_ACCOUNT_ID` | 手順5の Account ID |

7. **Actions** タブで「Deploy FRIEND SNS API」を選び、**Run workflow** を押します。データベースと保存場所が自動で作られ、裏側が配備され、サイトが再公開されます（5分ほど）。
8. `https://www.kengo-umetani.com/friends/app/` を開き、**最初のメンバー（管理者）として登録**します。このとき友人に伝える**合言葉**を決めます。

### ふだんの使い方

- 友人には「`https://www.kengo-umetani.com/friends/`」と「合言葉」を伝えるだけで参加できます。
- 合言葉の変更、メンバーの利用停止、パスワードの再設定、容量の確認は、アプリの **その他 → 設定**（管理者のみ表示）から行えます。
- `friends-api/` や `friends-app/` を変更して main に push すると、裏側とサイトが自動で更新されます。
