# AItalk — AI英会話アプリ

話した分だけうまくなる、**スピーキング中心**の英会話学習アプリ。
[Speak](https://www.speak.com/jp) を参考に、AI講師との会話・カリキュラム・
発話フィードバック・継続の記録を1つにまとめています。
日本語UI / 英語コンテンツ、**スマホアプリとしてインストールできる PWA** です。

```
ブラウザ (React SPA / PWA)
  ├─ Service Worker …… アプリシェルをキャッシュ（ホーム画面から起動できる）
  ├─ Web Speech API …… 音声認識と読み上げはすべて端末内で完結
  └─ fetch /api/*（Cookie 自動送信）
        ↓
   Hono API (Node / Railway)
      ├─ Google OAuth 2.0（認可コードフロー・ログイン必須）
      ├─ @anthropic-ai/sdk → claude-opus-5
      └─ Postgres … users / progress（学習記録をアカウントに保存）
```

## 機能

| | 内容 |
|---|---|
| **AI講師とフリートーク** | 8つの話題から選んで自由に英会話。話すたびに添削・日本語訳・次に言えるフレーズが返る |
| **カリキュラム** | 3コース / 8ユニット / **24レッスン**。各ユニットは「解説 → フレーズ練習 → ロールプレイ → フリートーク」の4段構成 |
| **ユニット冒頭の解説** | 各ユニットの最初に、要点をまとめたスライド解説（読み上げ付き）。設定すれば参考動画も自動で添えられる |
| **発話フィードバック** | 語ごとに聞き取り結果を色分け表示し、0〜100の認識スコアを出す（後述の注意点を参照） |
| **継続の記録** | 連続日数・XP・1日の目標リング・間違いから自動生成される復習リスト（間隔反復） |
| **アカウント同期** | Google ログインで、学習記録が端末をまたいで引き継がれる |

## セットアップ

```bash
npm install
cp .env.example .env     # 少なくとも Google の3つを設定（下記）
npm run dev              # API :3000 + Vite :5173 → http://localhost:5173
```

**ログイン必須です。** 匿名で使えるモードはありません。ローカルで動かすにも
Google の OAuth クライアントが必要です（作り方は下記）。

**音声認識には安全なコンテキスト（HTTPS または localhost）が必要です。**
LAN の IP アドレス（`192.168.x.x` など）では動かないので、実機で試すときは
デプロイ先の HTTPS URL を使ってください。

### スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | API と Vite を同時起動（`/api` は Vite が :3000 へ proxy） |
| `npm run build` | SPA と Service Worker を `dist/` にビルド |
| `npm start` | `dist/` の配信 + API（Railway が実行するのと同じ構成） |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | マージ規則・認証・（DBがあれば）進捗ストアの検証 |

`npm test` の進捗ストアの検証はデータベースが要ります。無ければ自動でスキップされます:

```bash
TEST_DATABASE_URL="postgres://…" npm test
```

## 環境変数

| 変数 | 必須 | 用途 |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | Google Cloud Console で発行 |
| `SESSION_SECRET` | ✅ | セッション Cookie の署名鍵。変更すると全員ログアウトされる |
| `ALLOWED_EMAILS` | ✅ | ログインを許可するメールアドレス（カンマ区切り） |
| `APP_URL` | ローカルのみ | 公開オリジン。Railway では `RAILWAY_PUBLIC_DOMAIN` から自動導出されるため設定不要（独自ドメイン時のみ設定） |
| `DATABASE_URL` | 推奨 | Railway の Postgres が注入。無い場合は進捗が端末内のみになる |
| `ANTHROPIC_API_KEY` | 任意 | 未設定ならAI講師は固定のサンプル応答（モックモード） |
| `YOUTUBE_API_KEY` | 任意 | 未設定なら解説はスライドのみ（下記） |
| `PORT` | 任意 | Railway が注入 |

## Google ログインの設定

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) でプロジェクトを作る
2. **OAuth consent screen** を設定
   - User type は **External**
   - スコープは既定のまま（このアプリは `openid email profile` しか要求しません）
   - **Publishing status は「In production」にして構いません。**
     非センシティブなスコープのみなので Google の審査は不要で、
     テストユーザー登録も警告画面も7日での失効も発生しません
3. **Create credentials → OAuth client ID → Web application**
4. **Authorized redirect URIs** に以下を追加（**完全一致**・HTTPS 必須。localhost だけ例外）

   | 環境 | 登録する値 |
   |---|---|
   | ローカル | `http://localhost:3000/api/auth/callback` |
   | Railway | `https://<Railwayが発行したドメイン>/api/auth/callback` |

   Railway のドメインは **Settings → Networking → Generate Domain** で発行され、
   `xxxxx.up.railway.app` の形になります。たとえば発行された値が
   `aitalk-production-a1b2.up.railway.app` なら、登録するのは

   ```
   https://aitalk-production-a1b2.up.railway.app/api/auth/callback
   ```

   です。起動時にサーバーが実際に使う値をログへ出力するので、そこからコピーするのが確実です:

   ```
   [aitalk] OAuth redirect URI (register this with Google): https://…/api/auth/callback
   ```

   ローカルと本番の両方を登録しておけば、どちらでも動きます。
5. 発行された **Client ID / Client secret** を環境変数に設定

> **⚠️ `ALLOWED_EMAILS` がアクセス制限のすべてです。**
> 上のとおり Google 側は誰でも通します。このリストが空だと誰もログインできず（fail closed）、
> 設定を誤って広げると誰でも入れてしまい、API 利用料が青天井になります。
> デプロイ時に必ず内容を確認してください。

`SESSION_SECRET` の生成:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Railway へのデプロイ

**設定ファイルは不要です。** ビルダー（Railpack）が `package.json` を読み、
`npm ci` → `npm run build` → `npm start` を自動で実行します。
Node のバージョンは `engines.node` と `.node-version` で 22 に固定してあります。

1. [railway.com](https://railway.com) で **New Project → GitHub repo** → `IsamuTakiguchi/AItalk`（ブランチは `main`）
2. **+ New → Database → PostgreSQL** を同じプロジェクトに追加する
   - 同一プロジェクト内なので `DATABASE_URL`（プライベート接続）が自動で使えます。
     `DATABASE_PUBLIC_URL` は TCP プロキシ経由で Egress 課金が発生するため使いません
   - テーブルは初回起動時に自動作成されます（マイグレーション作業は不要）
3. **Variables** に上の表の変数を設定する
4. **Settings → Networking → Generate Domain** で公開URLを発行する
   - `APP_URL` の設定は不要です（`RAILWAY_PUBLIC_DOMAIN` から自動導出されます）
   - 発行されたドメインを使って、Google 側に
     `https://<発行されたドメイン>/api/auth/callback` を登録してください
5. 任意: **Settings → Deploy → Healthcheck Path** に `/api/health`

以降は `main` へ push するたびに自動で再デプロイされます。

> Railway の追跡ブランチは GitHub のデフォルトブランチとは別設定です。
> 旧ブランチで接続している場合は **Settings → Source → Branch** を `main` に変更してください。

**費用の目安**: 従量課金（RAM $10/GB/月、CPU $20/vCPU/月）。
Postgres が常時起動するため Free の $1/月クレジットでは足りず、
実質 **Hobby（$5/月）以上**が前提になります。

## スマホアプリとして使う

公開URLをスマホで開き、**ホーム画面に追加**するとスタンドアロンで起動します
（アドレスバーのないアプリ表示）。

- Android / Chrome: メニュー →「アプリをインストール」
- iOS / Safari: 共有 →「ホーム画面に追加」

iOS でホーム画面から起動した場合、iOS のバージョンによっては音声入力が使えない
ことがあります（後述のとおり、Apple が Safari.app 以外で Web Speech API を
有効にしていないため）。その場合は Safari で URL を直接開き直してください。
うまく動かないときはアプリ内で理由とテキスト入力を案内します。

ピンチズームは意図的に無効化していません。アプリらしく見せるために
`user-scalable=no` を入れると、文字を拡大したい人を締め出してしまうためです。

オフラインではアプリシェルだけが起動します。会話とレッスンは API が必要なので
動きませんが、学習記録は端末に残り、オンラインに戻ると自動で同期されます。

## ユニット冒頭の解説

各ユニットの先頭に解説パートがあります。**本体はアプリ内に書かれたスライド**（4枚・要点＋例文の読み上げ付き）で、
ネットワークやAPIの状態に関わらず必ず表示されます。

`YOUTUBE_API_KEY` を設定すると、これに**参考動画**が添えられます。

- **これは第三者が YouTube に上げた動画であり、AItalk が制作したものではありません。**
  UI 上も「参考動画」と明示し、講師による公式レッスンのようには見せていません。
  内容がユニットと完全に対応している保証はありません。
- **検索は1ユニットにつき1回だけ**で、結果はデータベース（`unit_videos`）にキャッシュされます。
  YouTube Data API の既定枠は **1日100検索**しかないため、閲覧のたびに検索する設計は成立しません。
  検索し直したい場合は該当行を削除してください（`delete from unit_videos where unit_id = '…'`）。
- 埋め込み不可・非公開・長すぎる（20分超）・短すぎる（1分未満）動画は自動で除外します。
- 再生はサムネイルをタップしてから始まります。**タップするまで YouTube には一切リクエストを送りません。**
  サムネイルすら読み込めない場合は、黒い枠ではなく説明文と外部リンクに切り替わります。

## 認識スコアについて（重要）

このアプリの「認識スコア」は、**ブラウザの音声認識がお手本の文をどれだけ
そのとおりに聞き取れたか**の一致度です。**発音の正確さを測るものではありません。**

Web Speech API が返すのはテキストだけで、音素単位のデータはなく、`confidence`
の値も実装依存で信頼できません。さらに音声認識側の言語モデルがもっともらしい英語へ
自動補正するため、発音を間違えても正しく転写されることがあり、逆に正しく発音しても
想定外の文では崩れることがあります。

そのため実装では次の方針を取っています。

- ラベルは一貫して「認識スコア」とし、「発音スコア」とは呼ばない
- スコアの横に必ず注意書きを表示する
- **レッスンの達成はスコアで判定しない**（試行したかどうかで判定する）。
  認識の一致度で達成を制限すると、訛りはあっても通じる発話を不当に低く扱うことになる

算出は `src/lib/scoring.ts` の `scoreUtterance(target, transcript)` に集約してあるので、
将来クラウドの発音評価へ差し替える場合もこの1関数の置き換えで済みます。
処理は 正規化 → 語単位の **Needleman-Wunsch** アライメント → 語ごとの判定 → スコア化。
語の類似判定には日本語話者に多い子音の置き換え（l↔r、th→s、v→b など）を畳み込むため、
`light`/`right`、`think`/`sink`、`very`/`berry` は「完全な誤り」ではなく「おしい」になります。

## 学習記録の同期

進捗はアカウントに紐づいて Postgres に保存され、ログインすればどの端末でも引き継がれます。

**保存は「置換」ではなく「マージ」です。** PC とスマホを同時に使うと、
ブロブ全体を後勝ちで書くと一方の学習が消えてしまいます。かといって競合エラーを返すと
学習中に「保存できません」を見せることになります。そこでサーバーは常に
保存済みと受信分をマージし、すべてのカウンタで**大きい方**を採ります。

この規則は**冪等かつ可換**（同じ保存を2回しても、順序が入れ替わっても結果が同じ）なので、
再送やリクエストの追い越しで壊れません。XP が二重加算されることもありません。
`src/lib/mergeProgress.test.ts` がこの性質を検証しています。

例外は「学習データを消去」と「JSONの読み込み」の2つだけで、
これらは値を下げる操作なのでマージでは表現できず、置換モードで保存します。

読み上げの声と速さは端末ごとの設定なので同期しません
（iPhone にある音声は Windows には無いため）。

## 対応ブラウザ

| ブラウザ | 音声認識 | 読み上げ | 備考 |
|---|---|---|---|
| Chrome / Edge（デスクトップ・Android） | ✅ | ✅ | 最も安定 |
| Safari（macOS） | ⚠️ | ✅ | 動くが不安定。読み上げ中は認識を開始できないため、実装側でTTSを停止してから開始している |
| **Safari（iOS 14.5+）** | ⚠️ | ✅ | **iOS で音声認識が使えるのはこれだけ**（下記） |
| **Chrome / Edge / Firefox（iOS）** | ❌ | ✅ | Apple の制限。マイクを出さず Safari を案内する |
| Firefox（デスクトップ・Android） | ❌ | ✅ | `SpeechRecognition` 未対応。自動でテキスト入力に切り替わる |

### iOS で音声認識が使えるのは Safari だけです

iOS はすべてのブラウザに WebKit を強制しますが、**Apple は WKWebView で
Web Speech API を有効にしていません**。有効なのは Safari.app 本体だけです。
そのため iOS 版の Chrome・Edge・Firefox、および LINE や Instagram などの
アプリ内ブラウザでは、音声認識は動きません。

やっかいなのは `webkitSpeechRecognition` コンストラクタ自体はこれらにも
存在し、`start()` も成功して `onstart` まで発火することです。機能検出だけでは
「対応している」と誤判定し、マイクは開いたように見えて音声が一切届きません。
そのため `src/lib/speech/support.ts` の `isIOSWebView()` で UA を見て、
iOS かつ Safari 本体でない場合はマイクを出さず、理由とテキスト入力を案内します。

マイクが使えない場合（未対応ブラウザ・iOS の非 Safari・権限拒否・非HTTPS）は、
必ずテキスト入力にフォールバックします。行き止まりにはなりません。

## プライバシー

- **Chrome の音声認識は音声を Google のサーバーへ送信します**（ブラウザの実装によるもので、
  このアプリが送っているわけではありません）。読み上げは端末内で行われます。
- AI講師に送られるのは会話のテキストのみです（音声は送信されません）。
- Google から取得するのは `openid email profile`（名前・メールアドレス・プロフィール画像）だけです。
- 学習記録はアカウントに紐づいてサーバーに保存されます。マイページから書き出し・消去ができます。

## セキュリティ

- `ANTHROPIC_API_KEY` はサーバー側でのみ読み込まれます。`VITE_` 接頭辞は付けないでください。
  クライアントは `/api/*` を叩くだけで、Anthropic SDK への依存を持ちません。
- **ログイン必須**。`/api/health` と認証ルート以外は、すべてセッションが必要です。
- セッションは **HttpOnly / Secure / SameSite=Lax** の署名付き Cookie。
- OAuth コールバックは `state` パラメータで検証します（認可コードの差し替え対策）。
- 他サイトからのフォーム送信を防ぐため `csrf()` を併用しています。
  なお `application/json` のクロスオリジン要求はブラウザのプリフライトが防ぎます
  （このアプリは CORS ヘッダーを返さないため）。
- AI ルートには IP 単位のレート制限（5分20回）とボディサイズ上限（32KB）があります。
  ログインを許可した利用者でも API 予算を使い切りうるためです。
- `.env` は `.gitignore` 済みです。コミット前に `git diff --staged` で確認してください。

## v1 の範囲外

課金・動画レッスン・リーグ（対人ランキング）・プッシュ通知は含まれていません。
