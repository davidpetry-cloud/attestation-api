import { createMemoryStore } from "./stores/memoryStore.js";
import { createPostgresStore } from "./stores/postgresStore.js";

// DATABASE_URL present -> Postgres, persists across restarts and deploys.
// Otherwise an in-memory Map -> fine for local dev, gone on restart.
export function createDefaultStore() {
  return process.env.DATABASE_URL
    ? createPostgresStore(process.env.DATABASE_URL)
    : createMemoryStore();
}
