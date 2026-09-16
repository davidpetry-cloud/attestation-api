import { randomUUID } from "node:crypto";

// In-memory store. Swap for a real database when persistence across
// restarts matters — the route layer only talks to this file's exports.
const records = new Map();

export function insert(record) {
  const id = randomUUID();
  records.set(id, record);
  return id;
}

export function get(id) {
  return records.get(id);
}

export function replace(id, record) {
  records.set(id, record);
}

export function list() {
  return [...records.entries()];
}

export function clear() {
  records.clear();
}
