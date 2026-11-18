import { listen } from "@colyseus/tools";

import app from "./app.config.js";
import { connectDb } from "./db.js";
import { installRoomReporter } from "./legion-room-reporter.js";

// Player-progress persistence (src/db.ts) connects before the room accepts
// players; connectDb() itself never throws or hangs (degrades to "no persistence").
await connectDb();

// Listens on PORT (or 2567).
await listen(app);

// Pushes this pod's rooms to Bloxity's matchmaker every ~2 s (the game page's "Open Rooms", friend joins and
// join-by-id); a no-op outside a Bloxity deployment.
installRoomReporter();
