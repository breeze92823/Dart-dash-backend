import { schema, t, type SchemaType } from "@colyseus/schema";

// The live roster: who is in the room. Durable progress lives in Mongo (src/db.ts).
// To sync something new about a player, add a field here and accept it in a WorldRoom message.
export const PlayerState = schema(
  {
    username: t.string().default(""), // client-reported Bloxity displayName/username, not validated
    signedIn: t.boolean().default(false), // has a Bloxity id: only signed-in players are saved
    pfp: t.string().default(""), // Bloxity profile picture URL ("" = none), for the others' racer heads
    racing: t.boolean().default(false), // in a race right now (`race` message)
    distance: t.float64().default(0), // this race's distance so far, studs
    // Presence (presence.ts, `pose` / `loadout` / `setAvatar`): what the others draw in the world.
    x: t.float64().default(0), // feet position in track coordinates (z minus the race scroll)
    y: t.float64().default(0),
    z: t.float64().default(0),
    yaw: t.float32().default(0), // heading, rad (PI = facing the gate)
    speed: t.float32().default(0), // m/s, for flames and dead reckoning
    boat: t.string().default(""), // equipped catalog ids (client config.js), "" = none / default
    engine: t.string().default(""),
    trail: t.string().default(""),
    partner: t.string().default(""),
    pets: t.string().default(""), // equipped pets "kind:tier,kind:tier"
    world: t.string().default(""), // the world the player is in (client WORLDS id), "" = the start world
    avatar: t.string().default(""), // Bloxity look JSON { equipped, proportions, skin }, "" = default
    // Bases (WorldRoom assigns `slot` on join; presence.ts applyBase / applyPose / applyEmote):
    slot: t.int16().default(-1), // which of the ROOM_SIZE bases this player owns (server-assigned)
    uid: t.string().default(""), // verified Bloxity user id ("" = guest), matches Legion.SDK.chat userId
    base: t.string().default(""), // active pen animals "species:mutation,..." (mutation "_" = none)
    penLevel: t.int16().default(1), // pen level (shown on the base's sign)
    tml: t.int8().default(-1), // treadmill level, -1 = locked
    steps: t.float64().default(0), // treadmill steps (the console screen on the treadmill)
    money: t.float64().default(0), // $ right now (the hub leaderboards list the room's players live)
    captures: t.float64().default(0), // animals captured
    tm: t.boolean().default(false), // running on the treadmill right now
    carry: t.string().default(""), // "species:mutation" while carrying an animal, "" = nothing
    aim: t.boolean().default(false), // in aim mode (blowpipe up)
    aura: t.string().default(""), // equipped aura id
    weapon: t.string().default(""), // equipped weapon id
    emote: t.string().default(""), // last Bloxity emote id played
    emoteSeq: t.int16().default(0), // bumps on every emote so a repeat re-plays
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const WorldState = schema(
  {
    players: t.map(PlayerState), // keyed by sessionId
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
