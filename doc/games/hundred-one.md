# 101（hundred-one）

## 概要

**一言ルール：手札を1枚ずつ出して場の合計を増やしていき、101を超えさせた人が負け。**

手番制のカードゲーム。「+10 か −10 か選べる」「一気に 101 にする」などの特殊カードで押し付け合いになる。
手番制で間延びしやすいため、以下の方針でテンポを重視して調整している。

- 1手の制限時間を短く（10秒）、終盤はさらに短く（5秒）。
- 数字カードを大きめにして、1ラウンドを 15〜20 手程度に収める。
- 操作はタップ1回で完了（±10 のみ2択）。
- 自分の番が近づいたら通知（「次はあなた」表示＋バイブ）し、待ち時間でも場の合計に注目させる演出を行う。

| 項目 | 内容 |
| --- | --- |
| 人数 | 3〜10人（おすすめ 3〜7人） |
| 時間 | 1〜2分 |
| 進行 | 手番制（席順） |
| 共有端末 | △（手札をホットシートで確認するためテンポが落ちる） |
| 各自スマホ | ◎ |
| 隠し情報 | 手札 |

## ルール

### デッキ（56枚）

| カード | 枚数 | 効果 |
| --- | --- | --- |
| 数字 1〜10 | 各4枚（40枚） | 合計に数字を加算 |
| +20 | 4枚 | 合計に 20 を加算 |
| ±10 | 4枚 | 出すときに +10 か −10 を選ぶ |
| リターン | 3枚 | 合計は変化しない。手番の順番が逆回りになる |
| パス | 3枚 | 合計は変化しない |
| 101 | 2枚 | 合計を **ちょうど 101** にする |

1枚あたりの平均増加量は約 5.5 のため、1ラウンドはおよそ 15〜20 手で終わる。

### 進行

1. デッキをシャッフルし、各プレイヤーに手札を3枚配る。場の合計は 0。
2. 開始プレイヤーをランダムに決め、席順（時計回り）で進める。
3. 手番のプレイヤーは手札から1枚出し、合計を更新する。
   - **合計が 101 を超えたら（102以上）その人の負け**。ちょうど 101 はセーフ。
   - −10 で合計が 0 未満になる場合は 0 とする。
4. 出した後、山札から1枚引いて手札を補充する。山札が尽きたら捨て札をシャッフルして山札にする。
5. 次の人の手番（リターンが出ていれば逆回り）。

- どのカードを出しても 101 を超える場合、UI で「どれを出してもアウト…」と表示し、好きなカードを出して散る（自動敗北にはせず、出す瞬間を演出にする）。

### 制限時間

| 状況 | 制限時間 |
| --- | --- |
| 通常 | 10秒 |
| 合計が 81 以上（終盤） | 5秒 |

時間切れの場合は手札から **ランダムに1枚** 自動で出す（±10 は −10 を選ぶ）。

### 設定

| 設定 | 選択肢 | デフォルト |
| --- | --- | --- |
| 上限値 | 101 / 51（ショート） | 101 |
| 手番時間 | 5 / 10 / 20 秒 | 10秒 |
| 終盤の時間短縮 | ON / OFF | ON |

上限値 51 の場合、「101」カードは「51」カードとして扱い、+20 カードは抜く。終盤は 41 以上。

## 画面設計

### 個人画面（スマホ）

```
┌──────────────────────────┐
│        87 / 101          │  ← 合計を大きく。81以上で赤く脈打つ
│   ↻ 時計回り              │
│  🐱A  🐶B  [🐰C]  🐻D     │  ← 席順。手番をハイライト、次の人に「NEXT」
│   直前：B が +20          │
│                          │
│  あなたの番 ⏱ 4           │
│  ┌──┐┌──┐┌──┐           │
│  │ 7 ││±10││パス│           │  ← タップで即出す（±10 のみ +/− の2択が出る）
│  └──┘└──┘└──┘           │
└──────────────────────────┘
```

- 出すと超えるカードは赤枠で警告するが、出すこと自体は可能。
- 自分の番の1つ前になったら「次はあなた」表示とバイブ（`navigator.vibrate`）。

### テーブル画面（タブレット）

- 合計値を中央に巨大表示、直前に出たカードと出した人、手番と回転方向。
- 配下プレイヤーの手番では、ホットシートで手札を表示する（`pendingPlayers = [手番プレイヤー]`）。

## 設計

### Config

```ts
interface HundredOneConfig {
  limit: 101 | 51;
  turnSeconds: 5 | 10 | 20;
  endgameSpeedUp: boolean;
}
```

### State

```ts
type Card =
  | { id: string; kind: 'num'; value: number }   // 1〜10, 20
  | { id: string; kind: 'pm10' }
  | { id: string; kind: 'pass' }
  | { id: string; kind: 'return' }
  | { id: string; kind: 'max' };                 // 101（または 51）

interface HundredOneState {
  phase: 'turn' | 'busted';
  total: number;
  limit: number;
  deck: Card[];
  discard: Card[];
  hands: Record<PlayerId, Card[]>;
  order: PlayerId[];             // 席順
  turnIndex: number;
  direction: 1 | -1;
  deadline: number | null;
  lastPlay: Play | null;
  log: Play[];                   // 直近10手
}

interface Play { playerId: PlayerId; card: Card; delta: number; totalAfter: number; auto: boolean }
```

### Action

```ts
type HundredOneAction = { type: 'play'; cardId: string; sign?: 1 | -1 };  // sign は pm10 のみ必須
```

### 処理

- `setup`：デッキ生成・シャッフル（`ctx.random` による Fisher–Yates）、配札、開始プレイヤー決定、`turn` タイマー。
- `applyAction(play)`
  - 検証：手番本人、`cardId` が手札にある、pm10 なら `sign` がある。
  - 合計を計算：`num` は加算、`pm10` は ±10（下限 0）、`pass`/`return` は変化なし、`max` は `limit` にセット。`return` は `direction *= -1`。
  - 捨て札へ移し、`lastPlay`/`log` を更新。イベント `card.played`。
  - `total > limit` なら `phase='busted'`、`result = { losers:[playerId], reason:'合計 ${total} で ${limit} を超えた' }`。
  - そうでなければ補充し、手番を進め、`total` に応じた制限時間で `turn` タイマーを更新。
- `onTimer(turn)`：手札からランダムに選んで `play`（pm10 は −1）。
- `pendingPlayers`：`phase==='turn'` なら `[手番プレイヤー]`。

### View

```ts
interface HundredOneTableView {
  phase: 'turn' | 'busted';
  total: number; limit: number;
  order: PlayerId[];
  currentPlayerId: PlayerId;
  nextPlayerId: PlayerId;
  direction: 1 | -1;
  deadline: number | null;
  handCounts: Record<PlayerId, number>;
  lastPlay: Play | null;
  log: Play[];
  revealedHands?: Record<PlayerId, Card[]>;   // busted 時に全員の手札を公開（「実はパス持ってた」を楽しむ）
}

interface HundredOnePlayerView {
  hand: (Card & { wouldBust: boolean })[];    // ±10 は −10 側で判定
  isMyTurn: boolean;
  isNext: boolean;
}
```

### エッジケース

- 切断中のプレイヤーは手番タイマーで自動プレイされる（最長でも 10 秒で次に進む）。
- 混在時、共有端末配下のプレイヤーの手番ではテーブル画面がホットシートに切り替わる。
