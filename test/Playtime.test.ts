import assert from "assert";
import type { ColyseusTestServer } from "@colyseus/testing";

import type appConfig from "../src/app.config.js";
import { WorldState } from "../src/rooms/schema/WorldState.js";
import { __setPlayersForTest } from "../src/db.js";
import { PLAYTIME_STEPS } from "../src/constants.js";
import { claimPlaytime, playtimeView, readPlaytime, roll, utcDay } from "../src/playtime.js";
import { fakePlayers, sleep } from "./fakePlayers.js";
import { testServer } from "./server.js";

const DAY = 86_400_000;

describe("playtime rules", () => {
  it("counts connected time and only claims unlocked, unclaimed rewards", () => {
    const t0 = 100 * DAY + 1000;
    const s = readPlaytime(null, t0);
    assert.strictEqual(claimPlaytime(s, 0, t0 + 30_000), "early");
    assert.strictEqual(claimPlaytime(s, 0, t0 + 61_000), null);
    assert.strictEqual(claimPlaytime(s, 0, t0 + 62_000), "claimed");
    assert.strictEqual(claimPlaytime(s, 99, t0 + 62_000), "bad");
    assert.strictEqual(claimPlaytime(s, "1", t0 + 62_000), "bad");
    assert.strictEqual(playtimeView(s, t0 + 90_000).seconds, 90);
  });

  it("starts over on a new UTC day, also mid-session", () => {
    const s = readPlaytime({ ptDay: 99, ptSeconds: 5000, ptClaimed: [0, 1] }, 100 * DAY + 10);
    assert.deepStrictEqual([s.seconds, s.claimed], [0, []], "a stored older day resets");
    const t = readPlaytime({ ptDay: 100, ptSeconds: 3000, ptClaimed: [0, 0, 50] }, 100 * DAY + 10);
    assert.deepStrictEqual([t.seconds, t.claimed], [3000, [0]]);
    roll(t, 101 * DAY + 20_000);
    assert.deepStrictEqual([t.day, Math.round(t.seconds), t.claimed], [101, 20, []], "only the time since midnight counts");
  });
});

describe("playtime room", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  before(async () => (colyseus = await testServer()));
  beforeEach(async () => await colyseus.cleanup());
  afterEach(() => __setPlayersForTest(null));

  it("sends the stored clock, stores a claim and refuses an early or repeated one", async () => {
    const fake = fakePlayers([{ _id: "p1", ptDay: utcDay(), ptSeconds: 200, ptClaimed: [0], version: 1, updatedAt: new Date() }]);
    __setPlayersForTest(fake);
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c = await colyseus.connectTo(room, { userId: "p1" });
    let pt: any = null;
    const results: any[] = [];
    c.onMessage("*", () => {});
    c.onMessage("playtime", (m: any) => (pt = m));
    c.onMessage("playtimeResult", (m: any) => results.push(m));
    fake.release();
    await sleep(150);
    assert.ok(pt.seconds >= 200 && pt.seconds < 205);
    assert.deepStrictEqual(pt.claimed, [0]);

    c.send("claimPlaytime", { i: 1 }); // 180 s: ready
    c.send("claimPlaytime", { i: 0 }); // claimed already
    c.send("claimPlaytime", { i: PLAYTIME_STEPS.length - 1 }); // an hour: too early
    await sleep(200);
    assert.strictEqual(results.length, 3);
    assert.deepStrictEqual(results.filter((r) => r.ok).map((r) => r.i), [1]);
    assert.deepStrictEqual(results.filter((r) => !r.ok).map((r) => r.reason).sort(), ["claimed", "early"]);
    assert.deepStrictEqual((fake.docs.get("p1") as any).ptClaimed, [0, 1]);

    // saveProgress can't touch it.
    c.send("saveProgress", { money: 1, ptSeconds: 99999, ptClaimed: [] });
    await sleep(150);
    assert.deepStrictEqual((fake.docs.get("p1") as any).ptClaimed, [0, 1]);
  });

  it("gives a guest a session-only clock", async () => {
    const fake = fakePlayers();
    __setPlayersForTest(fake);
    fake.release();
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c = await colyseus.connectTo(room, { userId: "guest-z" });
    let result: any = null;
    c.onMessage("*", () => {});
    c.onMessage("playtimeResult", (m: any) => (result = m));
    await sleep(150);
    c.send("claimPlaytime", { i: 0 });
    await sleep(150);
    assert.deepStrictEqual([result?.ok, result?.reason], [false, "early"]);
    assert.strictEqual(fake.docs.size, 0, "a guest is never written");
  });
});
