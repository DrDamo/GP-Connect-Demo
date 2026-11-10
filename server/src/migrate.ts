import { readdir, readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config as loadDotenv } from 'dotenv'
import pg from 'pg'

// Applies server/migrations/*.sql in name order, each once, each in its own
// transaction. Run before the server starts (the container does this):
//   node dist/migrate.js
// An advisory lock stops two starting containers migrating at once.

const here = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(here, '../.env') })

const MIGRATIONS_DIR = resolve(here, '../migrations')
const LOCK_ID = 727_001

export async function migrate(databaseUrl: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  const applied: string[] = []
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK_ID])
    await client.query(`create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`)
    const done = new Set((await client.query<{ name: string }>('select name from public.schema_migrations')).rows.map(r => r.name))
    const files = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort()
    for (const file of files) {
      if (done.has(file)) continue
      const sql = await readFile(resolve(MIGRATIONS_DIR, file), 'utf8')
      try {
        await client.query('begin')
        await client.query(sql)
        await client.query('insert into public.schema_migrations (name) values ($1)', [file])
        await client.query('commit')
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
      }
      applied.push(file)
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {})
    await client.end()
  }
  return applied
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }
  migrate(url)
    .then(applied => {
      console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database schema is up to date')
    })
    .catch(err => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
