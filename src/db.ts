import { MongoClient, type Collection } from "mongodb";

import { LEADERBOARD_STATS } from "./constants.js";

// Bloxity Legion hosting injects MONGODB_URI per game+channel -- an isolated database with
// scoped credentials. A local `npm start` normally has no Mongo reachable, so a missing or
// unreachable URI must degrade to "no persistence" rather than crash the room.

// The persisted client state (what `saveProgress` carries, see sanitize.ts; client
// src/game/state.js snapshot()). Signed-in players' only save; guests are never stored.
export interface PlayerDoc {
  _id: string; // Bloxity user id -- see WorldRoom.ts (guests are never saved)
  username?: string; // display name as of the last save
  v?: number; // client save version (2 = active/storage zoo)
  money?: number; // $ (the only currency)
  earned?: number; // $ earned in total (goals)
  captures?: number;
  steps?: number; // treadmill steps = speed (the shoe counter)
  playtime?: number; // s played in total
  darts?: Record<string, number>; // dart type -> count
  dartType?: string;
  weapons?: Record<string, boolean>; // owned weapons
  weapon?: string;
  pen?: { level: number; animals: ZooAnimal[] }; // level -> active slots; animals = ACTIVE
  storage?: ZooAnimal[]; // caught animals in storage (no income)
  treadmill?: { unlocked: boolean; level: number };
  discovered?: Record<string, number>; // species -> times caught (the Index)
  mutCaught?: Record<string, string[]>; // species -> mutation ids caught with ("normal" = none)
  bestTier?: number;
  eventCaught?: number;
  boosts?: Record<string, number>; // boost id -> epoch ms it ends
  giftAt?: number; // epoch ms the free gift is ready
  bp?: { xp: number; claimed: number[] }; // battle pass (free track)
  goal?: number; // GOALS index
  cosmetics?: { trails: Record<string, boolean>; trail: string; auras: Record<string, boolean>; aura: string; skins: Record<string, boolean>; skin: string };
  dartShop?: { restockAt: number; stock: Record<string, number>; quiver?: boolean; freeAt?: number };
  world?: string; // the lane's current world (client WORLDS id)
  worldsUnlocked?: string[];
  indexClaimed?: string[]; // worlds whose Index reward was claimed
  mutClaimed?: Record<string, number[]>; // mutation -> milestones claimed
  seasonClaimed?: string[]; // seasons whose Index reward was claimed
  settings?: Record<string, boolean>; // music / ambience / effects / interface
  nextId?: number; // next zoo animal id
  lastSeen?: number; // epoch ms of the last activity
  // Playtime Rewards (playtime.ts): written by the server only, never by saveProgress.
  ptDay?: number; // UTC day index the clock below belongs to
  ptSeconds?: number; // s played that day
  ptClaimed?: number[]; // PLAYTIME_STEPS indexes claimed that day
  // Spin wheel (spin.ts) and Daily Reward (daily.ts), kept from the template: server-written only.
  spins?: number;
  spinAt?: number;
  dailyDay?: number;
  dailyLast?: number;
  dailyClaimed?: number[];
  version: number;
  updatedAt: Date;
}

// One zoo animal (client state.pen.animals / state.storage entries).
export interface ZooAnimal {
  id: number;
  species: string;
  mutation: string | null;
  income: number; // $/s
  at: number; // epoch ms caught
}

let client: MongoClient | null = null;
let players: Collection<PlayerDoc> | null = null;

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[db] MONGODB_URI not set -- player progress will not persist");
    return;
  }
  try {
    client = new MongoClient(uri);
    await client.connect();
    // No dbName passed to .db() -- the injected URI already points at this game+channel's database.
    players = client.db().collection<PlayerDoc>("players");
    console.log("[db] connected to MongoDB");
    // The leaderboards sort and count by these (leaderboard.ts).
    for (const stat of LEADERBOARD_STATS) {
      players.createIndex({ [stat]: -1 }).catch((err) => console.warn(`[db] index on ${stat} failed`, err));
    }
  } catch (err) {
    console.warn("[db] connect failed -- player progress will not persist:", err);
    client = null;
    players = null;
  }
}

// Null whenever Mongo is unset/unreachable -- every caller must treat that as "skip persistence".
export function getPlayers(): Collection<PlayerDoc> | null {
  return players;
}

// Test-only seam: exercise the save/load logic against an in-memory fake collection.
export function __setPlayersForTest(fake: Collection<PlayerDoc> | null): void {
  players = fake;
}
