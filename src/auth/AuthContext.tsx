import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  username: string
  display_name?: string | null
  org_id: string
  role: string
}

export interface Organisation {
  id: string
  name: string
}

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  organisation: Organisation | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ error?: string }>
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
      .select('id, username, display_name, org_id, role')
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

  const login = async (username: string, password: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Authentication not configured.' }
    const email = `${username.toLowerCase()}@gpc-demo.local`
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'Invalid username or password.' }
    return {}
  }

  const logout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, organisation, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
