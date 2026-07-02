// Repairs the DrDamo auth user if the profile exists but the auth user was deleted.
// Run with: node scripts/repair-auth-user.mjs

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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars.')
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
  } else {
    console.log('Auth user and profile ids match. Login should work.')
    console.log('Credentials: DrDamo / CopyCat-33')
  }
  process.exit(0)
}

console.log('Auth user missing — recreating with same id as profile...')
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  id: profile.id,
  email: 'drdamo@gpc-demo.local',
  password: 'CopyCat-33',
  email_confirm: true,
  user_metadata: { username: 'DrDamo' },
})
if (createErr) { console.error('Failed to recreate auth user:', createErr.message); process.exit(1) }

console.log('Recreated auth user:', created.user.id)
console.log('Sign in with: DrDamo / CopyCat-33')
