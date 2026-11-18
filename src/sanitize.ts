import {
  COUNT_MAX, CURRENCY_MAX, ID_PATTERN, LIST_MAX, MUTATIONS_PER_SPECIES, OWNED_MAX, PEN_LEVEL_MAX, PLAY_SECONDS_MAX, SPECIES_MAX, ZOO_MAX,
} from "./constants.js";
import type { PlayerDoc, ZooAnimal } from "./db.js";

export function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
export function clampNum(v: number, max: number): number {
  return Math.min(max, Math.max(0, v));
}
export function clampInt(v: number, max: number, min = 0): number {
  return Math.min(max, Math.max(min, Math.floor(v)));
}
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
const isId = (v: unknown): v is string => typeof v === "string" && ID_PATTERN.test(v);
// Epoch ms, at most a year ahead (boost ends, gift / restock times).
const epoch = (v: unknown): number | undefined => (finite(v) ? clampInt(v, Date.now() + 366 * 86_400_000) : undefined);

// Catalog ids: slug strings, no duplicates, bounded count.
export function sanitizeIds(raw: unknown, max = OWNED_MAX): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isId))].slice(0, max);
}
// Whole numbers 0..max, no duplicates, sorted (claimed lists).
function sanitizeInts(raw: unknown, max: number, count = LIST_MAX): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((i): i is number => Number.isInteger(i) && i >= 0 && i <= max))].sort((a, b) => a - b).slice(0, count);
}
// { id: n } maps with slug keys and bounded numbers.
function sanitizeCounts(raw: unknown, max: number, keys = SPECIES_MAX, int = true): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(raw)) return out;
  for (const [id, n] of Object.entries(raw)) {
    if (Object.keys(out).length >= keys) break;
    if (isId(id) && finite(n)) out[id] = int ? clampInt(n, max) : clampNum(n, max);
  }
  return out;
}
// { id: true } owned maps.
function sanitizeOwned(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isObject(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= OWNED_MAX) break;
    if (isId(id) && v === true) out[id] = true;
  }
  return out;
}
const idOr = (v: unknown, owned?: Record<string, boolean>) => (isId(v) && (!owned || owned[v]) ? v : undefined);

// Zoo animals { id, species, mutation, income, at }: unique ids, slug species/mutation, bounded.
export function sanitizeZoo(raw: unknown, max = ZOO_MAX, seen = new Set<number>()): ZooAnimal[] {
  if (!Array.isArray(raw)) return [];
  const out: ZooAnimal[] = [];
  for (const a of raw) {
    if (out.length >= max) break;
    if (!isObject(a) || !Number.isInteger(a.id) || (a.id as number) < 0 || seen.has(a.id as number) || !isId(a.species) || !finite(a.income)) continue;
    if (a.mutation !== null && a.mutation !== undefined && !isId(a.mutation)) continue;
    seen.add(a.id as number);
    out.push({ id: a.id as number, species: a.species, mutation: (a.mutation as string | null) ?? null, income: clampNum(a.income, CURRENCY_MAX), at: epoch(a.at) ?? 0 });
  }
  return out;
}

// The game is client-authoritative -- no server-side gameplay validation. What IS enforced:
// shape and bounds, so a malformed payload can never corrupt this player's own Mongo document.
// A forged number can only ever affect the sender's own save. Server-owned fields (Playtime
// Rewards, spins, daily) are never taken from here.
export function sanitizeProgress(raw: unknown): Partial<PlayerDoc> | null {
  if (!isObject(raw)) return null;
  const out: Partial<PlayerDoc> = {};

  if (finite(raw.v)) out.v = clampInt(raw.v, 1000);
  if (finite(raw.money)) out.money = clampNum(raw.money, CURRENCY_MAX);
  if (finite(raw.earned)) out.earned = clampNum(raw.earned, CURRENCY_MAX);
  for (const k of ["captures", "steps", "eventCaught", "goal", "nextId"] as const) if (finite(raw[k])) out[k] = clampInt(raw[k] as number, COUNT_MAX);
  if (finite(raw.bestTier)) out.bestTier = clampInt(raw.bestTier, 16, -1);
  if (finite(raw.playtime)) out.playtime = clampInt(raw.playtime, PLAY_SECONDS_MAX);
  if (finite(raw.lastSeen)) out.lastSeen = clampInt(raw.lastSeen, Date.now() + 10 * 60 * 1000);
  const giftAt = epoch(raw.giftAt);
  if (giftAt !== undefined) out.giftAt = giftAt;

  if (raw.darts !== undefined) out.darts = sanitizeCounts(raw.darts, COUNT_MAX, 32);
  if (isId(raw.dartType)) out.dartType = raw.dartType;
  if (raw.weapons !== undefined) out.weapons = sanitizeOwned(raw.weapons);
  const weapon = idOr(raw.weapon, out.weapons);
  if (weapon) out.weapon = weapon;

  // Zoo: the active pen + storage share one id space.
  const seen = new Set<number>();
  if (isObject(raw.pen)) {
    out.pen = {
      level: finite(raw.pen.level) ? clampInt(raw.pen.level, PEN_LEVEL_MAX, 1) : 1,
      animals: sanitizeZoo(raw.pen.animals, ZOO_MAX, seen),
    };
  }
  if (raw.storage !== undefined) out.storage = sanitizeZoo(raw.storage, ZOO_MAX, seen);
  if (isObject(raw.treadmill)) out.treadmill = { unlocked: raw.treadmill.unlocked === true, level: finite(raw.treadmill.level) ? clampInt(raw.treadmill.level, 16) : 0 };

  // Index.
  if (raw.discovered !== undefined) out.discovered = sanitizeCounts(raw.discovered, COUNT_MAX);
  if (raw.mutCaught !== undefined) {
    const m: Record<string, string[]> = {};
    if (isObject(raw.mutCaught)) {
      for (const [id, list] of Object.entries(raw.mutCaught)) {
        if (Object.keys(m).length >= SPECIES_MAX) break;
        if (isId(id)) m[id] = sanitizeIds(list, MUTATIONS_PER_SPECIES);
      }
    }
    out.mutCaught = m;
  }
  if (raw.indexClaimed !== undefined) out.indexClaimed = sanitizeIds(raw.indexClaimed, LIST_MAX);
  if (raw.seasonClaimed !== undefined) out.seasonClaimed = sanitizeIds(raw.seasonClaimed, LIST_MAX);
  if (raw.mutClaimed !== undefined) {
    const m: Record<string, number[]> = {};
    if (isObject(raw.mutClaimed)) for (const [id, list] of Object.entries(raw.mutClaimed)) if (isId(id) && Object.keys(m).length < 32) m[id] = sanitizeInts(list, 1000, 16);
    out.mutClaimed = m;
  }

  if (raw.boosts !== undefined) {
    const b: Record<string, number> = {};
    if (isObject(raw.boosts)) for (const [id, t] of Object.entries(raw.boosts)) if (isId(id) && Object.keys(b).length < 16 && epoch(t) !== undefined) b[id] = epoch(t)!;
    out.boosts = b;
  }
  if (isObject(raw.bp)) out.bp = { xp: finite(raw.bp.xp) ? clampInt(raw.bp.xp, COUNT_MAX) : 0, claimed: sanitizeInts(raw.bp.claimed, 1000) };
  if (isObject(raw.cosmetics)) {
    const c = raw.cosmetics;
    const trails = sanitizeOwned(c.trails);
    const auras = sanitizeOwned(c.auras);
    const skins = sanitizeOwned(c.skins);
    out.cosmetics = { trails, trail: idOr(c.trail, trails) ?? "none", auras, aura: idOr(c.aura, auras) ?? "none", skins, skin: idOr(c.skin) ?? "classic" };
  }
  if (isObject(raw.dartShop)) {
    out.dartShop = {
      restockAt: epoch(raw.dartShop.restockAt) ?? 0,
      stock: sanitizeCounts(raw.dartShop.stock, 1000, 32),
      quiver: raw.dartShop.quiver === true, // Big Quiver (bought for $): stocks x2
      freeAt: epoch(raw.dartShop.freeAt) ?? 0, // next free restock
    };
  }
  if (raw.worldsUnlocked !== undefined) out.worldsUnlocked = sanitizeIds(raw.worldsUnlocked, 32);
  if (isId(raw.world) && (!out.worldsUnlocked || out.worldsUnlocked.includes(raw.world))) out.world = raw.world;
  if (isObject(raw.settings)) {
    const st: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(raw.settings)) if (isId(k) && typeof v === "boolean" && Object.keys(st).length < 16) st[k] = v;
    out.settings = st;
  }
  return out;
}
