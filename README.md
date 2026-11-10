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
| `server/` | Express backend: sign-in and sessions, the data API, and the proxy for the NHS England Terminology Server (which holds the system-to-system credentials) |
| `server/migrations/` | Postgres schema, including the row-level security policies |
| `Dockerfile`, `.github/workflows/` | The container image and the CI that tests, builds and publishes it |
| `api/`, `supabase/` | The old Vercel + Supabase deployment, kept until the move to the VPS is complete |

## Running locally

Requirements: Node 22 or later, Postgres 18, and NHS England Terminology Server system-to-system credentials for the terminology features.

Full steps, including creating the database roles and a first account, are in [docs/deployment-vps.md](docs/deployment-vps.md#local-development). In short:

```sh
npm install
npm run server:install
cp server/.env.example server/.env    # DATABASE_URL, NHS_CLIENT_ID / NHS_CLIENT_SECRET

npm run server    # backend on http://127.0.0.1:3001
npm run dev       # app on http://localhost:5173 (proxies /api to :3001)
```

A static build without the backend (`VITE_AUTH=off`) still has the viewer and the builder. It has no sign-in, shared patients or code verification.

## Backend (`server/`)

- **Sign-in**: email (or username) and password. Sessions are HttpOnly cookies, and the database stores only a hash of each session token. Self-service signup creates a new organisation and needs email confirmation.
- **Data**: shared patients, training content and notes, profiles and onboarding progress. Each request runs as the `gpc_app` database role with the user's id set, so Postgres row-level security decides what every user can see and change.
- **Terminology proxy**: signed-in users only. It is rate-limited per IP, bounds every input, and returns generic errors; upstream detail goes to the server log only.
- **Hosting**: listens on `127.0.0.1` by default (`HOST`), and should sit behind a reverse proxy (`TRUST_PROXY=1`). The container serves the built frontend too.

Production runs on a VPS behind Caddy: see [docs/deployment-vps.md](docs/deployment-vps.md). All settings are listed in `server/.env.example`.

## Checks

```sh
npm run lint                       # ESLint (0 errors expected)
npm run build                      # type-check and production build
(cd server && npx tsc --noEmit)    # backend type-check
(cd server && npm test)            # backend tests; needs DATABASE_URL to a scratch database
```
