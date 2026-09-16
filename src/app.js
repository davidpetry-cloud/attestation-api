import express from "express";
import { propose, attest, reject, resolveStatus, daysRemaining, tally } from "attestation-ledger";
import * as store from "./store.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  const view = (id, record) => ({
    id,
    ...record,
    status: resolveStatus(record),
    daysRemaining: daysRemaining(record),
  });

  app.post("/assertions", (req, res) => {
    const { payload, model, rationale } = req.body ?? {};
    if (payload === undefined) {
      return res.status(400).json({ error: "payload is required" });
    }
    try {
      const record = propose(payload, { model, rationale });
      const id = store.insert(record);
      res.status(201).json(view(id, record));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/assertions", (req, res) => {
    const entries = store.list().map(([id, record]) => view(id, record));
    res.json({ assertions: entries, tally: tally(entries.map(({ id, ...r }) => r)) });
  });

  app.get("/assertions/:id", (req, res) => {
    const record = store.get(req.params.id);
    if (!record) return res.status(404).json({ error: "not found" });
    res.json(view(req.params.id, record));
  });

  // Re-verifying is the same library operation as the initial attestation:
  // it resets the decay clock and preserves the prior record in `supersedes`.
  const handleAttest = (req, res) => {
    const record = store.get(req.params.id);
    if (!record) return res.status(404).json({ error: "not found" });
    const { by, role, basis, verified, ttlDays } = req.body ?? {};
    try {
      const signed = attest(record, { by, role, basis, verified, ttlDays });
      store.replace(req.params.id, signed);
      res.json(view(req.params.id, signed));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  app.post("/assertions/:id/attest", handleAttest);
  app.post("/assertions/:id/reverify", handleAttest);

  app.post("/assertions/:id/reject", (req, res) => {
    const record = store.get(req.params.id);
    if (!record) return res.status(404).json({ error: "not found" });
    const { by, role, reason, reviewed } = req.body ?? {};
    try {
      const turned = reject(record, { by, role, reason, reviewed });
      store.replace(req.params.id, turned);
      res.json(view(req.params.id, turned));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/health", (req, res) => res.json({ ok: true }));

  return app;
}
