---
name: run-gp-connect-demo
description: run, start, build, screenshot, test, launch, drive the GP Connect Demonstrator web app. Use when asked to run the app, take a screenshot, check a domain view, check profile validation, or validate UI changes.
---

GP Connect Demonstrator is a React + Vite + TypeScript frontend (`src/`) with an Express + Postgres backend (`server/`) for sign-in and shared data. **Everything except the landing page needs a signed-in user**, so a UI check needs four parts running: Postgres, the backend, Vite, and headless Chromium driven over the Chrome DevTools Protocol (CDP) by `drive.cjs` in this folder.

Use the session scratchpad for anything temporary (logs, `ws`, screenshots). Below, `$S` stands for it.

## Prerequisites

- Node 24, npm, Docker (for Postgres, and the optional profile validator), Chromium (`/snap/bin/chromium`).
- Dependencies: `npm install` in the repo root and in `server/`.
- The CDP driver needs `ws` from a scratch folder, not the project: `mkdir -p $S/cdp && cd $S/cdp && npm init -y >/dev/null && npm i ws@8.18.0`.

## Tests and build (no browser needed)

```bash
cd /home/drdamo/GP-Connect-Demo
npm test                 # Vitest: src/**/*.test.ts (FHIR parsing layer)
npm run lint             # 0 errors expected; ~14 existing set-state-in-effect warnings
npm run build            # tsc -b + Vite build
cd server && npm run build && DATABASE_URL=postgres://gpc:gpc@127.0.0.1:15499/gpc npm test   # needs the Postgres below
```

`server/test/api.test.ts` wipes and seeds the database it is given. Only point it at the throwaway container below.

## Run the app (agent path)

### 1. Postgres 18 (throwaway container)

```bash
docker rm -f gpc-pg-dev 2>/dev/null
docker run -d --name gpc-pg-dev -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:15499:5432 postgres:18-alpine
until docker exec gpc-pg-dev pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done; sleep 2
docker exec gpc-pg-dev psql -U postgres -q -c "CREATE ROLE gpc LOGIN PASSWORD 'gpc'" -c "CREATE ROLE gpc_app NOLOGIN" -c "GRANT gpc_app TO gpc"
docker exec gpc-pg-dev psql -U postgres -q -c "CREATE DATABASE gpc OWNER gpc"
```

### 2. Backend on port 3001 (Vite proxies `/api` there)

```bash
cd /home/drdamo/GP-Connect-Demo/server
export DATABASE_URL=postgres://gpc:gpc@127.0.0.1:15499/gpc
node --import tsx src/migrate.ts          # "Applied migrations: 001_schema.sql" (the dev server doesn't migrate)
NEW_USER_PASSWORD='correct horse battery' node --import tsx src/createUser.ts --username dev --org "Dev Practice"
(PORT=3001 HOST=127.0.0.1 PUBLIC_URL=http://localhost:5173 NHS_CLIENT_ID=x NHS_CLIENT_SECRET=x \
  nohup node --import tsx src/index.ts > $S/server.log 2>&1 &)
sleep 4; curl -s http://127.0.0.1:3001/api/health    # {"status":"ok",...}
```

- Only the container runs migrations on start (`node dist/migrate.js && node dist/index.js`). In dev, run `src/migrate.ts` yourself, before `createUser` and again after pulling a new migration. `createUser` resets the password if the user already exists.
- To use the real SNOMED/dm+d proxy, put real `NHS_CLIENT_ID`/`NHS_CLIENT_SECRET` in `server/.env` instead of the dummies. With dummies, the Validation tab shows an expected info line: "Could not verify SNOMED CT codes — terminology server unavailable (… HTTP 502)".
- For profile validation, also set `VALIDATOR_URL=http://127.0.0.1:18090` (see step 6).

### 3. Vite on port 5173

```bash
cd /home/drdamo/GP-Connect-Demo
(nohup npx vite --port 5173 --strictPort > $S/vite.log 2>&1 &)
sleep 4; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/    # 200
```

The base path is `/` (`VITE_BASE_URL` only changes it for GitHub Pages builds).

### 4. Sign in: get a session cookie

The browser is signed in by planting the session cookie, which avoids scripting the login form:

```bash
curl -s -c $S/jar.txt -X POST http://127.0.0.1:3001/api/auth/login \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:5173' \
  -d '{"identifier":"dev","password":"correct horse battery"}' >/dev/null
export GPC_COOKIE=$(awk '$6=="gpc_session"{print $7}' $S/jar.txt)
```

The `Origin` header is required: the server refuses writes from other origins.

### 5. Drive and screenshot

```bash
cd $S/cdp
GPC_OUT=$S/ss GPC_TAB="Clinical View" GPC_DOMAINS="Allergies,Immunisations" \
  node /home/drdamo/GP-Connect-Demo/.claude/skills/run-gp-connect-demo/drive.cjs
```

The driver opens the app, checks it is signed in, loads `public/gpc-sample-bundle.json` through the file picker (or `GPC_BUNDLE`), opens `GPC_TAB`, clicks each `GPC_DOMAINS` area, and saves PNGs to `GPC_OUT`. Look at them with the Read tool. All its options are listed at the top of `drive.cjs`.

- Top tabs: `Inspector`, `Clinical View`, `Raw Source`, `Validation`, `Training`, `App Guide`.
- Clinical areas (left nav, with counts): Problems, Consultations, Medications, Allergies, Immunisations, Coded Data, Investigations, Documents, Diary Entries, Referrals, Supporting Resources, Lists.
- For a different flow, copy `drive.cjs` to the scratchpad and edit it. Keep its `click()` (matches button/link text with `startsWith`), `waitFor()` and `shot()` helpers.

### 6. Optional: GP Connect profile validation

```bash
cd /home/drdamo/GP-Connect-Demo
docker build -t gpc-validator validator            # first build ~3 min; bakes in the STU3 packages
docker run -d --name gpc-val-dev -p 127.0.0.1:18090:8080 -m 3g gpc-validator
until docker logs gpc-val-dev 2>&1 | grep -q "HTTP Service started"; do sleep 2; done   # ~30 s
```

Restart the backend with `VALIDATOR_URL=http://127.0.0.1:18090`, then run the driver with `GPC_PROFILE=1`. One validation of the sample record takes about 30 s and peaks near 2 GB in the container. The driver waits for the **Validate again** button. The section is hidden when `VALIDATOR_URL` is unset.

### 7. Stop everything

```bash
for p in 3001 5173; do pid=$(ss -ltnp | awk -v p=":$p " '$0 ~ p {match($0,/pid=[0-9]+/); print substr($0,RSTART+4,RLENGTH-4)}'); [ -n "$pid" ] && kill $pid; done
docker rm -f gpc-pg-dev gpc-val-dev 2>/dev/null
```

## Run (human path)

Run `npm run dev` in the repo root and `npm run dev` in `server/`, with `server/.env` copied from `server/.env.example`. Then open http://localhost:5173/ and sign in with a user made by `createUser` (step 2).

## Gotchas

- **Never `pkill -f "src/index.ts"`** (or any pattern that appears in your own command line): it matches and kills the shell running it. Kill by port, as in step 7.
- **Signed out, there is only the landing page.** No file picker and no tabs. If the driver saves `00-not-signed-in.png`, the cookie is missing or expired, the host differs (cookie set for `localhost` but app opened on `127.0.0.1`), or the backend is down.
- **New users get onboarding tours** ("Step 1 of 5") that cover the page: one on first load and one per tab or area. Skipping a tour can also switch tabs. `shot()` in the driver skips any open tour first, and the driver re-selects the tab after skipping. Do the same in custom flows. Skips are saved per user on the server, so a reused user sees fewer tours.
- **There is no "Load sample" button.** Bundles load only through the file picker, which the driver fills with `DOM.setFileInputFiles`.
- **Wait for state, not for text that already exists.** For example "Could not…" is already on the Validation tab from the SNOMED info line. Wait for a specific button or label instead.
- **A closed browser tab doesn't leave profile validation busy.** The server cancels the run when the client disconnects. A second request during a run gets "Another record is being validated".
- **Old Chromium on the debugging port.** If `/json` hangs, pick another `GPC_CDP_PORT`. The driver uses a fresh profile directory each run, so stale snap profiles don't interfere.
- **WSL can't reach the VPS tailnet.** VPS commands (`ssh vps …`) must run from PowerShell.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module 'ws'` | Run the driver from `$S/cdp` after `npm i ws@8.18.0` there (it resolves `ws` from the current folder) |
| `relation "auth.users" does not exist` | Migrations haven't run: `node --import tsx src/migrate.ts` in `server/` |
| `/api/health` refused | Backend not running or crashed: check `$S/server.log` (a missing `DATABASE_URL`/`NHS_CLIENT_ID` stops it at startup) |
| Login returns "Invalid email/username or password." | Re-run `createUser` with `NEW_USER_PASSWORD` (its random password is printed only once otherwise) |
| Port 5173 in use | Kill it by port (step 7) or use `--port 5174` and set `GPC_BASE` and `PUBLIC_URL` to match |
| Profile validation says "not set up" / no button | Backend started without `VALIDATOR_URL`, or the validator container isn't up yet |
