import { AVATAR_MAX_LEN, BASE_ANIMALS_MAX, EMOTE_ID_MAX, ID_PATTERN, PEN_LEVEL_RELAY_MAX, POSE_BOUNDS, PRESENCE_PETS_MAX, PET_TIERS_MAX, COUNT_MAX, TREADMILL_LEVEL_MAX } from "./constants.js";
import type { PlayerState } from "./rooms/schema/WorldState.js";

// Presence: what the other clients need to draw a player in the world (client remotePlayers.js).
// Relayed through the roster as sent, only bounded here -- like the rest of the game it is
// client-authoritative and purely cosmetic.

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const hasControlChars = (v: string) => [...v].some((c) => c.charCodeAt(0) < 32);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const isId = (v: unknown): v is string => typeof v === "string" && ID_PATTERN.test(v);

// `pose` { x, y, z, yaw, speed }: the boat's feet position in TRACK coordinates (z minus the
// sender's race scroll, so racers line up in everyone's lane), heading (rad) and speed (m/s).
export function applyPose(p: PlayerState, msg: unknown): void {
  if (!msg || typeof msg !== "object") return;
  const m = msg as Record<string, unknown>;
  const b = POSE_BOUNDS;
  if (finite(m.x)) p.x = clamp(m.x, -b.xy, b.xy);
  if (finite(m.y)) p.y = clamp(m.y, -b.xy, b.xy);
  if (finite(m.z)) p.z = clamp(m.z, -b.z, b.xy);
  if (finite(m.yaw)) p.yaw = Math.atan2(Math.sin(m.yaw), Math.cos(m.yaw));
  if (finite(m.speed)) p.speed = clamp(m.speed, 0, b.speed);
  if (typeof m.tm === "boolean") p.tm = m.tm;
  if (typeof m.aim === "boolean") p.aim = m.aim;
  // `carry` "species:mutation" (mutation "_" = none) or "" when not carrying.
  if (m.carry === "" ) p.carry = "";
  else if (typeof m.carry === "string") {
    const [sp, mu, extra] = m.carry.split(":");
    if (extra === undefined && isId(sp) && isId(mu ?? "_")) p.carry = `${sp}:${mu ?? "_"}`;
  }
}

// `base` { animals: [{ species, mutation }], level, tml, steps, trail, aura, weapon, world }: what the
// others draw in this player's base (the active pen animals), on its signs and treadmill console,
// plus the cosmetics worn. Animals travel as "species:mutation" joined by commas (mutation "_" =
// none), at most BASE_ANIMALS_MAX.
export function applyBase(p: PlayerState, msg: unknown): void {
  if (!msg || typeof msg !== "object") return;
  const m = msg as Record<string, unknown>;
  if (Array.isArray(m.animals)) {
    const out: string[] = [];
    for (const a of m.animals) {
      if (out.length >= BASE_ANIMALS_MAX) break;
      const sp = (a as { species?: unknown })?.species;
      const mu = (a as { mutation?: unknown })?.mutation;
      if (!isId(sp)) continue;
      out.push(`${sp}:${isId(mu) ? mu : "_"}`);
    }
    p.base = out.join(",");
  }
  if (finite(m.level)) p.penLevel = Math.min(PEN_LEVEL_RELAY_MAX, Math.max(1, Math.floor(m.level)));
  if (finite(m.tml)) p.tml = Math.min(TREADMILL_LEVEL_MAX, Math.max(-1, Math.floor(m.tml)));
  if (finite(m.steps)) p.steps = clamp(Math.floor(m.steps), 0, COUNT_MAX);
  for (const key of ["trail", "aura", "weapon", "world"] as const) {
    const v = m[key];
    if (v === "" || isId(v)) p[key] = v as string;
  }
}

// `emote` { id }: a Bloxity emote id (free text from the portal, length-capped) the others replay.
export function applyEmote(p: PlayerState, msg: unknown): void {
  const id = (msg as { id?: unknown })?.id;
  if (typeof id !== "string" || !id || id.length > EMOTE_ID_MAX || hasControlChars(id)) return;
  p.emote = id;
  p.emoteSeq = (p.emoteSeq + 1) % 30000;
}

// `loadout` { boat, engine, trail, partner, pets: [{ kind, tier }], world }: equipped catalog ids
// ("" = none) and the world the player is in (clients only draw players in their own world). Pets travel as "kind:tier" joined by commas, capped at PRESENCE_PETS_MAX.
export function applyLoadout(p: PlayerState, msg: unknown): void {
  if (!msg || typeof msg !== "object") return;
  const m = msg as Record<string, unknown>;
  for (const key of ["boat", "engine", "trail", "partner", "world"] as const) {
    const v = m[key];
    if (v === "" || isId(v)) p[key] = v as string;
  }
  if (Array.isArray(m.pets)) {
    const pets: string[] = [];
    for (const pet of m.pets) {
      if (pets.length >= PRESENCE_PETS_MAX) break;
      const k = (pet as { kind?: unknown })?.kind;
      const t = (pet as { tier?: unknown })?.tier;
      if (isId(k) && Number.isInteger(t) && (t as number) >= 0 && (t as number) < PET_TIERS_MAX) pets.push(`${k}:${t}`);
    }
    p.pets = pets.join(",");
  }
}

// `setAvatar` { avatar }: the Bloxity look as an opaque JSON string ("" = default), length-capped.
export function applyAvatar(p: PlayerState, msg: unknown): void {
  const a = (msg as { avatar?: unknown })?.avatar;
  if (typeof a === "string" && a.length <= AVATAR_MAX_LEN) p.avatar = a;
}
