import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  username: string
  display_name?: string | null
  org_id: string
  role: string
  job_title?: string | null
  date_of_birth?: string | null
  address?: string | null
}

export interface Organisation {
  id: string
  name: string
}

export interface ProfileUpdate {
  display_name?: string | null
  job_title?: string | null
  date_of_birth?: string | null
  address?: string | null
}

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  organisation: Organisation | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<{ error?: string }>
  signup: (params: { email: string; password: string; displayName: string; orgName: string }) => Promise<{ error?: string; needsConfirmation?: boolean }>
  updateProfile: (fields: ProfileUpdate) => Promise<{ error?: string }>
  updateOrganisationName: (name: string) => Promise<{ error?: string }>
  changePassword: (newPassword: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organisation, setOrganisation] = useState<Organisation | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadProfile = async (userId: string) => {
    if (!supabase) return
    // Fetch profile without joining organisations — the join causes a 500 because
    // the organisations RLS policy reads from profiles, creating a circular dependency.
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, display_name, org_id, role, job_title, date_of_birth, address')
      .eq('id', userId)
      .single()
    if (!profileData) return
    setProfile(profileData as Profile)

    // Fetch organisation separately to avoid the circular RLS issue
    const { data: orgData } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('id', (profileData as Profile).org_id)
      .single()
    if (orgData) setOrganisation(orgData as Organisation)
  }

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setOrganisation(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const login = async (identifier: string, password: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Authentication not configured.' }
    // Legacy accounts are provisioned with a username and a synthetic email
    // (username@gpc-demo.local); self-serve signups use a real email address.
    const email = identifier.includes('@') ? identifier : `${identifier.toLowerCase()}@gpc-demo.local`
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'Invalid email/username or password.' }
    return {}
  }

  const signup = async ({ email, password, displayName, orgName }: { email: string; password: string; displayName: string; orgName: string }): Promise<{ error?: string; needsConfirmation?: boolean }> => {
    if (!supabase) return { error: 'Authentication not configured.' }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          // Flags this account for auto-provisioning (new org + profile) in
          // the on_auth_user_created DB trigger. Admin-provisioned accounts
          // (setup-user.mjs, repair-auth-user.mjs) don't set this and create
          // their organisation/profile rows themselves.
          self_signup: 'true',
          display_name: displayName || undefined,
          org_name: orgName || undefined,
        },
      },
    })
    if (error) return { error: error.message }
    return { needsConfirmation: !data.session }
  }

  const updateProfile = async (fields: ProfileUpdate): Promise<{ error?: string }> => {
    if (!supabase || !user) return { error: 'Not signed in.' }
    const { data, error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', user.id)
      .select('id, username, display_name, org_id, role, job_title, date_of_birth, address')
      .single()
    if (error) return { error: error.message }
    setProfile(data as Profile)
    return {}
  }

  const updateOrganisationName = async (name: string): Promise<{ error?: string }> => {
    if (!supabase || !organisation) return { error: 'Not signed in.' }
    const { data, error } = await supabase
      .from('organisations')
      .update({ name })
      .eq('id', organisation.id)
      .select('id, name')
      .single()
    if (error) return { error: error.message }
    setOrganisation(data as Organisation)
    return {}
  }

  const changePassword = async (newPassword: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Authentication not configured.' }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    return {}
  }

  const logout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, organisation, isLoading, login, signup, updateProfile, updateOrganisationName, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
