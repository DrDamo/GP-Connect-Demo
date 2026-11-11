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

2. **`.env`.** Add the NHS England Terminology Server credentials. Use the rotated pair; the old one is still in Vercel.
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

## Moving the data from Supabase (one-off)

The migrations create the schema, so only **data** comes across. A full dump would bring Supabase's own schemas and roles with it.

**The export files contain password hashes and personal details.** Keep them off shared drives, and delete them as soon as the import is checked.

There are two ways to export. Use **A** if `pg_dump` works from your PC. Otherwise use **B**, which needs only the Supabase dashboard. Both import the accounts the same way.

### 1A. Export with pg_dump (on the PC, in WSL, with pg_dump 18)

Get the **session pooler** connection string from the Supabase dashboard (Connect → Session pooler):

```bash
SUPA='postgresql://postgres.<ref>:<db-password>@<pooler-host>:5432/postgres'

pg_dump "$SUPA" -Fc --data-only \
  -t public.organisations -t public.profiles -t public.patient_drafts \
  -t public.training_content -t public.training_notes \
  -t public.user_tour_progress -t public.user_hint_dismissals -t public.platform_admins \
  -f gpc-public.dump

psql "$SUPA" -c "\copy (select id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at from auth.users) to 'gpc-auth-users.csv' csv header"
```

Copy both files to the server from PowerShell: `scp gpc-public.dump gpc-auth-users.csv vps:~`.

### 1B. Export from the Supabase dashboard (no pg_dump)

1. **Accounts.** In **SQL Editor**, run the query below. Use **Export → Download CSV** on the result and save it as `gpc-auth-users.csv`:
   ```sql
   select id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at from auth.users;
   ```
2. **App tables.** In **Table Editor** (schema `public`), open each table and use **Export → Export table as CSV**. Save each one as `gpc-<table>.csv`, for example `gpc-organisations.csv`, for these tables: `organisations`, `profiles`, `patient_drafts`, `training_content`, `training_notes`, `user_tour_progress`, `user_hint_dismissals`, `platform_admins`. Leave out empty tables; the import skips missing files.

Copy them to the server from PowerShell, in the download folder: `scp gpc-*.csv vps:~`.

### 2. Import (on the server, `cd /opt/vps`)

The `gpc` container must have started once so the schema exists. Stop it for the import, then copy the exported files into the Postgres container:

```bash
docker compose stop gpc
# Route A:
docker compose cp ~/gpc-public.dump postgres:/tmp/gpc-public.dump
docker compose cp ~/gpc-auth-users.csv postgres:/tmp/gpc-auth-users.csv
# Route B:
for f in ~/gpc-*.csv; do docker compose cp "$f" postgres:/tmp/; done
```

If this is a re-run, for example the final copy after a rehearsal, empty the tables first. **This deletes everything in the app's database.**

```bash
docker compose exec postgres psql -U postgres -d gpc -c "TRUNCATE auth.users, public.organisations CASCADE;"
```

Accounts first. The Supabase bcrypt hashes are used as they are, so everyone keeps their password:

```bash
docker compose exec -T postgres psql -U postgres -d gpc -v ON_ERROR_STOP=1 <<'SQL'
begin;
create temp table su (id uuid, email text, encrypted_password text, email_confirmed_at timestamptz,
                      raw_user_meta_data jsonb, created_at timestamptz);
\copy su from '/tmp/gpc-auth-users.csv' csv header
insert into auth.users (id, email, password_hash, email_confirmed_at, raw_user_meta_data, created_at)
  select id, lower(email), encrypted_password, email_confirmed_at, coalesce(raw_user_meta_data, '{}'), created_at from su;
commit;
SQL
```

Then load everything else in one all-or-nothing transaction. Triggers are switched off while the rows load, so the tables can load in any order and keep their original `updated_at` values.

**Route A** (dump):

```bash
docker compose exec postgres pg_restore -U postgres -d gpc --data-only --no-owner --no-privileges \
  --disable-triggers --single-transaction --exit-on-error /tmp/gpc-public.dump
```

**Route B** (CSVs). Each file's header row gives the column list, so the column order in the export doesn't matter. `session_replication_role = replica` switches off the triggers and the foreign-key checks for the load:

```bash
docker compose exec -T postgres sh -s <<'SH'
set -e
cd /tmp
{
  printf '%s\n' 'begin;' 'set local session_replication_role = replica;'
  for t in organisations profiles patient_drafts training_content training_notes \
           user_tour_progress user_hint_dismissals platform_admins; do
    f="gpc-$t.csv"
    [ -f "$f" ] || continue
    cols=$(head -1 "$f" | tr -d '\r')
    printf '%s\n' "\\copy public.$t ($cols) from '/tmp/$f' csv header"
  done
  printf '%s\n' 'commit;'
} | psql -U postgres -d gpc -v ON_ERROR_STOP=1
SH
```

If a `\copy` fails on an unknown column, the export has a column the new schema doesn't. Remove that column from the CSV, or compare the header with `\d public.<table>`.

### 3. Check, clean up, start

```bash
docker compose exec postgres psql -U postgres -d gpc -c "
  select 'users', count(*) from auth.users union all
  select 'organisations', count(*) from public.organisations union all
  select 'profiles', count(*) from public.profiles union all
  select 'patient_drafts', count(*) from public.patient_drafts union all
  select 'training_content', count(*) from public.training_content union all
  select 'training_notes', count(*) from public.training_notes union all
  select 'platform_admins', count(*) from public.platform_admins;"
docker compose exec postgres sh -c 'rm -f /tmp/gpc-public.dump /tmp/gpc-*.csv'
rm -f ~/gpc-public.dump ~/gpc-*.csv      # and delete the copies on the PC (Downloads folder for route B)
docker compose up -d gpc
```

On 2026-11-10 the counts were 7 users, 9 organisations, 7 profiles, 3 patient drafts, 1 training content row, 0 training notes and 1 platform admin. Two of the organisations have no members. Then sign in with an existing account and open a shared patient.

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
