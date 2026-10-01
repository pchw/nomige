// 開発サーバーに対して、ルーム作成 → 複数端末の参加 → 1ラウンドのプレイまでを通しで確認する
// 使い方（コンテナ内）: node scripts/smoke.mjs [gameId]
// 末尾の "/" は落としておく（付いていると "//api/..." になって失敗する）
const BASE = (process.env.BASE_URL ?? "http://localhost:8787").replace(/\/+$/, "");
const gameId = process.argv[2] ?? "wolf-and-pigs";

const res = await fetch(`${BASE}/?index`, {
  method: "POST",
  body: new URLSearchParams({ gameId }),
  redirect: "manual",
});
const location = res.headers.get("location") ?? "";
const code = location.split("/").pop();
if (!code) throw new Error(`room not created: ${res.status}`);
console.log("room", code);

function connect(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE.replace("http", "ws")}/api/rooms/${code}/ws`);
    const client = { ws, name, room: null, game: null, deviceId: null, errors: [] };
    // 接続できない・welcome が来ないときは待ち続けずに失敗させる
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`${name}: welcome not received`));
    }, 10_000);
    const fail = () => {
      clearTimeout(timer);
      reject(new Error(`${name}: websocket closed before welcome`));
    };
    ws.addEventListener("error", fail);
    ws.addEventListener("close", fail);
    ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "hello" })));
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "welcome") {
        client.deviceId = msg.deviceId;
        clearTimeout(timer);
        ws.removeEventListener("error", fail);
        ws.removeEventListener("close", fail);
        resolve(client);
      }
      if (msg.type === "room") client.room = msg.room;
      if (msg.type === "game") client.game = msg.game;
      if (msg.type === "error") client.errors.push(msg.message);
    });
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (c, msg) => c.ws.send(JSON.stringify(msg));

const clients = [];
for (const name of ["Aki", "Bo", "Chi", "Dai"]) {
  const c = await connect(name);
  send(c, { type: "player.add", name });
  clients.push(c);
}
await wait(300);
const host = clients.find((c) => c.room.hostDeviceId === c.deviceId);
console.log("players", host.room.players.map((p) => `${p.name}(${p.character})`).join(", "));
send(host, { type: "room.start" });

const houses = ["straw", "wood", "brick"];
// 投げる系は1投ごとに数秒の演出があり、延長戦もあるので長めに待つ（最大90秒）
for (let step = 0; step < 600 && host.room.phase !== "result"; step++) {
  await wait(150);
  for (const c of clients) {
    const g = c.game;
    if (!g) continue;
    for (const [pid, view] of Object.entries(g.players)) {
      if (!g.pending.includes(pid)) continue;
      const t = g.table;
      let action;
      switch (g.gameId) {
        case "wolf-and-pigs":
          action =
            t.phase === "roleCheck"
              ? { type: "checkRole" }
              : view.active
                ? { type: "pick", house: houses[Math.floor(Math.random() * 3)] }
                : { type: "idle" };
          break;
        case "kabuttara-out":
          action = {
            type: "pick",
            animal: t.animals[Math.floor(Math.random() * t.animals.length)],
          };
          break;
        case "high-low":
          action = {
            type: "guess",
            guess: view.options[Math.floor(Math.random() * view.options.length)],
          };
          break;
        case "liars-dice":
          action = t.bids.length >= 3 ? { type: "doubt" } : { type: "bid", ...view.minBid };
          break;
        case "greedy-dice":
          action = t.rolls.length >= 2 ? { type: "stop" } : { type: "roll" };
          break;
        case "minesweeper": {
          const closed = t.opened.flatMap((v, i) => (v === null ? [i] : []));
          action = { type: "open", cell: closed[Math.floor(Math.random() * closed.length)] };
          break;
        }
        case "russian-roulette": {
          const free = t.pickedBy.flatMap((p, i) => (p === null ? [i] : []));
          action = { type: "pick", glass: free[Math.floor(Math.random() * free.length)] };
          break;
        }
        case "amidakuji": {
          if (t.phase === "start") {
            const free = t.startBy.flatMap((p, i) => (p === null ? [i] : []));
            action = { type: "start", column: free[Math.floor(Math.random() * free.length)] };
          } else {
            const slots = [];
            for (let row = 0; row < t.openRows; row++)
              for (let gap = 0; gap < t.columns - 1; gap++)
                if (!t.added.some((r) => r.row === row && Math.abs(r.gap - gap) <= 1))
                  slots.push({ row, gap });
            action = { type: "line", ...slots[Math.floor(Math.random() * slots.length)] };
          }
          break;
        }
        case "glass-slide":
          action = { type: "slide", x: 20 + Math.random() * 60, power: 60 + Math.random() * 25 };
          break;
        case "bowling":
          action = {
            type: "roll",
            x: 20 + Math.random() * 20,
            angle: Math.random() * 4 - 2,
            power: 60,
          };
          break;
        case "beer-pong":
          action = { type: "throw", angle: Math.random() * 4 - 2, power: 60 + Math.random() * 10 };
          break;
        case "hundred-one": {
          const card = view.hand[0];
          action = { type: "play", cardId: card.id, sign: 1 };
          break;
        }
      }
      send(c, { type: "game.action", playerId: pid, action });
    }
  }
}
await wait(300);
const r = host.room;
console.log("phase", r.phase);
console.log("result", JSON.stringify(r.lastResult));
console.log("drinks", r.players.map((p) => `${p.name}:${p.drinks}`).join(", "));
const errors = clients.flatMap((c) => c.errors);
if (errors.length) console.log("errors", [...new Set(errors)]);
for (const c of clients) c.ws.close();
process.exit(r.phase === "result" ? 0 : 1);
