# Cloudflare Workers へのデプロイ

本番環境は Cloudflare Workers 1つ（`nomige`）で、ルームの状態は Durable Object（`Room`）に置いている。
開発環境と同じく、コマンドはすべてコンテナ内で実行する。

## 事前に用意するもの

| リソース | 必要か | 備考 |
| --- | --- | --- |
| Cloudflare アカウント | 必要 | Free プランで動く |
| workers.dev サブドメイン | 必要（初回のみ） | ダッシュボードの Workers & Pages を一度開くと登録を求められる |
| 認証 | 必要 | `wrangler login` または API トークン。下の「1. 認証」を参照 |
| Durable Objects | **事前作成は不要** | `wrangler deploy` 時にマイグレーション `v1` が適用され、自動で作られる |
| D1 / KV / R2 | **不要** | 使っていない。ルームの状態は Durable Object 自身のストレージに保存している |
| シークレット・環境変数 | **不要** | `wrangler secret put` するものはない |

Durable Object は SQLite ストレージ版（`wrangler.jsonc` の `migrations` に `new_sqlite_classes`）で宣言しているので、Free プランでも使える。
WebSocket は Hibernation API（`ctx.acceptWebSocket`）で受けているため、接続が開いているだけの時間は課金対象になりにくい。
使われなくなったルームは最後の操作から 24 時間後に alarm でストレージごと削除される（`app/server/room.ts` の `IDLE_TTL_MS`）。

料金・上限の最新値は公式ドキュメントを確認すること:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/

## 1. 認証（wrangler login）

`wrangler login` は OAuth のコールバックをコンテナ内の `localhost:8976` で待ち受けるので、ホストのブラウザからは直接届かない。
ブラウザが最後に開こうとした URL をコピーし、コンテナ内から curl で叩いてログインを完了させる（curl は `Dockerfile` でコンテナに入れている）。

1. コンテナを起動し、ログインを始める。

   ```sh
   docker compose up -d
   docker compose exec app npx wrangler login --browser=false
   ```

   表示された `https://dash.cloudflare.com/oauth2/auth?...` の URL をホストのブラウザで開く。
   このコマンドはコールバックを待ったまま止まるので、終了させずにおく。

2. ブラウザで Cloudflare にログインし、「Allow」を押す。
   `http://localhost:8976/oauth/callback?code=...&state=...` にリダイレクトされて「接続できません」と表示される。これで正常。

3. アドレスバーの URL をまるごとコピーし、**別のターミナル**でコンテナ内から叩く。

   ```sh
   docker compose exec app curl 'http://localhost:8976/oauth/callback?code=...&state=...'
   ```

   URL には `&` が入っているので、必ずシングルクォートで囲む。
   1 のターミナルに `Successfully logged in.` と出れば完了。

4. ログインできたか確認する。

   ```sh
   docker compose exec app npx wrangler whoami
   ```

   アカウント名とアカウント ID が表示されれば OK。

認証情報はコンテナの `/root/.config/.wrangler` に保存される。ここは名前付きボリューム `wrangler_config` にしてあるので、コンテナを作り直してもログインしたままになる。
ログアウトするには `docker compose exec app npx wrangler logout` を実行する。

### 別の方法: API トークン

CI から実行する場合などは、`wrangler login` の代わりに API トークンを使う。

1. https://dash.cloudflare.com/profile/api-tokens で「Create Token」を押し、テンプレート **「Edit Cloudflare Workers」** からトークンを作る
2. ホストのシェルで `CLOUDFLARE_API_TOKEN`（と、アカウントが複数ある場合は `CLOUDFLARE_ACCOUNT_ID`）を設定する
3. 以降のコマンドは `docker compose exec -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app ...` のように、変数名だけを指定してホストの値を渡しながら実行する

## 2. デプロイ前のチェック

```sh
docker compose exec app npm test
docker compose exec app npm run lint
docker compose exec app npm run typecheck
```

## 3. デプロイ

```sh
docker compose exec app npm run deploy
```

`npm run deploy` は次の 2 つを順に実行する。

1. `react-router build` — `build/client`（静的アセット）と `build/server`（Worker 本体）を生成する。
   このとき Cloudflare の Vite プラグインが `build/server/wrangler.json` と、それを指す `.wrangler/deploy/config.json` を書き出す。
2. `wrangler deploy` — 上の生成済み設定を使って Worker・静的アセット・Durable Object のマイグレーションをアップロードする。

成功すると最後に URL が表示される。

```
Deployed nomige triggers
  https://nomige.<your-subdomain>.workers.dev
```

初回は Durable Object のマイグレーション `v1`（`Room` クラスの作成）がここで適用される。2 回目以降は適用済みなのでスキップされる。

## 4. 動作確認

ブラウザで表示された URL を開き、ルームを作ってスマホなど別端末から参加できるか確認する。

スモークテストを本番に向けて流すこともできる（ルームが 1 つ作られるが 24 時間後に自動削除される）。

```sh
docker compose exec -e BASE_URL=https://nomige.<your-subdomain>.workers.dev app node scripts/smoke.mjs wolf-and-pigs
```

## 運用コマンド

いずれも `docker compose exec app` を前に付けて実行する。

| やりたいこと | コマンド |
| --- | --- |
| リアルタイムでログを見る | `npx wrangler tail` |
| デプロイ履歴を見る | `npx wrangler deployments list` |
| 1 つ前のバージョンに戻す | `npx wrangler rollback` |
| Worker を削除する | `npx wrangler delete` |

`wrangler.jsonc` で `observability` を有効にしているので、過去のログはダッシュボードの Workers & Pages → nomige → Logs からも見られる。

## 独自ドメインを使う場合（任意）

Cloudflare で管理しているドメインがあれば、`wrangler.jsonc` に `routes` を追加して再デプロイする。

```jsonc
"routes": [{ "pattern": "nomige.example.com", "custom_domain": true }],
```

DNS レコードと証明書は Cloudflare 側で自動で作られる。

## Durable Object を変更するときの注意

`wrangler.jsonc` の `migrations` は本番に適用済みの履歴なので、**既存の `v1` は書き換えない**。
`Room` クラスのリネーム・削除や、新しい Durable Object クラスの追加をするときは、新しいタグを末尾に追加する。

```jsonc
"migrations": [
  { "tag": "v1", "new_sqlite_classes": ["Room"] },
  // 例: 新しいクラスを追加する場合
  { "tag": "v2", "new_sqlite_classes": ["Lobby"] },
],
```

クラスを削除する（`deleted_classes`）と、そのクラスの全インスタンスのデータが消える。
保存するデータの形（`RoomData`）を変える場合、マイグレーションは不要だが、デプロイ時点で進行中のルームは古い形のデータを読み込むことになる点に注意。

## トラブルシューティング

- **`Authentication error [code: 10000]`** — ログインしていないか、権限が足りない。`wrangler whoami` で確認する。API トークンを使っている場合は `-e CLOUDFLARE_API_TOKEN` の付け忘れも疑う。
- **curl を叩いても `Successfully logged in.` と出ない** — `wrangler login` が起動したままになっているか、URL を途中で切らずにシングルクォートで囲んだかを確認する。やり直すときは `wrangler login` から始め直す（`state` が変わるため）。
- **`curl: command not found`** — イメージが古い。`docker compose up -d --build` で作り直す。
- **`You need to register a workers.dev subdomain`** — ダッシュボードの Workers & Pages を開いてサブドメインを登録してから再実行する。
- **複数アカウントがあってどれにデプロイするか聞かれる／失敗する** — `CLOUDFLARE_ACCOUNT_ID` を渡す。
- **WebSocket がつながらない** — `wrangler tail` を開いた状態でルームに入り、`/api/rooms/:code/ws` のリクエストでエラーが出ていないか見る。
