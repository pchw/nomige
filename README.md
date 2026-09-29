# NOMIGE（飲みゲー）

3〜10人で遊べる飲みゲーのウェブアプリ。テーブルに置いたタブレット1台でも、各自のスマホでも遊べる。

- ゲームのルールと設計: [doc/games/](doc/games/README.md)
- 本番デプロイ手順: [doc/deploy.md](doc/deploy.md)
- 技術: React Router v8（フレームワークモード / flat routes）+ Cloudflare Workers + Durable Objects（WebSocket でリアルタイム同期）

## 開発環境

開発はすべてコンテナ内で行う（ホストに Node.js は不要）。

```sh
docker compose up -d
```

起動したらホストのブラウザで http://localhost:8787 を開く。
同じ LAN のスマホからは `http://<ホストPCのIP>:8787` で参加できる。

- `node_modules` はコンテナ専用の名前付きボリュームに置かれ、ホスト側には作られない。
- 初回起動時と `docker compose up` のたびに `npm install` が走ってから開発サーバーが起動する。
- ログ: `docker compose logs -f app`

### コマンド（コンテナ内で実行）

```sh
docker compose exec app npm test            # テスト（vitest）
docker compose exec app npm run lint        # lint（oxlint）
docker compose exec app npm run format      # フォーマット（oxfmt）
docker compose exec app npm run typecheck   # 型チェック
docker compose exec app node scripts/smoke.mjs wolf-and-pigs  # 開発サーバーに対して1ラウンド通しで動作確認
```

パッケージの追加も `docker compose exec app npm install <pkg>` で行う。

## ディレクトリ構成

```
app/
  routes/              # flat routes。ファイル名がそのまま URL になる
    _index.tsx         #   /            トップ（ゲーム選択・ルーム作成）
    r.$code.tsx        #   /r/:code     ルーム画面
    api.rooms.$code.ws.ts  # /api/rooms/:code/ws  WebSocket を Durable Object へ中継
  games/               # ゲームロジック（純粋関数・サーバーとクライアントで共有）
  server/              # Room Durable Object とルーム処理
  components/          # UI（games/ 以下が各ゲームの画面）
  client/useRoom.ts    # WebSocket 接続フック
  protocol.ts          # クライアント・サーバー間のメッセージ型
workers/app.ts         # Worker エントリ（React Router + Durable Object の export）
```
