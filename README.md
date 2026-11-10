# GP Connect Demonstrator

A browser tool for viewing, validating and building GP Connect Access Record: Structured bundles (FHIR STU3).

- **Viewer**: load a bundle as JSON or XML from a file, by pasting it, or from the bundled examples. It is shown as a clinical record (medications, allergies, problems, consultations, investigations, immunisations, referrals, documents and more), with an Inspector that links each item back to its source FHIR.
- **Validation**: checks GP Connect structural rules and verifies SNOMED CT and dm+d codes against the NHS England Terminology Server. Bundles with unrecognised codes can be transfer-degraded.
- **Record builder**: build a synthetic patient record through forms and export it as a GP Connect bundle. Use test data only: 999-range NHS numbers or NHS England test patients.
- **Tools**: a SNOMED CT code checker for pasted or imported code lists.

Everything is FHIR **STU3** with GP Connect / CareConnect profiles, not R4 or UK Core.

## Layout

| Path | What it is |
| --- | --- |
| `src/fhir/` | Parsing (JSON and FHIR XML), the per-domain extractors, validation and the terminology checks |
| `src/components/` | Viewer UI |
| `src/builder/` | Record builder: forms, draft reducer (`hooks/draft/`) and bundle generation |
| `src/lib/` | Shared browser helpers (terminology config and auth headers, downloads, local data) |
| `server/` | Express proxy for the NHS England Terminology Server, which holds the system-to-system credentials |
| `api/`, `supabase/` | Current hosted deployment (serverless functions, database migrations); being replaced |

## Running locally

Requirements: Node 22 or later, and NHS England Terminology Server system-to-system credentials for the terminology features.

```sh
npm install
npm run server:install

cp server/.env.example server/.env    # add NHS_CLIENT_ID / NHS_CLIENT_SECRET
cp .env.example .env.local            # frontend settings

npm run server    # terminology proxy on http://127.0.0.1:3001
npm run dev       # app on http://localhost:5173 (proxies /api to :3001)
```

Without terminology credentials the viewer and builder still work. Code verification reports that the server is unavailable.

## Terminology proxy (`server/`)

The browser never sees the NHS credentials. Every call goes through the proxy, which:

- listens on `127.0.0.1` by default (`HOST`). Put a reverse proxy in front of it rather than exposing it directly.
- allows cross-origin calls only from `CORS_ORIGINS`.
- rate-limits each client IP (`RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS`). Set `TRUST_PROXY` when it sits behind a reverse proxy.
- bounds every input (code-list size, query length, SCTID format) and returns generic errors. Upstream detail goes to the server log only.

**It has no user authentication of its own yet.** Before exposing it beyond localhost, put it behind the app's sign-in. See `server/.env.example` for all settings.

## Checks

```sh
npm run lint                       # ESLint (0 errors expected)
npm run build                      # type-check and production build
(cd server && npx tsc --noEmit)    # proxy type-check
```
