import assert from "assert";
import type { ColyseusTestServer } from "@colyseus/testing";

import type appConfig from "../src/app.config.js";
import { ROOM_MAX_CLIENTS, ROOM_SIZE } from "../src/constants.js";
import { WorldState } from "../src/rooms/schema/WorldState.js";
import { sleep } from "./fakePlayers.js";
import { testServer } from "./server.js";

describe("bases", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  before(async () => (colyseus = await testServer()));
  beforeEach(async () => await colyseus.cleanup());

  it("is a room of six, each player getting their own base slot", async () => {
    assert.strictEqual(ROOM_MAX_CLIENTS, 6);
    assert.strictEqual(ROOM_SIZE, 6);
    const room = await colyseus.createRoom<WorldState>("world", {});
    const clients = [];
    for (let i = 0; i < 6; i++) clients.push(await colyseus.connectTo(room, { userId: `guest-${i}`, username: `P${i}` }));
    await sleep(50);
    const slots = clients.map((c) => room.state.players.get(c.sessionId)!.slot).sort();
    assert.deepStrictEqual(slots, [0, 1, 2, 3, 4, 5]);
    await assert.rejects(colyseus.connectTo(room, { userId: "guest-7", username: "P7" }), "a seventh player cannot join the room");
  });

  it("hands a freed slot to the next player", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const a = await colyseus.connectTo(room, { userId: "guest-a" });
    const b = await colyseus.connectTo(room, { userId: "guest-b" });
    await sleep(30);
    assert.strictEqual(room.state.players.get(a.sessionId)!.slot, 0);
    assert.strictEqual(room.state.players.get(b.sessionId)!.slot, 1);
    await a.leave(true);
    await sleep(60);
    const c = await colyseus.connectTo(room, { userId: "guest-c" });
    await sleep(30);
    assert.strictEqual(room.state.players.get(c.sessionId)!.slot, 0, "the first free base is reused");
  });

  it("relays a base's animals, treadmill and the runner, bounded", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const a = await colyseus.connectTo(room, { userId: "guest-a" });
    await sleep(30);
    const pa = room.state.players.get(a.sessionId)!;
    a.send("base", {
      animals: [{ species: "sheep", mutation: "shiny" }, { species: "fox", mutation: null }, { species: "bad species!", mutation: null }],
      level: 5,
      tml: 2,
      steps: 1234.7,
      aura: "flames",
    });
    a.send("pose", { x: 30, y: 0.4, z: -20, yaw: 1, speed: 5, tm: true, aim: false, carry: "bear:golden" });
    await sleep(50);
    assert.strictEqual(pa.base, "sheep:shiny,fox:_");
    assert.strictEqual(pa.penLevel, 5);
    assert.strictEqual(pa.tml, 2);
    assert.strictEqual(pa.steps, 1234);
    assert.strictEqual(pa.aura, "flames");
    assert.strictEqual(pa.tm, true);
    assert.strictEqual(pa.carry, "bear:golden");
    a.send("pose", { carry: "bad:carry:extra", tm: false });
    a.send("pose", { carry: "" });
    await sleep(50);
    assert.strictEqual(pa.carry, "");
    assert.strictEqual(pa.tm, false);

    a.send("base", { animals: Array.from({ length: 50 }, () => ({ species: "sheep", mutation: null as string | null })) });
    await sleep(50);
    assert.strictEqual(pa.base.split(",").length, 20, "at most the pen's 20 active slots");
  });

  it("replays emotes and refuses a rewarded-ad claim for an unknown placement", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const a = await colyseus.connectTo(room, { userId: "guest-a" });
    await sleep(30);
    const pa = room.state.players.get(a.sessionId)!;
    a.send("emote", { id: "wave" });
    a.send("emote", { id: "x".repeat(200) });
    await sleep(40);
    assert.strictEqual(pa.emote, "wave");
    assert.strictEqual(pa.emoteSeq, 1);

    const answers: any[] = [];
    a.onMessage("adRewardResult", (m: any) => answers.push(m));
    a.send("adReward", { placement: "nope", token: "t" });
    a.send("adReward", { placement: "free-darts", token: "dev-token" }); // not hosted: the token is trusted
    a.send("adReward", { placement: "free-darts", token: "dev-token" }); // cooldown
    await sleep(120);
    assert.strictEqual(answers.length, 3);
    // The refusals answer at once; the accepted claim answers after Bloxity's check.
    assert.deepStrictEqual(answers.filter((m) => !m.ok).map((m) => m.reason).sort(), ["bad", "early"]);
    assert.strictEqual(answers.filter((m) => m.ok).length, 1);
  });
});
