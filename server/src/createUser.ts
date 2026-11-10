import { randomBytes } from 'crypto'
import { parseArgs } from 'util'
import { owner, pool } from './db.js'
import { hashPassword } from './users/passwords.js'

// Creates or resets an admin-provisioned account (replaces the old
// scripts/setup-user.mjs and repair-auth-user.mjs). In the container:
//
//   docker compose exec gpc node dist/createUser.js --username alice \
//     --org "Demo Practice" [--role admin] [--display-name "Alice"] [--platform-admin]
//
// The account signs in with the username. A random password is generated and
// printed once; set NEW_USER_PASSWORD to choose one instead. Running it again
// for an existing username resets that account's password.

const { values } = parseArgs({
  options: {
    username: { type: 'string' },
    org: { type: 'string' },
    role: { type: 'string', default: 'staff' },
    'display-name': { type: 'string' },
    'platform-admin': { type: 'boolean', default: false },
  },
})

async function main() {
  const username = values.username?.trim().toLowerCase()
  if (!username || !/^[a-z0-9._-]{2,64}$/.test(username)) {
    throw new Error('--username is required (2-64 of a-z 0-9 . _ -)')
  }
  if (values.role !== 'staff' && values.role !== 'admin') throw new Error('--role must be staff or admin')
  const email = `${username}@gpc-demo.local`
  const generated = !process.env.NEW_USER_PASSWORD
  const password = process.env.NEW_USER_PASSWORD || randomBytes(12).toString('base64url')
  const hash = await hashPassword(password)

  const existed = await owner.transaction(async db => {
    const { rows: [found] } = await db.query<{ id: string }>('select id from auth.users where email = $1', [email])
    if (found) {
      await db.query('update auth.users set password_hash = $2, updated_at = now() where id = $1', [found.id, hash])
      await db.query('delete from auth.sessions where user_id = $1', [found.id])
      return true
    }
    if (!values.org?.trim()) throw new Error('--org is required for a new account')
    const { rows: [user] } = await db.query<{ id: string }>(
      'insert into auth.users (email, password_hash, email_confirmed_at) values ($1, $2, now()) returning id',
      [email, hash])
    let { rows: [org] } = await db.query<{ id: string }>('select id from public.organisations where name = $1 limit 1', [values.org.trim()])
    if (!org) ({ rows: [org] } = await db.query<{ id: string }>('insert into public.organisations (name) values ($1) returning id', [values.org.trim()]))
    await db.query(
      'insert into public.profiles (id, username, display_name, org_id, role) values ($1, $2, $3, $4, $5)',
      [user.id, username, values['display-name'] ?? null, org.id, values.role])
    if (values['platform-admin']) {
      await db.query('insert into public.platform_admins (user_id) values ($1) on conflict do nothing', [user.id])
    }
    return false
  })

  console.log(existed ? `Reset the password for ${username}; their other sessions were signed out.` : `Created ${username}.`)
  if (generated) console.log(`Password (shown once): ${password}`)
}

main()
  .catch(err => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
