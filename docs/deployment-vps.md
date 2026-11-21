# Deploying to the VPS

The app runs on the VPS as one container, `gpc`: the built frontend plus the Express backend (sign-in, the data API and the NHS terminology proxy). It sits behind the shared Caddy and uses the shared Postgres 18. It is public at **https://gpc.drdamo.me.uk**.

```
Browser ─HTTPS─> Caddy ─> gpc:3001 (Express: static frontend + /api)
                               └─ internal network ─> postgres:5432 (database gpc)
```

- **Image**: `ghcr.io/drdamo/gp-connect-demo`, built by `.github/workflows/docker-publish.yml` on every push to `main` (tags `latest` and the short SHA). Pull requests build and test it without pushing.
- **Start-up**: the container applies `server/migrations/*.sql` (`node dist/migrate.js`), then starts the server. A failed migration stops the container.
- **Health**: `GET /api/health` returns `{"status":"ok","commit":"<sha>"}`, or 503 when the database is unreachable.
- **Data**: in Postgres only, so the nightly `pg_dumpall` already covers it. The app has no volumes.

## Database roles

The app uses two roles:

| Role | What it is |
| --- | --- |
| `gpc` | Login role that owns the database and its tables and runs the migrations. Table owners bypass row-level security, which the policy helper functions rely on. |
| `gpc_app` | `NOLOGIN`. Each data request runs `SET LOCAL ROLE gpc_app`, so the row-level security policies apply to it. |

`gpc` must be a member of `gpc_app`. The first migration refuses to run if `gpc_app` is missing.

## First-time setup (on the server, `cd /opt/vps`)

1. **Database and roles.** Use a hex password, because other characters break `DATABASE_URL`:
   ```bash
   PW=$(openssl rand -hex 24); echo "GPC_DB_PASSWORD=$PW" >> .env
   docker compose exec postgres psql -U postgres -c "CREATE ROLE gpc LOGIN PASSWORD '$PW';"
   docker compose exec postgres psql -U postgres -c "CREATE ROLE gpc_app NOLOGIN;"
   docker compose exec postgres psql -U postgres -c "GRANT gpc_app TO gpc;"
   docker compose exec postgres psql -U postgres -c "CREATE DATABASE gpc OWNER gpc;"
   ```
   The `citext` extension is created by the migration; it's a trusted extension, so the database owner can create it.

2. **`.env`.** Add the NHS England Terminology Server system-to-system credentials. They belong only in this file.
   ```
   GPC_NHS_CLIENT_ID=...
   GPC_NHS_CLIENT_SECRET=...
   ```
   The SMTP settings already in `.env` are reused. Map them in the compose service below.

3. **Compose service** (under `services:`):
   ```yaml
     gpc:
       image: ghcr.io/drdamo/gp-connect-demo:latest
       restart: unless-stopped
       mem_limit: 512m
       depends_on: [postgres]
       networks: [web, internal]
       environment:
         DATABASE_URL: postgres://gpc:${GPC_DB_PASSWORD}@postgres:5432/gpc
         PUBLIC_URL: https://gpc.drdamo.me.uk
         NHS_CLIENT_ID: ${GPC_NHS_CLIENT_ID}
         NHS_CLIENT_SECRET: ${GPC_NHS_CLIENT_SECRET}
         # Map these to the SMTP variable names already in .env:
         SMTP_HOST: ${SMTP_HOST}
         SMTP_PORT: ${SMTP_PORT}
         SMTP_USER: ${SMTP_USER}
         SMTP_PASSWORD: ${SMTP_PASSWORD}
         SMTP_FROM: ${SMTP_FROM}
   ```
   `HOST=0.0.0.0`, `PORT=3001`, `TRUST_PROXY=1` and `NODE_ENV=production` are already set in the image. Check the file with `docker compose config -q` and look for any `variable is not set` warning.

4. **Caddy** (public site):
   ```
   gpc.{$DOMAIN} {
     import security_headers
     encode zstd gzip
     reverse_proxy gpc:3001
   }
   ```
   If the `security_headers` snippet sets a Content-Security-Policy, the app needs `default-src 'self'`, `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`, `font-src https://fonts.gstatic.com` and `img-src 'self' data:`. Google Fonts is its only outside resource. Then run `docker compose restart caddy`.

5. **DNS** (Cloudflare, grey cloud): an A record `gpc` → `129.121.95.140`. Confirm it with `dig +short gpc.drdamo.me.uk @1.1.1.1` before restarting Caddy.

6. **Start and check:**
   ```bash
   docker compose pull gpc && docker compose up -d gpc
   docker compose logs -f gpc          # expect "Applied migrations: 001_schema.sql", then "listening"
   curl -s https://gpc.drdamo.me.uk/api/health
   ```
   Add two Uptime Kuma monitors: `https://gpc.drdamo.me.uk/api/health` and `http://gpc:3001/api/health`.

7. **First admin account** (only for a fresh start without imported data):
   ```bash
   docker compose exec gpc node dist/createUser.js --username damo --org "Demo Practice" --role admin --platform-admin
   ```
   It prints a generated password once. Running it again for an existing username resets that account's password and signs out its sessions.

## Updating

Push to `main`, wait for the workflow to go green, then:

```bash
docker compose pull gpc && docker compose up -d gpc
```

To roll back, set `image: ghcr.io/drdamo/gp-connect-demo:<short-sha>` and run `docker compose up -d gpc`. Migrations only go forward, so rolling back past a schema change needs a matching restore.

## History

Until November 2026 the app ran on Vercel (frontend and `api/` functions) with Supabase for sign-in and the database. On 2026-11-10 its data moved to the VPS as data-only: the public tables plus the `auth.users` accounts, whose bcrypt hashes import unchanged, so everyone kept their password. The export and import steps, and the old Vercel and Supabase code, are in the git history before the commit that removed them.

## Local development

```bash
# Postgres 18 locally (Docker shown; any Postgres 18 works). Run each psql -c
# separately: CREATE DATABASE cannot run inside a transaction.
docker run -d --name gpc-pg -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:5432:5432 postgres:18-alpine
psql -h localhost -U postgres -c "CREATE ROLE gpc LOGIN PASSWORD 'gpc'"
psql -h localhost -U postgres -c "CREATE ROLE gpc_app NOLOGIN"
psql -h localhost -U postgres -c "GRANT gpc_app TO gpc"
psql -h localhost -U postgres -c "CREATE DATABASE gpc OWNER gpc"

cp server/.env.example server/.env    # set DATABASE_URL and the NHS credentials
npm run server:install
(cd server && npx tsx src/migrate.ts && NEW_USER_PASSWORD='choose one' npx tsx src/createUser.ts --username dev --org Dev --role admin --platform-admin)
npm run server   # :3001
npm run dev      # :5173, proxies /api to :3001
```

Without SMTP settings, development builds print signup confirmation links to the server log. The backend tests need a scratch database; they wipe its data:

```bash
psql -h localhost -U postgres -c "CREATE DATABASE gpc_test OWNER gpc"
cd server && DATABASE_URL=postgres://gpc:gpc@localhost:5432/gpc_test npm test
```
