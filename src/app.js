import express from "express";
import { propose, attest, reject, resolveStatus, daysRemaining, tally } from "attestation-ledger";
import { createDefaultStore } from "./store.js";
import { requireApiKey } from "./auth.js";

export function createApp({ store = createDefaultStore(), apiKey = process.env.API_KEY } = {}) {
  const app = express();
  app.use(express.json());

  const view = (id, record) => ({
    id,
    ...record,
    status: resolveStatus(record),
    daysRemaining: daysRemaining(record),
  });

  const auth = requireApiKey(apiKey);

  app.post("/assertions", auth, async (req, res) => {
    const { payload, model, rationale } = req.body ?? {};
    if (payload === undefined) {
      return res.status(400).json({ error: "payload is required" });
    }
    try {
      const record = propose(payload, { model, rationale });
      const id = await store.insert(record);
      res.status(201).json(view(id, record));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/assertions", async (req, res) => {
    const entries = (await store.list()).map(([id, record]) => view(id, record));
    res.json({ assertions: entries, tally: tally(entries.map(({ id, ...r }) => r)) });
  });

  app.get("/assertions/:id", async (req, res) => {
    const record = await store.get(req.params.id);
    if (!record) return res.status(404).json({ error: "not found" });
    res.json(view(req.params.id, record));
  });

  // Re-verifying is the same library operation as the initial attestation:
  // it resets the decay clock and preserves the prior record in `supersedes`.
  const handleAttest = async (req, res) => {
    const record = await store.get(req.params.id);
    if (!record) return res.status(404).json({ error: "not found" });
    const { by, role, basis, verified, ttlDays } = req.body ?? {};
    try {
      const signed = attest(record, { by, role, basis, verified, ttlDays });
      await store.replace(req.params.id, signed);
      res.json(view(req.params.id, signed));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  app.post("/assertions/:id/attest", auth, handleAttest);
  app.post("/assertions/:id/reverify", auth, handleAttest);

  app.post("/assertions/:id/reject", auth, async (req, res) => {
    const record = await store.get(req.params.id);
    if (!record) return res.status(404).json({ error: "not found" });
    const { by, role, reason, reviewed } = req.body ?? {};
    try {
      const turned = reject(record, { by, role, reason, reviewed });
      await store.replace(req.params.id, turned);
      res.json(view(req.params.id, turned));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.get("/", (req, res) => {
    res.json({
      name: "attestation-api",
      description: "REST API for attestation-ledger — human-in-the-loop provenance for AI-generated assertions",
      repo: "https://github.com/davidpetry-cloud/attestation-api",
      endpoints: [
        "POST   /assertions",
        "GET    /assertions",
        "GET    /assertions/:id",
        "POST   /assertions/:id/attest",
        "POST   /assertions/:id/reverify",
        "POST   /assertions/:id/reject",
        "GET    /health",
      ],
    });
  });

  return app;
}
