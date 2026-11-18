import { PLAYTIME_STEPS } from "./constants.js";
import type { PlayerDoc } from "./db.js";

// Playtime Rewards (client src/game/playtime.js, PLAYTIME): reward i unlocks once the player has
// been connected PLAYTIME_STEPS[i] seconds today (UTC day, the SERVER's clock), so a reload, a
// second tab or a changed device clock can't reset or speed it up. The clock runs while a session
// is connected (including the short reconnect window); a new UTC day starts it over with nothing
// claimed. Unlike the rest of the save, the client never writes these fields: claims go through
// `claimPlaytime` (WorldRoom.ts) and only then does the client grant the reward.
export interface PlaytimeState {
  day: number; // UTC day index the clock belongs to
  seconds: number; // banked seconds that day (up to `since`)
  since: number; // epoch ms the running stretch started
  claimed: number[]; // claimed PLAYTIME_STEPS indexes that day
}

const DAY_MS = 86_400_000;
export const utcDay = (ms = Date.now()) => Math.floor(ms / DAY_MS);

// A player's state from their doc (null = new player); a stored clock from an older day resets.
export function readPlaytime(doc: Partial<PlayerDoc> | null, now = Date.now()): PlaytimeState {
  const today = utcDay(now);
  if (doc?.ptDay !== today) return { day: today, seconds: 0, since: now, claimed: [] };
  const seconds = Number.isFinite(doc.ptSeconds) ? Math.min(DAY_MS / 1000, Math.max(0, doc.ptSeconds!)) : 0;
  const raw = Array.isArray(doc.ptClaimed) ? doc.ptClaimed : [];
  const claimed = [...new Set(raw.filter((i) => Number.isInteger(i) && i >= 0 && i < PLAYTIME_STEPS.length))].sort((a, b) => a - b);
  return { day: today, seconds, since: now, claimed };
}

// Moves the clock to `now`: a session that ran through midnight starts the new day at 00:00.
export function roll(s: PlaytimeState, now = Date.now()) {
  const today = utcDay(now);
  if (today !== s.day) {
    s.day = today;
    s.seconds = 0;
    s.claimed = [];
    s.since = Math.max(s.since, today * DAY_MS);
  }
  s.seconds = Math.min(DAY_MS / 1000, s.seconds + Math.max(0, now - s.since) / 1000);
  s.since = now;
}

// Claims reward i. Returns null when ok, else the reason ('bad' | 'claimed' | 'early').
export function claimPlaytime(s: PlaytimeState, i: unknown, now = Date.now()): string | null {
  roll(s, now);
  if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= PLAYTIME_STEPS.length) return "bad";
  if (s.claimed.includes(i as number)) return "claimed";
  if (s.seconds < PLAYTIME_STEPS[i as number]) return "early";
  s.claimed.push(i as number);
  s.claimed.sort((a, b) => a - b);
  return null;
}

// What the client is sent: seconds played today, what's claimed, when the day ends.
export function playtimeView(s: PlaytimeState, now = Date.now()) {
  roll(s, now);
  return { seconds: Math.floor(s.seconds), claimed: [...s.claimed], nextAt: (s.day + 1) * DAY_MS, serverTime: now };
}

// The doc fields that store it.
export function playtimeFields(s: PlaytimeState, now = Date.now()) {
  roll(s, now);
  return { ptDay: s.day, ptSeconds: Math.floor(s.seconds), ptClaimed: [...s.claimed] };
}
