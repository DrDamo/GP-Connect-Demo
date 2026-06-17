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
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, org_id, role, organisations(id, name)')
      .eq('id', userId)
      .single()
    if (data) {
      const { organisations: org, ...fields } = data as unknown as Profile & { organisations: Organisation }
      setProfile(fields)
      setOrganisation(org ?? null)
    }
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
