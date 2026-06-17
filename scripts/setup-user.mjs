// One-time setup: creates the GP Connect Demo org and DrDamo user in Supabase.
// Run with: node scripts/setup-user.mjs
// Reads VITE_SUPABASE_URL from .env.local and SUPABASE_SERVICE_ROLE_KEY from server/.env

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
  console.error('Missing env vars. Need VITE_SUPABASE_URL in .env.local and SUPABASE_SERVICE_ROLE_KEY in server/.env')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Idempotency check
const { data: existing } = await admin.from('profiles').select('id').eq('username', 'DrDamo').maybeSingle()
if (existing) {
  console.log('Already set up — DrDamo exists. Nothing to do.')
  process.exit(0)
}

// Create org
const { data: org, error: orgError } = await admin
  .from('organisations').insert({ name: 'GP Connect Demo' }).select().single()
if (orgError) { console.error('Failed to create org:', orgError.message); process.exit(1) }
console.log('Created org:', org.id)

// Create auth user
const { data: authData, error: authError } = await admin.auth.admin.createUser({
  email: 'drdamo@gpc-demo.local',
  password: 'CopyCat-33',
  email_confirm: true,
  user_metadata: { username: 'DrDamo' },
})
if (authError) { console.error('Failed to create user:', authError.message); process.exit(1) }
console.log('Created auth user:', authData.user.id)

// Create profile
const { error: profileError } = await admin.from('profiles').insert({
  id: authData.user.id,
  username: 'DrDamo',
  display_name: 'Dr Damo',
  org_id: org.id,
  role: 'admin',
})
if (profileError) { console.error('Failed to create profile:', profileError.message); process.exit(1) }

console.log('Setup complete. Sign in with username DrDamo / CopyCat-33')
