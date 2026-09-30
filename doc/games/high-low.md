# ハイロー（high-low）

## 概要

**一言ルール：次にめくられるカードを全員で予想する。当てた人から抜けていき、最後まで残った1人が負け。**

海外の定番飲みゲー「ライド・ザ・バス（Ride the Bus）」の4段階の質問を取り入れたハイロー。
手番を待たずに全員が同時に予想するので、待ち時間がない。

| 項目 | 内容 |
| --- | --- |
| 人数 | 2〜10人 |
| 時間 | 1分前後 |
| 進行 | 全員同時 |
| 共有端末 | ○（予想を真似されないようホットシートで順番に入力） |
| 各自スマホ | ◎ |
| 隠し情報 | 各自の予想（締め切りまで） |

## ルール

1. トランプ52枚（ジョーカーなし）をシャッフルし、場に1枚ずつめくっていく。
2. 毎ステージ、**まだ残っている人** が全員同時に次のカードを予想する。
3. カードをめくり、**当てた人は「降車」＝セーフで抜ける**。外した人は残る。
4. 残りが1人になったら、その人の負け。

### ステージ（ライド・ザ・バスの4段階）

| ステージ | 質問 | 選択肢 | 当たる確率（目安） |
| --- | --- | --- | --- |
| 1 | 赤か黒か？ | 赤 / 黒 | 1/2 |
| 2 | 1枚目より上か下か？ | 上 / 下 | 約1/2 |
| 3 | 1枚目と2枚目の間か外か？ | 間 / 外 | 状況による |
| 4 | マークは？ | ♠ / ♥ / ♦ / ♣ | 1/4 |
| 5〜 | 直前のカードより上か下か？ | 上 / 下 | 約1/2 |

- ステージ5以降は、残りが1人になるまで「上か下か」を繰り返す。
- 数字の強さは A=1、J=11、Q=12、K=13。
- **同じ数字**（ステージ2・5〜で直前と同じ、ステージ3で境界と同じ）が出た場合は全員不正解。
- ステージ3で1枚目と2枚目が同じ数字または隣り合う数字の場合、「間」は選べるが必ず外れる（UIで「間はありえない」と注記）。

### 全員が同じ結果だった場合

- **残っている全員が当てた**：誰も抜けずに次のステージへ（全員セーフにはしない）。
- **残っている全員が外した**：誰も抜けずに次のステージへ。
- つまり、1人以上当てて1人以上外したときだけ、当てた人が抜ける。

### 待ち時間とおまかせ

- 予想に制限時間はない。残っている全員が予想したらすぐにめくる。
- 待っている人は画面上部に「〇〇さん待ち」と表示する。
- 誰も操作しない状態が30秒続くと、全端末に「おまかせで進める」ボタンが出る（2回押しで実行。詳細は [common-design.md](./common-design.md#おまかせで進める)）。
- おまかせ：未予想の人の分を **ランダムに予想** してめくる（他人が押す操作なので、外れ扱いにはしない）。

### 設定

| 設定 | 選択肢 | デフォルト |
| --- | --- | --- |
| ステージ構成 | ライド・ザ・バス（4段階→上か下か）/ 上か下かのみ | ライド・ザ・バス |

## 画面設計

### 個人画面（スマホ）

```
┌──────────────────────────┐
│ STAGE 2   残り 4人 / 7人    │
│ 🚌 🐱A 🐶B 🐰C 🐻D          │  ← まだバスに乗っている人
│                          │
│  [ 8♥ ]  →  [ ? ]         │  ← 場のカード
│                          │
│   8♥ より上か下か？         │
│   [  上 ▲  ]  [  下 ▼  ]   │
│   予想済み 3/4              │
└──────────────────────────┘
```

- 降車した人の画面：「セーフ！降車しました」と、残りの人の予想状況を観戦表示。
- めくる演出：カードが裏返り、当たった人のアイコンがバスから降りるアニメーション。

### テーブル画面

- 場のカードを大きく表示、バスの中の残りメンバー。
- 配下プレイヤーのうち未予想の人をホットシートで順番に入力（`pendingPlayers` = 残っていて未予想の配下プレイヤー）。

## 設計

### Config

```ts
interface HighLowConfig {
  stages: 'rideTheBus' | 'highLowOnly';
}
```

### State

```ts
type Suit = 'S' | 'H' | 'D' | 'C';
interface PlayingCard { rank: number; suit: Suit }   // rank 1〜13

type Question =
  | { kind: 'color' }
  | { kind: 'highLow'; base: PlayingCard }
  | { kind: 'inOut'; low: number; high: number }
  | { kind: 'suit' };

type Guess = 'red' | 'black' | 'high' | 'low' | 'in' | 'out' | Suit;

interface HighLowState {
  phase: 'guessing' | 'revealing' | 'done';
  stage: number;                            // 1〜
  deck: PlayingCard[];
  table: PlayingCard[];                     // めくられたカード（順番）
  remaining: PlayerId[];                    // バスに残っている人
  exited: { playerId: PlayerId; stage: number }[];
  question: Question;
  guesses: Record<PlayerId, Guess>;
  lastReveal: { card: PlayingCard; correct: PlayerId[]; wrong: PlayerId[]; exited: PlayerId[] } | null;
}
```

### Action

```ts
type HighLowAction = { type: 'guess'; guess: Guess };
```

### 処理

- `setup`：52枚をシャッフル、`remaining` = 全員、ステージ1の質問。
- `applyAction(guess)`：検証（`phase==='guessing'`、`remaining` に含まれる、質問に合った選択肢）。全員が予想するまでは上書き可。`remaining` 全員が予想したら締め切り。
- `autoAct`：未予想の人にランダムな予想を割り当てて締め切り。
- 締め切り処理
  1. デッキから1枚めくり `table` に追加。正誤判定。
  2. `correct` と `wrong` の両方が1人以上なら `correct` を `remaining` から除き `exited` へ。
  3. `phase='revealing'`、イベント `highlow.reveal`、`reveal` タイマー（3.5秒、演出用。プレイヤーの選択ではないので自動で進める）。
- `onTimer(reveal)`
  - `remaining.length === 1` なら `phase='done'`、`result = { losers: remaining, reason: 'ステージ${stage}までバスを降りられなかった' }`。
  - そうでなければ次のステージの質問を作り `phase='guessing'`。
  - デッキが尽きたら捨て札（`table` の古いもの）をシャッフルして補充（通常は起こらない）。
- 質問の生成
  - `rideTheBus`：ステージ1 `color`、2 `highLow(base=table[0])`、3 `inOut(table[0], table[1])`、4 `suit`、5以降 `highLow(base=直前のカード)`。
  - `highLowOnly`：ステージ1は最初に1枚めくって基準とし、以降すべて `highLow`。
- `pendingPlayers`：`remaining` のうち未予想の人。

### View

```ts
interface HighLowTableView {
  phase: HighLowState['phase'];
  stage: number;
  table: PlayingCard[];
  question: Question;
  remaining: PlayerId[];
  exited: HighLowState['exited'];
  guessedPlayerIds: PlayerId[];
  lastReveal: HighLowState['lastReveal'] & { guesses: Record<PlayerId, Guess> } | null;  // 締め切り後に予想を公開
}

interface HighLowPlayerView {
  inBus: boolean;
  myGuess: Guess | null;
  options: Guess[];
}
```

### バランス

- 10人の場合、ステージ1で約半数、ステージ2でさらに半数…と減り、平均 5〜7 ステージ（1分前後）で終わる見込み。
- 最後の2人が同じ予想を繰り返すと長引くため、ステージ15以降は質問を `suit`（4択）に固定して決着を早める。
