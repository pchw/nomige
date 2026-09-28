# 被ったらアウト（kabuttara-out）

## 概要

**一言ルール：動物を1匹選ぶ。誰とも被らなかった人から抜けていき、最後まで残った1人が負け。**

全員が同時に秘密で動物を選び、一斉に公開する。「あいつはいつもネコを選ぶ」「今回は逆張りでパンダ」という読み合いのゲーム。
抜けた人も「おじゃま役」として選び続けるので、全員が最後まで参加できる。

| 項目 | 内容 |
| --- | --- |
| 人数 | 3〜10人 |
| 時間 | 1分前後（1回 10 秒程度 × 数回） |
| 進行 | 全員同時 |
| 共有端末 | ○（ホットシートで順番に選ぶ） |
| 各自スマホ | ◎ |
| 隠し情報 | 各自の選択（公開まで） |

## ルール

1. 動物の選択肢は **人数+1 匹**（最低4匹、最大10匹）。ゲーム開始時に決まり、そのゲーム中は変わらない。
2. 毎回、全員が同時に動物を1匹選ぶ（制限時間 10 秒）。選んでいる間、口頭で「ネコにする」などと言うのは自由（嘘でもよい）。
3. 一斉に公開する。
   - **まだ残っている人** のうち、他の誰とも被らなかった人は **セーフで抜ける**。
   - 被った人は残る。
4. 残りが1人になったら、その人の負け。

### 抜けた人（おじゃま役）

- 抜けた人も毎回動物を選ぶ。**おじゃま役の選択も「被り」の判定に含まれる**（おじゃま役同士・おじゃま役自身は被っても何も起きない）。
- 残っている人を狙い撃ちして被せにいける。「最後に〇〇を負けさせたい」という駆け引きが生まれ、抜けた後も退屈しない。
- おじゃま役は選ばなくてもよい（時間切れは「選ばない」扱い）。

### のら動物

- 毎回、アプリも1匹を秘密でランダムに選ぶ（「のら動物」）。のら動物と被った場合も「被り」になる。
- 残りが2人のとき、2人だけで選ぶと「被る＝2人とも残る」「被らない＝2人とも抜ける」で決着がつかない。のら動物とおじゃま役によって、片方だけが被る状況が生まれ決着する。

### 決着がつかない場合

- 残っている全員が抜けられる状況（全員が被らなかった）では、**誰も抜けずにやり直し**（全員が抜けると負けがいなくなるため）。
- 残っている全員が被った場合もそのまま次の回へ。
- 10回で決着しない場合は、残っている人からルーレットで1人。

### 時間切れ

- 残っている人が時間内に選ばなかった場合は「被った」扱い（残る）。

### 設定

| 設定 | 選択肢 | デフォルト |
| --- | --- | --- |
| 選択時間 | 5 / 10 / 15 秒 | 10秒 |
| 動物の数 | 自動（人数+1）/ 4〜10 | 自動 |
| おじゃま役 | ON / OFF | ON |
| のら動物 | ON / OFF | ON |

おじゃま役・のら動物を両方 OFF にした場合、残り2人の決着がつかないため、残り2人になった時点でルーレットで決める。

## 画面設計

### 個人画面（スマホ）

```
┌──────────────────────────┐
│ 3回目   残り 3人             │
│ 🚩 A   B   C   （あなた）     │
│                ⏱ 7        │
│  🐱  🐶  🐰  🐻             │
│  🦊  🐼  🐧  🐸             │  ← タップで選択。締め切りまで変更可
│                          │
│  選択済み 6/8               │
└──────────────────────────┘
```

- 抜けた人の画面には「おじゃま役」と表示し、残っている人を強調する。
- 公開演出：各動物の下に選んだ人の名前が一斉に並び、被った動物は「ドン！」と揺れる。残っている人で被らなかった人は「セーフ！」で抜ける。
- この画面ではプレイヤーのアイコン（動物）と選択肢が混同しやすいため、プレイヤーは名前と色で表示し、動物アイコンは使わない。

### テーブル画面

- 選択肢の動物を大きく並べ、公開演出をメインに見せる。
- 配下プレイヤーをホットシートで順番に選択させる（`pendingPlayers` = 未選択の配下プレイヤー。おじゃま役を含む）。

## 設計

### Config

```ts
interface KabuttaraOutConfig {
  pickSeconds: 5 | 10 | 15;
  animalCount: 'auto' | number;   // 4〜10
  spoilers: boolean;              // おじゃま役
  strayAnimal: boolean;           // のら動物
}
```

### State

```ts
interface KabuttaraOutState {
  phase: 'picking' | 'revealing' | 'done';
  round: number;
  animals: CharacterId[];                 // 選択肢
  players: PlayerId[];
  remaining: PlayerId[];
  exited: { playerId: PlayerId; round: number }[];
  picks: Record<PlayerId, CharacterId>;
  deadline: number | null;
  lastReveal: {
    picks: Record<PlayerId, CharacterId>;
    stray: CharacterId | null;
    collided: PlayerId[];                 // 残っている人のうち被った人
    exited: PlayerId[];                   // 今回抜けた人
    retry: boolean;                       // 全員被らなかったためやり直し
  } | null;
}
```

### Action

```ts
type KabuttaraOutAction = { type: 'pick'; animal: CharacterId };
```

### 処理

- `setup`：動物を `animalCount` 匹ランダムに選ぶ。`remaining` = 全員、`pick` タイマー。
- `applyAction(pick)`：検証（`phase==='picking'`、`animals` に含まれる、おじゃま役 OFF なら `remaining` のみ）。上書き可。全員（おじゃま役が ON なら抜けた人も含む）が選んだら締め切り。
- `onTimer(pick)`：締め切り。
- 締め切り処理
  1. `strayAnimal` なら `ctx.random` でのら動物を選ぶ。
  2. 各動物の選択数を数える（全員の選択＋のら動物）。
  3. `remaining` の各人について、選んだ動物の選択数が1なら「被らなかった」。未選択は「被った」扱い。
  4. 被らなかった人が `remaining` 全員なら `retry`、そうでなければ被らなかった人を `exited` へ。
  5. イベント `kabuttara.reveal`、`reveal` タイマー（2.5秒）。
- `onTimer(reveal)`
  - `remaining.length === 1` なら `done`、`result = { losers: remaining, reason: '${round}回目まで被り続けた' }`。
  - `round >= 10` ならルーレット。
  - 両方 OFF かつ `remaining.length === 2` ならルーレット。
  - それ以外は `round++`、`picks` をクリアして次の回へ。
- `pendingPlayers`：選択が必要な人のうち未選択の人。

### View

```ts
interface KabuttaraOutTableView {
  phase: KabuttaraOutState['phase'];
  round: number;
  animals: CharacterId[];
  remaining: PlayerId[];
  exited: KabuttaraOutState['exited'];
  pickedPlayerIds: PlayerId[];
  deadline: number | null;
  lastReveal: KabuttaraOutState['lastReveal'];
}

interface KabuttaraOutPlayerView {
  role: 'remaining' | 'spoiler';
  myPick: CharacterId | null;
}
```

### バランス

- 全員がランダムに選んだ場合、10人・10匹で1人が被らない確率は約 39%、3人・4匹で約 56%。1回ごとに残りの 4〜6 割が抜けていき、平均 3〜5 回で決着する見込み。
- 実際は人が選ぶため偏りが出るが、それが読み合いの面白さになる。
