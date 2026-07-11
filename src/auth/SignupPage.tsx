import { useState } from 'react'
import { useAuth } from './AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

interface SignupPageProps {
  onSwitchToLogin: () => void
  onBackToLanding: () => void
}

export function SignupPage({ onSwitchToLogin, onBackToLanding }: SignupPageProps) {
  const [displayName, setDisplayName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const { signup } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const result = await signup({ email: email.trim(), password, displayName: displayName.trim(), orgName: orgName.trim() })
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.needsConfirmation) {
      setConfirmationSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-nhs-grey-5 dark:bg-gray-950 flex flex-col">
      <header className="bg-nhs-blue px-4 py-3 shrink-0">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-3">
          <button onClick={onBackToLanding} className="flex items-center gap-3 text-left">
            <div className="bg-white text-nhs-blue font-extrabold text-sm px-2 py-1 rounded leading-tight">NHS</div>
            <div>
              <h1 className="text-white text-base font-semibold leading-tight">GP Connect Demonstrator</h1>
              <p className="text-white/75 text-xs leading-tight">Access Record Structured · FHIR STU3</p>
            </div>
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-5 border-b border-nhs-grey-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-nhs-grey-1 dark:text-gray-100">Create your account</h2>
              <p className="text-sm text-nhs-grey-3 dark:text-gray-500 mt-0.5">
                {isSupabaseConfigured ? 'Free — no card required' : 'Authentication not yet configured'}
              </p>
            </div>

            {!isSupabaseConfigured ? (
              <div className="px-6 py-5">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-3 text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-medium mb-1">Setup required</p>
                  <p className="text-xs">Add <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to your environment, then run the setup endpoint.</p>
                </div>
              </div>
            ) : confirmationSent ? (
              <div className="px-6 py-5">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-nhs-green dark:text-green-400 rounded p-3 text-sm">
                  <p className="font-medium mb-1">Check your email</p>
                  <p className="text-xs">We've sent a confirmation link to <span className="font-medium">{email.trim()}</span>. Confirm your address, then sign in.</p>
                </div>
                <button
                  onClick={onSwitchToLogin}
                  className="w-full mt-4 bg-nhs-blue text-white py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Go to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-nhs-red dark:text-red-400 px-3 py-2 rounded text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-nhs-grey-1 dark:text-gray-300 mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    autoComplete="name"
                    autoFocus
                    required
                    className="w-full rounded border border-nhs-grey-4 dark:border-gray-600 px-3 py-2 text-sm text-nhs-grey-1 dark:text-gray-100 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nhs-grey-1 dark:text-gray-300 mb-1">
                    Organisation name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="e.g. Riverside Medical Centre"
                    autoComplete="organization"
                    required
                    className="w-full rounded border border-nhs-grey-4 dark:border-gray-600 px-3 py-2 text-sm text-nhs-grey-1 dark:text-gray-100 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nhs-grey-1 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="w-full rounded border border-nhs-grey-4 dark:border-gray-600 px-3 py-2 text-sm text-nhs-grey-1 dark:text-gray-100 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nhs-grey-1 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full rounded border border-nhs-grey-4 dark:border-gray-600 px-3 py-2 text-sm text-nhs-grey-1 dark:text-gray-100 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nhs-grey-1 dark:text-gray-300 mb-1">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full rounded border border-nhs-grey-4 dark:border-gray-600 px-3 py-2 text-sm text-nhs-grey-1 dark:text-gray-100 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !displayName.trim() || !orgName.trim() || !email.trim() || !password || !confirmPassword}
                  className="w-full bg-nhs-blue text-white py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
                <p className="text-sm text-center text-nhs-grey-3 dark:text-gray-500">
                  Already have an account?{' '}
                  <button type="button" onClick={onSwitchToLogin} className="text-nhs-blue dark:text-nhs-blue-light font-medium hover:underline">
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>

          <p className="text-xs text-center text-nhs-grey-3 dark:text-gray-600 mt-4">
            GP Connect Demonstrator · Not a clinical system · For testing and demonstration only
          </p>
        </div>
      </div>
    </div>
  )
}
