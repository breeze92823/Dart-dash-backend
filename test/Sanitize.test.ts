import assert from "assert";

import { CURRENCY_MAX } from "../src/constants.js";
import { sanitizeProgress } from "../src/sanitize.js";

describe("sanitizeProgress", () => {
  it("rejects non-objects and bounds numbers", () => {
    assert.strictEqual(sanitizeProgress(null), null);
    assert.strictEqual(sanitizeProgress([1]), null);
    const out = sanitizeProgress({ money: 1e40, earned: -5, captures: NaN, steps: 3.7, bestTier: 99, hack: "x" })!;
    assert.strictEqual(out.money, CURRENCY_MAX);
    assert.strictEqual(out.earned, 0);
    assert.strictEqual(out.captures, undefined);
    assert.strictEqual(out.steps, 3);
    assert.strictEqual(out.bestTier, 16);
    assert.ok(!("hack" in out));
  });

  it("keeps well-formed zoo animals with unique ids across the pen and storage", () => {
    const out = sanitizeProgress({
      pen: { level: 0, animals: [{ id: 1, species: "cow", mutation: "void", income: 10, at: 5 }, { id: 2, species: "Bad Id!", income: 1 }, { id: 3, species: "pig", mutation: 7, income: 1 }] },
      storage: [{ id: 1, species: "fox", mutation: null, income: 3 }, { id: 4, species: "fox", income: -3 }, "x"],
    })!;
    assert.strictEqual(out.pen!.level, 1);
    assert.deepStrictEqual(out.pen!.animals, [{ id: 1, species: "cow", mutation: "void", income: 10, at: 5 }]);
    assert.deepStrictEqual(out.storage, [{ id: 4, species: "fox", mutation: null, income: 0, at: 0 }], "duplicate id 1 dropped");
  });

  it("bounds the Index, cosmetics and owned maps; only equips owned items", () => {
    const out = sanitizeProgress({
      discovered: { cow: 2.5, "bad id": 1, fox: "x" },
      mutCaught: { cow: ["normal", "golden", "golden", "Bad!"] },
      mutClaimed: { shiny: [10, 10, 20, -1] },
      indexClaimed: ["meadow", "meadow"],
      weapons: { blowpipe: true, rifle: "yes" },
      weapon: "rifle",
      cosmetics: { skins: { classic: true, neon: true }, skin: "neon", trails: { none: true }, trail: "fire", auras: {}, aura: "void" },
      world: "volcano",
      worldsUnlocked: ["meadow"],
      settings: { music: false, effects: "off" },
    })!;
    assert.deepStrictEqual(out.discovered, { cow: 2 });
    assert.deepStrictEqual(out.mutCaught, { cow: ["normal", "golden"] });
    assert.deepStrictEqual(out.mutClaimed, { shiny: [10, 20] });
    assert.deepStrictEqual(out.indexClaimed, ["meadow"]);
    assert.deepStrictEqual(out.weapons, { blowpipe: true });
    assert.strictEqual(out.weapon, undefined, "an unowned weapon is not equipped");
    assert.strictEqual(out.cosmetics!.skin, "neon");
    assert.strictEqual(out.cosmetics!.trail, "none");
    assert.strictEqual(out.cosmetics!.aura, "none");
    assert.strictEqual(out.world, undefined, "a locked world is not kept");
    assert.deepStrictEqual(out.settings, { music: false });
  });

  it("keeps the Dart Shop's stock, Big Quiver and free-restock timer", () => {
    const out = sanitizeProgress({ dartShop: { restockAt: 5, stock: { basic: 70.9, void: 2, "bad id": 3 }, quiver: true, freeAt: 9, hack: 1 } })!;
    assert.deepStrictEqual(out.dartShop, { restockAt: 5, stock: { basic: 70, void: 2 }, quiver: true, freeAt: 9 });
  });

  it("never takes the server-owned clocks", () => {
    const out = sanitizeProgress({ ptDay: 1, ptSeconds: 9999, ptClaimed: [0], spins: 9, dailyDay: 7 })! as any;
    assert.deepStrictEqual(out, {});
  });
});
