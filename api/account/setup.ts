import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body as { token?: string }
  const setupToken = process.env.SETUP_TOKEN
  if (!setupToken || token !== setupToken) {
    return res.status(401).json({ error: 'Invalid setup token' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' })
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
    password: 'CopyCat-33',
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
