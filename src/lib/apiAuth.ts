import { supabase } from './supabase'

// Bearer token for the signed-in user's current Supabase session — sent to
// this app's own /api/snomed and /api/dmd proxy endpoints so they can
// require a signed-in user (see api/_lib/requireUser.ts). Returns
// undefined when Supabase isn't configured or nobody is signed in;
// callers should omit the Authorization header entirely in that case
// rather than sending an empty/invalid one.
export async function getAppAccessToken(): Promise<string | undefined> {
  if (!supabase) return undefined
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}
