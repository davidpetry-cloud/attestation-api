# attestation-api

[![test](https://github.com/davidpetry-cloud/attestation-api/actions/workflows/test.yml/badge.svg)](https://github.com/davidpetry-cloud/attestation-api/actions/workflows/test.yml)

A REST API for [`attestation-ledger`](https://www.npmjs.com/package/attestation-ledger) —
human-in-the-loop provenance for AI-generated assertions, as a service instead
of a library you have to `npm install`.

> **A model can propose. Only a named human can attest.**

Every value submitted carries who or what asserted it. A model-generated
value can never resolve to `attested` no matter what fields are sent with it
— that rule is enforced in `attestation-ledger` itself, not in this API layer.
Attestations decay on their own unless a named human re-verifies them before
the TTL runs out.

## Run it

```bash
npm install
cp .env.example .env   # set API_KEY at minimum
npm start        # listens on :3000 (or $PORT)
npm test         # vitest, 12 tests
```

## Auth

Every write route (`POST /assertions`, `/attest`, `/reverify`, `/reject`)
requires `Authorization: Bearer <API_KEY>`. Reads (`GET`) are public — the
property worth protecting is who can write to the ledger, not who can read
it. Generate a key with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

## Endpoints

| Method | Path | Auth | Does |
|---|---|---|---|
| `POST` | `/assertions` | ✓ | Propose a value. Body: `{ payload, model, rationale }`. |
| `GET` | `/assertions` | | List all assertions, with a status tally. |
| `GET` | `/assertions/:id` | | Fetch one assertion. |
| `POST` | `/assertions/:id/attest` | ✓ | A named human signs it. Body: `{ by, role, basis, verified, ttlDays }`. 400 without `by` and `basis`. |
| `POST` | `/assertions/:id/reverify` | ✓ | Same operation as attest — resets the decay clock, keeps the prior record in `attestation.supersedes`. |
| `POST` | `/assertions/:id/reject` | ✓ | A named human turns it down. Body: `{ by, role, reason, reviewed }`. Stays in the dataset, doesn't decay. |
| `GET` | `/health` | | Liveness check. |

## Example

```bash
curl -X POST localhost:3000/assertions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"payload":{"hpf":"IN","lf":-5},"model":"Claude","rationale":"bright-instrument pattern"}'
# -> { "id": "...", "status": "proposed", ... }

curl -X POST localhost:3000/assertions/<id>/attest \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"by":"David Petry","role":"FOH engineer","basis":"Verified at the console","verified":"2026-08-27"}'
# -> { "status": "attested", "daysRemaining": 730, ... }
```

## Storage

`DATABASE_URL` set → Postgres (`src/stores/postgresStore.js`), records
persist across restarts and deploys, schema created automatically on first
connection. Unset → an in-memory `Map` (`src/stores/memoryStore.js`), fine
for local dev, gone on restart. Both implement the same four-method
interface (`insert`/`get`/`replace`/`list`), selected in `src/store.js` and
injected into `createApp({ store })` — swapping backends again means adding
a new file in `src/stores/`, not touching the route layer.

## Where it came from

`attestation-ledger` was extracted from the
[Live Sound EQ SOP](https://github.com/davidpetry-cloud/live-sound-eq-sop) and
is reused unchanged by the [DJ Mixing SOP](https://github.com/davidpetry-cloud/dj-mixing-sop).
This API wraps the same engine so the same enforcement — model proposes, named
human attests, unattested values decay — is reachable over HTTP by any client,
not just JavaScript.

## License

MIT
