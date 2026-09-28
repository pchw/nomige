// 開発サーバーに対して、ルーム作成 → 複数端末の参加 → 1ラウンドのプレイまでを通しで確認する
// 使い方（コンテナ内）: node scripts/smoke.mjs [gameId]
const BASE = process.env.BASE_URL ?? "http://localhost:8787";
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
  return new Promise((resolve) => {
    const ws = new WebSocket(`${BASE.replace("http", "ws")}/api/rooms/${code}/ws`);
    const client = { ws, name, room: null, game: null, deviceId: null, errors: [] };
    ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "hello" })));
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "welcome") {
        client.deviceId = msg.deviceId;
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
for (let step = 0; step < 200 && host.room.phase !== "result"; step++) {
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
