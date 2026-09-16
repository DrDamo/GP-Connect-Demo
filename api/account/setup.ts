import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  // Compare a fixed-length digest first so a length mismatch never lets
  // partial timing information about the real token leak.
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body as { token?: string }
  const setupToken = process.env.SETUP_TOKEN
  if (!setupToken || typeof token !== 'string' || !safeEqual(token, setupToken)) {
    return res.status(401).json({ error: 'Invalid setup token' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminPassword = process.env.SETUP_ADMIN_PASSWORD
  if (!supabaseUrl || !serviceRoleKey || !adminPassword) {
    return res.status(500).json({
      error: 'VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SETUP_ADMIN_PASSWORD not set',
    })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Idempotency check
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('username', 'DrDamo')
    .maybeSingle()

  if (existing) {
    return res.status(409).json({ error: 'Already set up — user DrDamo already exists.' })
  }

  // Create organisation
  const { data: org, error: orgError } = await admin
    .from('organisations')
    .insert({ name: 'GP Connect Demo' })
    .select()
    .single()

  if (orgError || !org) {
    return res.status(500).json({ error: `Failed to create organisation: ${orgError?.message}` })
  }

  // Create auth user (email_confirm: true skips confirmation email)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: 'drdamo@gpc-demo.local',
    password: adminPassword,
    email_confirm: true,
    user_metadata: { username: 'DrDamo' },
  })

  if (authError || !authData.user) {
    return res.status(500).json({ error: `Failed to create user: ${authError?.message}` })
  }

  // Create profile
  const { error: profileError } = await admin.from('profiles').insert({
    id: authData.user.id,
    username: 'DrDamo',
    display_name: 'Dr Damo',
    org_id: org.id,
    role: 'admin',
  })

  if (profileError) {
    return res.status(500).json({ error: `Failed to create profile: ${profileError.message}` })
  }

  return res.status(200).json({
    success: true,
    message: 'Setup complete. User DrDamo created in organisation "GP Connect Demo".',
    org_id: org.id,
  })
}
