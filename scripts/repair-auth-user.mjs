// Repairs the DrDamo auth user if the profile exists but the auth user was deleted.
// Run with: SETUP_ADMIN_PASSWORD='a-strong-password' node scripts/repair-auth-user.mjs
//
// Also handy for rotating the DrDamo password on its own: re-run this with a
// new SETUP_ADMIN_PASSWORD and it updates the existing user in place (no
// email delivery needed — the account's `.local` address doesn't have to be
// real for the Admin API to accept a new password for it).

import { readFileSync } from 'fs'
import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.cjs'

function parseEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
    )
  } catch { return {} }
}

const rootEnv   = parseEnvFile(new URL('../.env.local', import.meta.url).pathname)
const serverEnv = parseEnvFile(new URL('../server/.env', import.meta.url).pathname)

const supabaseUrl    = rootEnv.VITE_SUPABASE_URL    ?? serverEnv.VITE_SUPABASE_URL
const serviceRoleKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY ?? rootEnv.SUPABASE_SERVICE_ROLE_KEY
const adminPassword  = process.env.SETUP_ADMIN_PASSWORD ?? rootEnv.SETUP_ADMIN_PASSWORD ?? serverEnv.SETUP_ADMIN_PASSWORD

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars.')
  process.exit(1)
}
if (!adminPassword) {
  console.error('Missing SETUP_ADMIN_PASSWORD. Pass it as an env var, e.g.:')
  console.error("  SETUP_ADMIN_PASSWORD='a-strong-password' node scripts/repair-auth-user.mjs")
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Get profile row
const { data: profile, error: profileErr } = await admin
  .from('profiles')
  .select('id, username, org_id, role')
  .eq('username', 'DrDamo')
  .maybeSingle()

if (profileErr || !profile) {
  console.log('No DrDamo profile found — run setup-user.mjs instead.')
  process.exit(1)
}

console.log('Profile found, id:', profile.id)

// Check if auth user exists
const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
if (listErr) { console.error('Failed to list users:', listErr.message); process.exit(1) }

const existing = users.find(u => u.email === 'drdamo@gpc-demo.local')
if (existing) {
  console.log('Auth user already exists:', existing.id)
  if (existing.id !== profile.id) {
    console.warn('WARNING: auth user id does not match profile id!')
    console.warn('  auth id:', existing.id)
    console.warn('  profile id:', profile.id)
    console.warn('Try: delete the profile row and re-run setup-user.mjs')
    process.exit(1)
  }
  // Auth user and profile already match — just rotate the password in place.
  // This is the supported way to change it: no email is sent or required,
  // so the `.local` address being undeliverable is irrelevant here.
  const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, { password: adminPassword })
  if (updateErr) { console.error('Failed to update password:', updateErr.message); process.exit(1) }
  console.log('Password updated for DrDamo.')
  process.exit(0)
}

console.log('Auth user missing — recreating with same id as profile...')
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  id: profile.id,
  email: 'drdamo@gpc-demo.local',
  password: adminPassword,
  email_confirm: true,
  user_metadata: { username: 'DrDamo' },
})
if (createErr) { console.error('Failed to recreate auth user:', createErr.message); process.exit(1) }

console.log('Recreated auth user:', created.user.id)
console.log('Sign in with username DrDamo and the password you set via SETUP_ADMIN_PASSWORD.')
