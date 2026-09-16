import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS assertions (
    id UUID PRIMARY KEY,
    record JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

// Postgres-backed store, same shape as memoryStore. `record` is stored
// whole as JSONB — attestation-ledger owns the record's internal shape,
// so this table has no opinion about it beyond "it's JSON".
export function createPostgresStore(connectionString) {
  const pool = new Pool({ connectionString });
  const ready = pool.query(SCHEMA);

  return {
    async insert(record) {
      await ready;
      const id = randomUUID();
      await pool.query("INSERT INTO assertions (id, record) VALUES ($1, $2)", [id, record]);
      return id;
    },
    async get(id) {
      await ready;
      const { rows } = await pool.query("SELECT record FROM assertions WHERE id = $1", [id]);
      return rows[0]?.record;
    },
    async replace(id, record) {
      await ready;
      await pool.query(
        "UPDATE assertions SET record = $2, updated_at = now() WHERE id = $1",
        [id, record]
      );
    },
    async list() {
      await ready;
      const { rows } = await pool.query("SELECT id, record FROM assertions ORDER BY created_at");
      return rows.map((row) => [row.id, row.record]);
    },
    async clear() {
      await ready;
      await pool.query("TRUNCATE assertions");
    },
    async close() {
      await pool.end();
    },
  };
}
