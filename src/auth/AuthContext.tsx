import { createContext, useContext, useEffect, useState } from 'react'
import { api, ApiError, errorMessage, isAuthEnabled } from '../lib/api'
import { clearLocalPatientData } from '../lib/localPatientData'

export interface User {
  id: string
  email: string
}

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

/** GET /api/auth/me and POST /api/auth/login */
interface Me {
  user: User
  profile: Profile | null
  organisation: Organisation | null
  isPlatformAdmin: boolean
}

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  organisation: Organisation | null
  /** May edit the global training content (public.platform_admins). */
  isPlatformAdmin: boolean
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
  const [me, setMe] = useState<Me | null>(null)
  const [isLoading, setIsLoading] = useState(isAuthEnabled)

  useEffect(() => {
    if (!isAuthEnabled) return
    let cancelled = false
    api.get<Me>('/auth/me')
      .then(result => { if (!cancelled) setMe(result) })
      .catch(() => { /* 401: signed out */ })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const login = async (identifier: string, password: string): Promise<{ error?: string }> => {
    if (!isAuthEnabled) return { error: 'Authentication not configured.' }
    try {
      setMe(await api.post<Me>('/auth/login', { identifier, password }))
      return {}
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) return { error: 'Too many attempts. Please wait a few minutes and try again.' }
      return { error: errorMessage(err) }
    }
  }

  const signup = async ({ email, password, displayName, orgName }: { email: string; password: string; displayName: string; orgName: string }): Promise<{ error?: string; needsConfirmation?: boolean }> => {
    if (!isAuthEnabled) return { error: 'Authentication not configured.' }
    try {
      // An already-registered address gets the same "check your email"
      // response as a new one, so the form can't be used to probe for accounts.
      await api.post('/auth/signup', { email, password, displayName, orgName })
      return { needsConfirmation: true }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) return { error: 'Too many attempts. Please wait a few minutes and try again.' }
      return { error: err instanceof ApiError && err.status === 400 ? err.message : 'Could not create the account. Please try again.' }
    }
  }

  const updateProfile = async (fields: ProfileUpdate): Promise<{ error?: string }> => {
    if (!me) return { error: 'Not signed in.' }
    try {
      const profile = await api.patch<Profile>('/me', fields)
      setMe(m => (m ? { ...m, profile } : m))
      return {}
    } catch (err) {
      return { error: errorMessage(err) }
    }
  }

  const updateOrganisationName = async (name: string): Promise<{ error?: string }> => {
    if (!me?.organisation) return { error: 'Not signed in.' }
    try {
      const organisation = await api.patch<Organisation>('/org', { name })
      setMe(m => (m ? { ...m, organisation } : m))
      return {}
    } catch (err) {
      return { error: errorMessage(err) }
    }
  }

  const changePassword = async (newPassword: string): Promise<{ error?: string }> => {
    if (!me) return { error: 'Not signed in.' }
    try {
      await api.post('/auth/password', { password: newPassword })
      return {}
    } catch (err) {
      return { error: errorMessage(err) }
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch { /* the cookie is cleared server-side; sign out locally regardless */ }
    clearLocalPatientData()
    setMe(null)
  }

  return (
    <AuthContext.Provider value={{
      user: me?.user ?? null,
      profile: me?.profile ?? null,
      organisation: me?.organisation ?? null,
      isPlatformAdmin: me?.isPlatformAdmin ?? false,
      isLoading,
      login, signup, updateProfile, updateOrganisationName, changePassword, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
