import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createMemoryStore } from "../src/stores/memoryStore.js";

const API_KEY = "test-key";
let app;

beforeEach(() => {
  app = createApp({ store: createMemoryStore(), apiKey: API_KEY });
});

const authed = (req) => req.set("Authorization", `Bearer ${API_KEY}`);

describe("GET /", () => {
  it("describes the API instead of 404ing", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("attestation-api");
    expect(res.body.endpoints).toContain("GET    /health");
  });
});

describe("auth", () => {
  it("401s a write with no bearer token", async () => {
    const res = await request(app).post("/assertions").send({ payload: { a: 1 } });
    expect(res.status).toBe(401);
  });

  it("401s a write with the wrong token", async () => {
    const res = await request(app)
      .post("/assertions")
      .set("Authorization", "Bearer wrong-key")
      .send({ payload: { a: 1 } });
    expect(res.status).toBe(401);
  });

  it("does not require a token to read", async () => {
    const res = await request(app).get("/assertions");
    expect(res.status).toBe(200);
  });
});

describe("POST /assertions", () => {
  it("proposes a value and returns proposed status", async () => {
    const res = await authed(request(app).post("/assertions")).send({
      payload: { hpf: "IN" },
      model: "Claude",
      rationale: "test",
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("proposed");
    expect(res.body.id).toBeTruthy();
  });

  it("rejects a missing payload", async () => {
    const res = await authed(request(app).post("/assertions")).send({ model: "Claude" });
    expect(res.status).toBe(400);
  });
});

describe("attestation lifecycle", () => {
  it("cannot be promoted to attested by spoofing fields in the proposal", async () => {
    const created = await authed(request(app).post("/assertions")).send({
      payload: { hpf: "IN" },
      model: "Claude",
      rationale: "test",
      attestation: { by: "David Petry", verified: "2026-01-01" },
    });

    expect(created.body.status).toBe("proposed");
  });

  it("moves proposed -> attested when a named human signs it", async () => {
    const created = await authed(request(app).post("/assertions")).send({
      payload: { hpf: "IN" },
      model: "Claude",
      rationale: "test",
    });

    const attested = await authed(request(app).post(`/assertions/${created.body.id}/attest`)).send({
      by: "David Petry",
      role: "FOH engineer",
      basis: "Verified at the console",
      verified: "2026-08-27",
    });

    expect(attested.status).toBe(200);
    expect(attested.body.status).toBe("attested");
  });

  it("400s an attestation missing a name or basis", async () => {
    const created = await authed(request(app).post("/assertions")).send({ payload: { hpf: "IN" } });

    const res = await authed(request(app).post(`/assertions/${created.body.id}/attest`)).send({
      by: "David Petry",
    });
    expect(res.status).toBe(400);
  });

  it("rejects with a named reason and the rejection persists", async () => {
    const created = await authed(request(app).post("/assertions")).send({ payload: { hpf: "IN" } });

    const rejected = await authed(request(app).post(`/assertions/${created.body.id}/reject`)).send({
      by: "David Petry",
      reason: "Low cut too aggressive",
    });

    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe("rejected");
  });

  it("reverify resets the decay clock and keeps the prior record in supersedes", async () => {
    const created = await authed(request(app).post("/assertions")).send({ payload: { hpf: "IN" } });

    const first = await authed(request(app).post(`/assertions/${created.body.id}/attest`)).send({
      by: "David Petry",
      basis: "console check",
      verified: "2024-01-01",
      ttlDays: 30,
    });

    expect(first.body.daysRemaining).toBeLessThan(0);

    const reverified = await authed(request(app).post(`/assertions/${created.body.id}/reverify`)).send({
      by: "David Petry",
      basis: "re-checked",
      verified: "2026-09-16",
      ttlDays: 730,
    });

    expect(reverified.body.status).toBe("attested");
    expect(reverified.body.attestation.supersedes).toBeTruthy();
  });

  it("404s on an unknown id", async () => {
    const res = await request(app).get("/assertions/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("GET /assertions", () => {
  it("lists assertions with a status tally", async () => {
    await authed(request(app).post("/assertions")).send({ payload: { a: 1 } });
    await authed(request(app).post("/assertions")).send({ payload: { b: 2 } });

    const res = await request(app).get("/assertions");
    expect(res.body.assertions).toHaveLength(2);
    expect(res.body.tally.proposed).toBe(2);
  });
});
