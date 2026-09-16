import { randomUUID } from "node:crypto";

// In-process Map. Fast and dependency-free, but gone on restart —
// used as the local-dev default and in tests.
export function createMemoryStore() {
  const records = new Map();

  return {
    async insert(record) {
      const id = randomUUID();
      records.set(id, record);
      return id;
    },
    async get(id) {
      return records.get(id);
    },
    async replace(id, record) {
      records.set(id, record);
    },
    async list() {
      return [...records.entries()];
    },
    async clear() {
      records.clear();
    },
  };
}
