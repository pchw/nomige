# プロモーション動画（video/）

NOMIGE の 15 秒プロモーション動画を [Remotion](https://www.remotion.dev/) で作る。
アプリ本体（`../app`）のコンポーネント・ゲーム情報・`app.css` をそのまま読み込んで使うので、アプリの見た目が変わると動画も追従する。

## 出力

| ファイル | サイズ | 用途 |
| --- | --- | --- |
| `out/promo-9x16.final.mp4` | 1080×1920 | TikTok / Reels / Shorts（本編） |
| `out/promo-1x1.final.mp4` | 1080×1080 | X / Instagram フィード |
| `out/promo-16x9.final.mp4` | 1920×1080 | YouTube / LP 埋め込み |
| `out/promo-preview.gif` | 縦 480px | README・PR 用のプレビュー |
| `out/contact-sheet.png` | — | 5 フレームごとのコマを並べたテンポ確認用 |

`*.final.mp4` は音量を -14 LUFS に揃えたもの。`out/` は git 管理外。

## 使い方（コンテナ内）

開発用の `app` サービスとは別に、`video` サービス（profile: `video`）を使う。
Chrome Headless Shell の依存ライブラリ・絵文字/日本語フォント・ffmpeg・Python が入っている。

```sh
# プレビュー（Remotion Studio）: http://localhost:3000
docker compose --profile video up -d video

# 音源生成 → 3サイズ書き出し → 音量正規化・GIF → コンタクトシート
docker compose --profile video run --rm video npm run build

# 個別に
docker compose --profile video run --rm video npm run audio   # BGM / 効果音を作り直す
docker compose --profile video run --rm video npx remotion still Promo out/frame.png --frame=200
docker compose --profile video run --rm video npm run typecheck
```

初回は `npm install` と Chrome Headless Shell のダウンロードが走る。

## 構成

```
src/
  timeline.ts     カット表と効果音の配置（唯一の正。120BPM / 30fps で 1拍 = 15f）
  Promo.tsx       9:16 の本編。カットを Sequence に並べ、BGM / 効果音を鳴らす
  Framed.tsx      1:1 / 16:9 用。本編を中央に置き、左右を今のカットの色で埋める
  theme.ts        フォント読み込みと app.css の色
  fx/             演出部品（叩きつけ・揺れ・フラッシュ・集中線・スタンプ・紙吹雪・カットの入り方）
  scenes/         Intro（掴み）/ GameCut + games/（13ゲーム）/ Outro（負け・盛り上がり・CTA）
scripts/
  make_audio.py   BGM と効果音を numpy で合成（外部音源なし）
  contact_sheet.py  ffmpeg + Pillow でコンタクトシートを作る
  post.sh         loudnorm・GIF 化
```

## カット割り（15 秒 / 450f）

| 秒 | 内容 |
| --- | --- |
| 0.0–2.0 | 掴み：「飲み会で、」→ スマホ → カンパーイ → ロゴ |
| 2.0–9.0 | 全13ゲームを 0.5 秒ずつ（狼と子豚だけ 1 秒）。背景はアプリのゲーム色 |
| 9.0–9.5 | 全13種が一斉に並ぶ |
| 9.5–12.5 | スロットで負けが決まる →「負け！ 🍺+1杯」→ みんなで盛り上がる |
| 12.5–15.0 | 特長（登録不要 / アプリ不要 / 2〜10人）→ ロゴ・QR・URL |

## 表現のルール

- 飲酒の強要・一気飲みを煽る表現はしない。負けは「+1杯」の表示にとどめ、「ソフドリ・ノンアルでもOK」を添える。
- 「お酒は20歳になってから」の注意書きを常に表示し、エンドカードではより詳しく出す。
- 光過敏に配慮し、白フラッシュは 2 フレーム・1 秒に 3 回までにする。
- ゲームの描写は実際のルール（`doc/games/`）とずれないようにする。

## 音源

BGM・効果音は `scripts/make_audio.py` で合成したオリジナルで、ライセンス上の制約はない。
フリー素材の BGM に差し替える場合は、120BPM・15 秒以上の曲を `public/bgm/bgm.wav` に置く（拍がずれる場合は `src/timeline.ts` のカット位置を合わせる）。
その場合は、曲名・作者・配布元とライセンス表記をこの README に追記する。

## 変更するとき

- アプリのコンポーネントは CSS の keyframes アニメーションがフレームと同期しないため、見た目の部品（`Die` / `Trump` / `PlayingCardView` / `Mark` / `Pegs` / `Avatar`）だけを使い、動きは `useCurrentFrame()` で付ける。
- カットの長さを変えたら `timeline.ts` の合計が 450f になるようにする（ずれると起動時にエラーになる）。
- ゲームを追加したら `timeline.ts` の `GAME_CUTS` と `scenes/games/` に見せ場を足す。
