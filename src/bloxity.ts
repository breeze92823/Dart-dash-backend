// Server side of the Bloxity (Legion) integration. Docs: https://docs.bloxity.io/#html5
//  - verifyGameToken: who a player really is (POST /v1/auth/game-token/verify). The room never trusts
//    an id sent by the client when it runs hosted; no/invalid token = a guest.
//  - verifyRewardToken: a rewarded ad was really watched (POST /v1/ads/reward/verify).
//  - reportScores: hosted leaderboards (POST /v1/leaderboards/hosted/{gameId}/report).
//  - reportStats: profile stats (POST /v1/games/{gameId}/stats).
// Environment (Bloxity injects the hosted ones): BLOXITY_API_URL, BLOXITY_GAME_ID, BLOXITY_REPORT_TOKEN,
// BLOXITY_GAME_SLUG (defaults to the client's slug). Nothing here throws: every call answers null/false
// on failure, and with no BLOXITY_GAME_ID (local dev, tests) the integration is off.
import { BLOXITY_BOARDS, BLOXITY_STATS, GAME_SLUG_DEFAULT, REPORT_BATCH_MAX, STAT_CEILING } from "./constants.js";

const API = () => (process.env.BLOXITY_API_URL || "https://api.bloxity.io").replace(/\/$/, "");
const SLUG = () => process.env.BLOXITY_GAME_SLUG || GAME_SLUG_DEFAULT;
const TIMEOUT_MS = 6000;

// Running on Bloxity hosting (it injects BLOXITY_GAME_ID). Hosted rooms never take a user id from a
// client; local dev and tests do, so `dev-...` ids keep their saves.
export const isHosted = () => !!process.env.BLOXITY_GAME_ID;

export interface VerifiedUser {
  id: string;
  name: string;
}

async function post(url: string, body: unknown, bearer: string): Promise<{ status: number; json: any } | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // No body.
    }
    return { status: res.status, json };
  } catch (err) {
    console.warn("[bloxity] request failed", url, (err as Error)?.message ?? err);
    return null;
  }
}

// The player behind a `Legion.SDK.auth.getToken()` JWT, or null (no token, 401, unreachable).
export async function verifyGameToken(token: unknown): Promise<VerifiedUser | null> {
  if (typeof token !== "string" || !token || token.length > 4096) return null;
  const r = await post(`${API()}/v1/auth/game-token/verify`, { gameSlug: SLUG() }, token);
  const u = r && r.status >= 200 && r.status < 300 ? r.json?.user : null;
  const id = u?._id ?? u?.id;
  if (typeof id !== "string" || !id) return null;
  return { id, name: String(u.displayName || u.username || "Player").slice(0, 64) };
}

// A rewarded ad's token checked once. Not hosted (local dev / the Create preview's test token): trusted.
export async function verifyRewardToken(token: unknown): Promise<boolean> {
  if (!isHosted()) return typeof token === "string" && token.length > 0;
  if (typeof token !== "string" || !token || token.length > 4096) return false;
  const r = await post(`${API()}/v1/ads/reward/verify`, { gameSlug: SLUG(), rewardToken: token }, token);
  return !!r && r.status >= 200 && r.status < 300 && r.json?.valid === true;
}

// --- Hosted leaderboards -----------------------------------------------------------------------
// The report identifies players as "legion_<Bloxity user id>" (any `#m...` mode suffix stripped).
// Only verified Bloxity accounts are reported (hosted rooms never hold a client-stated id).
export const reportableId = (userId: string): string | null => {
  const raw = userId.split("#")[0];
  const id = raw.startsWith("legion_") ? raw : `legion_${raw}`;
  return /^legion_[A-Za-z0-9_-]{1,120}$/.test(id) && !/^legion_(guest|dev)-/.test(id) ? id : null;
};

export interface ScoreRow {
  board: string;
  userId: string;
  score: number;
}

export async function reportScores(rows: ScoreRow[]): Promise<void> {
  const gameId = process.env.BLOXITY_GAME_ID;
  const token = process.env.BLOXITY_REPORT_TOKEN;
  if (!gameId || !token || !rows.length) return; // local dev: nothing to do
  const boards = BLOXITY_BOARDS.map(({ id, label, order, mode, format, reset }) => ({ id, label, order, mode, format, reset }));
  for (let i = 0; i < rows.length; i += REPORT_BATCH_MAX) {
    const scores = rows.slice(i, i + REPORT_BATCH_MAX);
    const r = await post(`${API()}/v1/leaderboards/hosted/${encodeURIComponent(gameId)}/report`, { boards, scores }, token);
    if (!r) continue;
    console.info("[bloxity] leaderboard report", { status: r.status, ok: r.json?.ok, accepted: r.json?.accepted, dropped: r.json?.dropped, results: r.json?.results });
  }
}

// --- Profile stats -----------------------------------------------------------------------------------
export interface StatRow {
  userId: string;
  values: Record<string, number>;
}

// The reportable values of a saved-progress object: finite, >= 0 and under the type's ceiling (Boxity
// rejects an over-ceiling value for good, so it is left out rather than sent).
export function statValues(saved: Record<string, number>): Record<string, number> {
  const values: Record<string, number> = {};
  for (const s of BLOXITY_STATS) {
    const n = Math.floor(Number(saved[s.field]));
    if (Number.isFinite(n) && n >= 0 && n <= STAT_CEILING[s.type]) values[s.key] = n;
  }
  return values;
}

export async function reportStats(rows: StatRow[]): Promise<void> {
  const gameId = process.env.BLOXITY_GAME_ID;
  const token = process.env.BLOXITY_REPORT_TOKEN;
  if (!gameId || !token || !rows.length) return; // local dev: nothing to do
  const definitions = BLOXITY_STATS.map(({ key, label, type, sortOrder }) => ({ key, label, type, sortOrder }));
  for (let i = 0; i < rows.length; i += REPORT_BATCH_MAX) {
    const players = rows.slice(i, i + REPORT_BATCH_MAX);
    const r = await post(`${API()}/v1/games/${encodeURIComponent(gameId)}/stats`, { definitions, players }, token);
    if (!r) continue;
    console.info("[bloxity] stats report", { status: r.status, ok: r.json?.ok, accepted: r.json?.accepted, dropped: r.json?.dropped });
  }
}
