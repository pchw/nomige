# ライアーダイス（liars-dice）

## 概要

**一言ルール：全員のサイコロの中に「〇の目が△個以上ある」と宣言を吊り上げていき、嘘だと思ったらダウト。外した方が負け。**

各自が自分のサイコロだけを見て、全員分のサイコロの出目を予想する。ブラフ（はったり）と読み合いのゲーム。
南米の Perudo（ペルード）などで知られる定番の飲みゲー。スマホがサイコロとカップの代わりになる。

| 項目 | 内容 |
| --- | --- |
| 人数 | 3〜8人 |
| 時間 | 1〜2分 |
| 進行 | 手番制（席順） |
| 共有端末 | △（自分のサイコロをホットシートで確認する。宣言のたびに確認し直したくなるためテンポが落ちる） |
| 各自スマホ | ◎ |
| 隠し情報 | 自分のサイコロ |

## ルール

1. 全員がサイコロを振る（アプリが振る）。自分の出目だけが自分の画面に見える。

   | 人数 | 1人あたりのサイコロ |
   | --- | --- |
   | 3〜5人 | 5個 |
   | 6〜8人 | 3個 |

2. 開始プレイヤーをランダムに決め、席順（時計回り）で進める。
3. 手番のプレイヤーは次のどちらかを行う。
   - **宣言**：「全員のサイコロの中に、〇の目が △個以上ある」と宣言する。前の宣言より強くなければならない。
     - 個数を増やす（目は何でもよい）、または
     - 個数は同じで、より大きい目にする
     - 例：「4の目が3個」→「5の目が3個」「2の目が4個」はOK、「3の目が3個」はNG
   - **ダウト**：直前の宣言を嘘だと指摘する（最初の手番ではできない）。
4. ダウトされたら全員のサイコロを公開して数える。
   - 実際の個数が宣言以上 → 宣言は正しかった。**ダウトした人の負け**。
   - 実際の個数が宣言未満 → 宣言は嘘だった。**宣言した人の負け**。
5. 1回のダウトで1ラウンド終了。

### 1の目はワイルド（デフォルト ON）

- 1の目はどの目としても数える（「4の目が5個」なら、4 と 1 の合計で数える）。
- 1の目そのものは宣言できない（ルールを単純にするため）。
- 設定で OFF にすると、1〜6すべての目を宣言でき、1は1としてだけ数える。

### 制限時間

- 手番ごとに 20 秒。時間切れの場合は **最小の吊り上げ** を自動で宣言する（同じ個数で次に大きい目、目が6なら個数+1で最小の目）。最初の手番なら「2の目が1個」。

### 設定

| 設定 | 選択肢 | デフォルト |
| --- | --- | --- |
| 1をワイルドにする | ON / OFF | ON |
| サイコロの個数 | 自動 / 3 / 4 / 5 | 自動 |
| 手番時間 | 15 / 20 / 30 秒 | 20秒 |
| 期待値のヒント | ON（宣言UIに「平均的にはこのくらい」を表示）/ OFF | OFF |

期待値のヒントは初心者向け。自分の出目＋他人のサイコロ数×(1/3 または 1/6) を表示する。

## 画面設計

### 個人画面（スマホ）

```
┌──────────────────────────┐
│ 全サイコロ 20個             │
│ 直前：🐶B「5の目が 6個以上」 │  ← 宣言履歴（直近数件）
│                          │
│ あなたのサイコロ            │
│ ⚃ ⚄ ⚀ ⚄ ⚁                 │  ← 長押しで表示（周りから覗かれにくく）
│                          │
│ あなたの番 ⏱ 14            │
│ 個数 [－] 6 [＋]           │
│ 目   ⚁ ⚂ ⚃ [⚄] ⚅          │  ← 前の宣言より弱い組み合わせは選べない
│ [ 宣言する ]  [ ダウト！ ]  │
└──────────────────────────┘
```

- 個数・目の初期値は「最小の吊り上げ」にしておき、そのまま宣言すれば1タップで済む。
- ダウト時は全員の画面で公開演出：全員のサイコロを並べ、該当する目（とワイルドの1）を1つずつ光らせてカウントアップ →「6個！宣言は正しかった！」。

### テーブル画面

- 直前の宣言を巨大表示（「🐶B：5の目が6個以上」）、宣言履歴、全サイコロ数、手番。
- 配下プレイヤーの手番ではホットシートで自分のサイコロと宣言UIを表示（`pendingPlayers = [手番プレイヤー]`）。
- 手番以外でもホットシートの「自分のサイコロを見る」ボタンで確認できる。

## 設計

### Config

```ts
interface LiarsDiceConfig {
  onesWild: boolean;
  dicePerPlayer: 'auto' | 3 | 4 | 5;
  turnSeconds: 15 | 20 | 30;
  showHint: boolean;
}
```

### State

```ts
type Face = 1 | 2 | 3 | 4 | 5 | 6;
interface Bid { playerId: PlayerId; count: number; face: Face }

interface LiarsDiceState {
  phase: 'bidding' | 'revealed';
  dice: Record<PlayerId, Face[]>;
  totalDice: number;
  order: PlayerId[];
  turnIndex: number;
  bids: Bid[];                   // 宣言履歴
  deadline: number | null;
  challenge: {
    challenger: PlayerId;
    bid: Bid;
    actual: number;
    loser: PlayerId;
  } | null;
}
```

### Action

```ts
type LiarsDiceAction =
  | { type: 'bid'; count: number; face: Face }
  | { type: 'doubt' };
```

### 処理

- `setup`：各プレイヤーのサイコロを `ctx.random` で振る。開始プレイヤーを決め `turn` タイマー。
- `applyAction(bid)`
  - 検証：手番本人、`1 <= count <= totalDice`、`onesWild` なら `face !== 1`、直前の宣言より強い（`count > prev.count || (count === prev.count && face > prev.face)`）。
  - `bids` に追加、手番を進め、`turn` タイマー更新。イベント `dice.bid`。
- `applyAction(doubt)`
  - 検証：手番本人、`bids.length > 0`。
  - `actual` = 全員の `face` の個数（`onesWild` なら 1 も加算）。
  - `loser` = `actual >= bid.count` ? challenger : bid.playerId。
  - `phase='revealed'`、イベント `dice.reveal`、`result = { losers:[loser], reason: '「${face}の目が${count}個」に対して実際は${actual}個', detail: { dice, bid, actual } }`。
- 最大宣言（`count === totalDice && face === 6`）の後は宣言できないので、UI はダウトのみ有効にする。
- `onTimer(turn)`：最小の吊り上げを自動宣言。吊り上げ不可能（最大宣言の後）なら自動ダウト。
- `pendingPlayers`：`[手番プレイヤー]`。

### View

```ts
interface LiarsDiceTableView {
  phase: 'bidding' | 'revealed';
  order: PlayerId[];
  currentPlayerId: PlayerId;
  totalDice: number;
  diceCounts: Record<PlayerId, number>;
  bids: Bid[];
  deadline: number | null;
  onesWild: boolean;
  reveal?: { dice: Record<PlayerId, Face[]>; bid: Bid; actual: number; challenger: PlayerId; loser: PlayerId };
}

interface LiarsDicePlayerView {
  myDice: Face[];
  isMyTurn: boolean;
  minBid: { count: number; face: Face } | null;   // 吊り上げ可能な最小の宣言
  hint?: Record<Face, number>;                     // showHint のとき、各目の期待個数
}
```

### エッジケース

- 切断中のプレイヤーは時間切れで最小の吊り上げが入るため、進行は止まらない。
- 本家 Perudo はダウトで負けた人のサイコロが減り、最後の1人まで続けるが、1ラウンドで敗者1人を決める方針に合わせ、1回のダウトでラウンドを終える。
