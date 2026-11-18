// Keep in step with the client's src/config.js (ROOM_SIZE) by hand. One room = six players, each
// owning one of six bases (PlayerState.slot). deploy.yml sends this as the Bloxity `roomSize`.
export const ROOM_MAX_CLIENTS = 6;
export const ROOM_SIZE = ROOM_MAX_CLIENTS;

// Longest accepted strings.
export const NAME_MAX = 64;
// Profile picture URL (Bloxity `pfp`), relayed so other players can draw it.
export const PFP_MAX_LEN = 512;
// Presence (presence.ts): the Bloxity avatar JSON relayed for the others to draw, the most pets
// drawn per player, and the pose bounds (|x|, |y| and z up to `xy` m; z down to -`z` m: a race's
// track runs far down -Z; speed in m/s).
export const AVATAR_MAX_LEN = 3000;
export const PRESENCE_PETS_MAX = 8;
export const PET_TIERS_MAX = 16; // presence pets "kind:tier"
export const POSE_BOUNDS = { xy: 5000, z: 1e8, speed: 2000 };

// Colyseus drops the whole connection for a WebSocket message above this (default 4 KB).
export const MAX_PAYLOAD_BYTES = 128 * 1024;

// How long a dropped connection (WiFi blip, backgrounded tab) may reconnect with the same session.
export const RECONNECT_SECONDS = 20;

// Upper bounds for saved values, so a forged payload cannot store a bogus number. Generous
// ceilings, not game rules (the client's Volcano economy tops out far below CURRENCY_MAX).
export const CURRENCY_MAX = 1e33; // money, earned
export const COUNT_MAX = 1e12; // captures, steps, darts, XP, per-species counts
export const PLAY_SECONDS_MAX = 31_536_000; // ~1 year
// Kept from the earlier game's presence/race messages (WorldRoom `race`).
export const DISTANCE_MAX = 1e15;

// Catalog ids (client config.js: weapons, darts, skins, trails, auras, worlds, species,
// mutations), with slack.
export const OWNED_MAX = 256;
// The zoo (client PEN): active slots (maxSlots 20) + storage (60), with slack, and the most
// species / mutation ids per species an Index map may hold.
export const ZOO_MAX = 200;
export const SPECIES_MAX = 256;
export const MUTATIONS_PER_SPECIES = 16;
export const PEN_LEVEL_MAX = 64;
export const LIST_MAX = 64; // claimed-reward lists (battle pass levels, worlds, milestones)

// Playtime Rewards (playtime.ts; client PLAYTIME[i].at, which must match): seconds of play
// today (UTC day, server clock) each reward unlocks at.
export const PLAYTIME_STEPS = [60, 180, 300, 480, 660, 840, 1020, 1200, 1500, 1800, 2700, 3600] as const;

// Daily Reward (client DAILY.days): days in one calendar cycle.
export const DAILY_DAYS = 7;

// Spin wheel (client SPIN in config.js; spin.ts): one free spin every SPIN_EVERY_MS, stored up
// to SPIN_CAP; a new player starts with SPIN_START. SPINS_MAX bounds a saved count.
export const SPIN_EVERY_MS = 15 * 60 * 1000;
export const SPIN_CAP = 5;
export const SPIN_START = 1;
export const SPINS_MAX = 1e6;
// The wedges' prizes and odds (weights in %). Ids match the client's SPIN.wedges; the client
// decides what each prize is, the server only which one is won.
export const SPIN_WEDGES = [
  { id: "doubleWins", weight: 35 },
  { id: "wins50", weight: 25 },
  { id: "luck", weight: 35 },
  { id: "wins250", weight: 4.9 },
  { id: "hugePet", weight: 0.1 },
] as const;

// Leaderboards (leaderboard.ts; client hub leaderboards via bots.redrawBoards): the saved doc
// fields ranked (Money, Steps, Captures), rows per board and how often the lists are re-sent.
export const LEADERBOARD_STATS = ["money", "steps", "captures"] as const;
export type LeaderboardStat = (typeof LEADERBOARD_STATS)[number];
export const LEADERBOARD_SIZE = 10;
export const LEADERBOARD_EVERY_MS = 60 * 1000;

// Ids from the client's catalogs (species, mutations, weapons, darts, skins, trails, auras,
// worlds): camelCase slugs, so nothing odd is stored.
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

// The client's per-browser fallback id for players who are not signed in to Bloxity.
// Guests are never persisted.
export const GUEST_ID_PREFIX = "guest-";

// --- Bases (presence.ts applyBase) ------------------------------------------------------------
// The active pen animals relayed so everyone sees each base's zoo: at most the client's PEN.maxSlots.
export const BASE_ANIMALS_MAX = 20;
export const PEN_LEVEL_RELAY_MAX = 64;
export const TREADMILL_LEVEL_MAX = 8;

// --- Bloxity integration (bloxity.ts) ---------------------------------------------------------
// Slug registered on bloxity.io (the client's GAME_SLUG); BLOXITY_GAME_SLUG overrides it.
export const GAME_SLUG_DEFAULT = "dart-dash";
// Rewarded-ad placements the client may claim (the client's AD_REWARDS ids) and the least seconds
// between two claims of the same placement in one session.
export const AD_COOLDOWN_SECONDS: Record<string, number> = { "free-darts": 100, "cash-boost": 500, "luck-boost": 500 };
// Emote ids relayed to the others (Bloxity emote ids), longest accepted.
export const EMOTE_ID_MAX = 64;
// Hosted leaderboards (leaderboards: client LEADERBOARDS ids -> the saved doc field reported).
export const BLOXITY_BOARDS = [
  { id: "captures", stat: "captures", label: "Captures", order: "desc", mode: "best", format: "compact", reset: "none" },
  { id: "steps", stat: "steps", label: "Treadmill steps", order: "desc", mode: "best", format: "compact", reset: "none" },
  { id: "earned", stat: "earned", label: "Total earned", order: "desc", mode: "best", format: "compact", reset: "weekly" },
] as const;
export const REPORT_EVERY_MS = 30_000;
export const REPORT_BATCH_MAX = 200;
