// End-to-end checks of sign-in and the data API against a real Postgres.
//
//   DATABASE_URL=postgres://gpc:…@localhost:5432/gpc_test npm test
//
// DATABASE_URL must point at a scratch database owned by the role it connects
// as, with gpc_app created and granted to that role (see
// docs/deployment-vps.md). The test migrates it, wipes its data and seeds
// its own users. Never point it at a real database.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { migrate } from '../src/migrate.js'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL is required')

const here = dirname(fileURLToPath(import.meta.url))
const PORT = 3900 + Math.floor(Math.random() * 90)
const BASE = `http://127.0.0.1:${PORT}`
const ORIGIN = 'http://localhost:5173'
const PASSWORD = 'correct horse battery'

const db = new pg.Pool({ connectionString: DATABASE_URL })
let server: ChildProcess
let serverLog = ''
const ids: Record<string, string> = {}

async function seed() {
  await db.query(`truncate auth.users, auth.sessions, auth.email_tokens, public.organisations,
    public.profiles, public.patient_drafts, public.training_content, public.training_notes,
    public.user_tour_progress, public.user_hint_dismissals, public.platform_admins cascade`)
  const hash = await bcrypt.hash(PASSWORD, 4)
  const { rows: [orgA] } = await db.query("insert into public.organisations (name) values ('Practice A') returning id")
  const { rows: [orgB] } = await db.query("insert into public.organisations (name) values ('Practice B') returning id")
  ids.orgA = orgA.id
  for (const [name, org, role] of [['alice', orgA.id, 'admin'], ['bob', orgA.id, 'staff'], ['carol', orgB.id, 'admin']]) {
    const { rows: [u] } = await db.query(
      "insert into auth.users (email, password_hash, email_confirmed_at) values ($1, $2, now()) returning id",
      [`${name}@gpc-demo.local`, hash])
    await db.query('insert into public.profiles (id, username, org_id, role) values ($1, $2, $3, $4)', [u.id, name, org, role])
    ids[name] = u.id
  }
  await db.query('insert into public.platform_admins (user_id) values ($1)', [ids.alice])
}

/** A tiny cookie-keeping client. */
class Client {
  cookie = ''
  async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { Origin: ORIGIN } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const set = res.headers.getSetCookie()
    for (const c of set) {
      const [pair] = c.split(';')
      this.cookie = pair.endsWith('=') ? '' : pair
    }
    const text = await res.text()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test responses are checked field by field
    let json: any
    try { json = text ? JSON.parse(text) : null } catch { json = text }
    return { status: res.status, json, headers: res.headers }
  }
  async login(identifier: string, password = PASSWORD) {
    return this.call('POST', '/api/auth/login', { identifier, password })
  }
}

async function signedIn(name: string) {
  const c = new Client()
  const r = await c.login(name)
  assert.equal(r.status, 200, `login ${name}: ${JSON.stringify(r.json)}`)
  return c
}

before(async () => {
  await migrate(DATABASE_URL)
  await seed()
  server = spawn(process.execPath, ['--import', 'tsx', resolve(here, '../src/index.ts')], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      PUBLIC_URL: ORIGIN,
      CORS_ORIGINS: '',
      NHS_CLIENT_ID: 'test',
      NHS_CLIENT_SECRET: 'test',
      SMTP_HOST: '',
      LOGIN_RATE_MAX: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout!.on('data', d => { serverLog += d })
  server.stderr!.on('data', d => { serverLog += d })
  for (let i = 0; i < 100; i++) {
    if (serverLog.includes('listening')) return
    if (server.exitCode !== null) break
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error(`server did not start:\n${serverLog}`)
})

after(async () => {
  server?.kill()
  if (server) await once(server, 'exit')
  await db.end()
})

test('health reports ok and the commit', async () => {
  const r = await new Client().call('GET', '/api/health')
  assert.equal(r.status, 200)
  assert.equal(r.json.status, 'ok')
  assert.ok(r.json.commit)
})

test('login: wrong password and unknown user get the same 401', async () => {
  const a = await new Client().login('alice', 'wrong password!')
  const b = await new Client().login('nobody', 'wrong password!')
  assert.equal(a.status, 401)
  assert.equal(b.status, 401)
  assert.deepEqual(a.json, b.json)
})

test('login by username and by email; cookie is HttpOnly', async () => {
  const c = new Client()
  const r = await c.call('POST', '/api/auth/login', { identifier: 'Alice', password: PASSWORD })
  assert.equal(r.status, 200)
  assert.equal(r.json.profile.username, 'alice')
  assert.equal(r.json.organisation.name, 'Practice A')
  assert.equal(r.json.isPlatformAdmin, true)
  assert.match(r.headers.get('set-cookie') ?? '', /HttpOnly; SameSite=Lax/)
  const byEmail = await new Client().login('bob@gpc-demo.local')
  assert.equal(byEmail.status, 200)
  assert.equal(byEmail.json.isPlatformAdmin, false)
})

test('signed-out requests are refused', async () => {
  const c = new Client()
  assert.equal((await c.call('GET', '/api/auth/me')).status, 401)
  assert.equal((await c.call('GET', '/api/drafts')).status, 401)
  assert.equal((await c.call('GET', '/api/snomed/search?q=asthma')).status, 401)
  assert.equal((await c.call('GET', '/api/dmd/search?q=aspirin')).status, 401)
  assert.equal((await c.call('GET', '/api/nope')).status, 401)
})

test('cross-site writes are refused', async () => {
  const c = await signedIn('alice')
  const r = await c.call('POST', '/api/drafts', { draft_data: {} }, { Origin: 'https://evil.example' })
  assert.equal(r.status, 403)
})

test('drafts are shared within an organisation only', async () => {
  const alice = await signedIn('alice')
  const bob = await signedIn('bob')
  const carol = await signedIn('carol')
  const created = await alice.call('POST', '/api/drafts', {
    name: 'Test patient', patient_name: 'Mr Test', nhs_number: '9990000018', draft_data: { patient: { familyName: 'Test' } },
  })
  assert.equal(created.status, 200)
  assert.equal(created.json.version, 1)
  const id = created.json.id

  const bobList = await bob.call('GET', '/api/drafts')
  assert.equal(bobList.json.length, 1)
  assert.equal(bobList.json[0].profiles.username, 'alice')

  assert.equal((await carol.call('GET', '/api/drafts')).json.length, 0)
  assert.equal((await carol.call('GET', `/api/drafts/${id}`)).status, 404)
  assert.equal((await carol.call('PUT', `/api/drafts/${id}`, { expectedVersion: 1, draft_data: {} })).status, 404)
  assert.equal((await carol.call('DELETE', `/api/drafts/${id}`)).status, 404)

  const loaded = await bob.call('GET', `/api/drafts/${id}`)
  assert.deepEqual(loaded.json, { draft_data: { patient: { familyName: 'Test' } }, version: 1 })
})

test('a save based on an old version gets 409 and changes nothing', async () => {
  const alice = await signedIn('alice')
  const bob = await signedIn('bob')
  const { json: { id } } = await alice.call('POST', '/api/drafts', { draft_data: { v: 1 } })
  const first = await bob.call('PUT', `/api/drafts/${id}`, { expectedVersion: 1, draft_data: { v: 'bob' } })
  assert.equal(first.status, 200)
  assert.equal(first.json.version, 2)
  const stale = await alice.call('PUT', `/api/drafts/${id}`, { expectedVersion: 1, draft_data: { v: 'alice' } })
  assert.equal(stale.status, 409)
  assert.equal(stale.json.currentVersion, 2)
  assert.deepEqual((await alice.call('GET', `/api/drafts/${id}`)).json.draft_data, { v: 'bob' })
})

test('updates cannot move a draft to another organisation or author', async () => {
  const alice = await signedIn('alice')
  const { json: { id } } = await alice.call('POST', '/api/drafts', { draft_data: {} })
  // Even as gpc_app with SQL access, the trigger pins ownership columns.
  const client = await db.connect()
  try {
    await client.query('begin')
    await client.query('set local role gpc_app')
    await client.query("select set_config('app.user_id', $1, true)", [ids.alice])
    await client.query("update public.patient_drafts set created_by = $2 where id = $1", [id, ids.bob])
    const { rows } = await client.query('select created_by, org_id from public.patient_drafts where id = $1', [id])
    assert.equal(rows[0].created_by, ids.alice)
    assert.equal(rows[0].org_id, ids.orgA)
    await client.query('rollback')
  } finally {
    client.release()
  }
})

test('profile edits are limited to the allowed fields', async () => {
  const bob = await signedIn('bob')
  const r = await bob.call('PATCH', '/api/me', { display_name: 'Bob B', role: 'admin', date_of_birth: '1980-02-03' })
  assert.equal(r.status, 200)
  assert.equal(r.json.display_name, 'Bob B')
  assert.equal(r.json.role, 'staff')
  assert.equal(r.json.date_of_birth, '1980-02-03')
  assert.equal((await bob.call('PATCH', '/api/me', { date_of_birth: 'yesterday' })).status, 400)
})

test('the role and organisation of a profile cannot be changed even with direct SQL', async () => {
  const client = await db.connect()
  try {
    await client.query('begin')
    await client.query('set local role gpc_app')
    await client.query("select set_config('app.user_id', $1, true)", [ids.bob])
    await assert.rejects(client.query("update public.profiles set role = 'admin' where id = $1", [ids.bob]), /row-level security/)
    await client.query('rollback')
  } finally {
    client.release()
  }
})

test('only organisation admins rename the organisation', async () => {
  const bob = await signedIn('bob')
  assert.equal((await bob.call('PATCH', '/api/org', { name: 'Hijacked' })).status, 403)
  const alice = await signedIn('alice')
  const r = await alice.call('PATCH', '/api/org', { name: 'Practice A (renamed)' })
  assert.equal(r.status, 200)
  assert.equal(r.json.name, 'Practice A (renamed)')
})

test('only platform admins edit training content; everyone reads it', async () => {
  const bob = await signedIn('bob')
  assert.equal((await bob.call('PUT', '/api/training-content/intro', { content: 'x' })).status, 403)
  const alice = await signedIn('alice')
  const first = await alice.call('PUT', '/api/training-content/intro', { content: '# Hello' })
  assert.equal(first.status, 200)
  assert.equal(first.json.version, 1)
  assert.equal((await alice.call('PUT', '/api/training-content/intro', { content: '# Hello again' })).json.version, 2)
  const carol = await signedIn('carol')
  const list = await carol.call('GET', '/api/training-content')
  assert.equal(list.json.length, 1)
  assert.equal((await bob.call('DELETE', '/api/training-content/intro')).status, 404)
  assert.equal((await alice.call('DELETE', '/api/training-content/intro')).status, 204)
})

test('training notes: org-scoped, author or admin may change them', async () => {
  const alice = await signedIn('alice')
  const bob = await signedIn('bob')
  const carol = await signedIn('carol')
  const { json: { id } } = await bob.call('POST', '/api/training-notes', { page_id: 'intro', body: 'Bob note' })
  assert.equal((await alice.call('GET', '/api/training-notes')).json.length, 1)
  assert.equal((await carol.call('GET', '/api/training-notes')).json.length, 0)
  assert.equal((await carol.call('PATCH', `/api/training-notes/${id}`, { body: 'x' })).status, 404)
  assert.equal((await alice.call('PATCH', `/api/training-notes/${id}`, { body: 'Edited by admin' })).status, 204)
  const { json: [note] } = await bob.call('GET', '/api/training-notes')
  assert.equal(note.body, 'Edited by admin')
  assert.equal(note.profiles.username, 'bob')
  assert.equal((await bob.call('DELETE', `/api/training-notes/${id}`)).status, 204)
})

test('onboarding progress is per user', async () => {
  const bob = await signedIn('bob')
  assert.equal((await bob.call('PUT', '/api/me/tours/viewer')).status, 204)
  assert.equal((await bob.call('PUT', '/api/me/tours/viewer')).status, 204)
  assert.equal((await bob.call('PUT', '/api/me/hints/builder.delete-warning')).status, 204)
  assert.deepEqual((await bob.call('GET', '/api/me/onboarding')).json, { tours: ['viewer'], hints: ['builder.delete-warning'] })
  const alice = await signedIn('alice')
  assert.deepEqual((await alice.call('GET', '/api/me/onboarding')).json, { tours: [], hints: [] })
  await bob.call('DELETE', '/api/me/tours/viewer')
  await bob.call('DELETE', '/api/me/hints')
  assert.deepEqual((await bob.call('GET', '/api/me/onboarding')).json, { tours: [], hints: [] })
})

test('logout ends the session', async () => {
  const c = await signedIn('bob')
  const cookie = c.cookie
  assert.equal((await c.call('POST', '/api/auth/logout')).status, 204)
  const replay = new Client()
  replay.cookie = cookie
  assert.equal((await replay.call('GET', '/api/auth/me')).status, 401)
})

test('changing the password signs out other sessions', async () => {
  const phone = await signedIn('carol')
  const laptop = await signedIn('carol')
  assert.equal((await laptop.call('POST', '/api/auth/password', { password: 'short' })).status, 400)
  assert.equal((await laptop.call('POST', '/api/auth/password', { password: 'a new long password' })).status, 204)
  assert.equal((await laptop.call('GET', '/api/auth/me')).status, 200)
  assert.equal((await phone.call('GET', '/api/auth/me')).status, 401)
  assert.equal((await new Client().login('carol')).status, 401)
  assert.equal((await new Client().login('carol', 'a new long password')).status, 200)
})

test('signup: confirmation required, then a new org with a staff profile', async () => {
  const c = new Client()
  const r = await c.call('POST', '/api/auth/signup', {
    email: 'New.User@example.com', password: 'a long enough password', displayName: 'New User', orgName: 'New Practice',
  })
  assert.equal(r.status, 202)
  assert.equal((await new Client().login('new.user@example.com', 'a long enough password')).status, 403)

  // Same response for an address that's already registered.
  const again = await c.call('POST', '/api/auth/signup', { email: 'alice@example.com', password: 'whatever whatever' })
  assert.equal(again.status, 202)

  const link = serverLog.match(/confirmation link for new\.user@example\.com: (\S+)/)?.[1]
  assert.ok(link, 'confirmation link logged in dev')
  const token = new URL(link).searchParams.get('token')
  const confirm = await c.call('GET', `/api/auth/confirm?token=${token}`)
  assert.equal(confirm.status, 303)
  assert.equal(confirm.headers.get('location'), '/?confirmed=1')
  assert.equal((await c.call('GET', `/api/auth/confirm?token=${token}`)).headers.get('location'), '/?confirmed=expired')

  const me = await new Client().login('new.user@example.com', 'a long enough password')
  assert.equal(me.status, 200)
  assert.equal(me.json.profile.role, 'staff')
  assert.equal(me.json.profile.display_name, 'New User')
  assert.equal(me.json.organisation.name, 'New Practice')
})

test('unknown API paths are a JSON 404 once signed in', async () => {
  const c = await signedIn('alice')
  const r = await c.call('GET', '/api/nope')
  assert.equal(r.status, 404)
  assert.deepEqual(r.json, { error: 'Not found' })
})
