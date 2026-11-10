import { useState } from 'react'
import { LandingPage } from '../marketing/LandingPage'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'

type GateView = 'landing' | 'login' | 'signup'

/** The email confirmation link lands on /?confirmed=1 (or =expired). Read it
 *  once and drop it from the address bar. */
function takeConfirmationNotice(): string | null {
  const params = new URLSearchParams(window.location.search)
  const value = params.get('confirmed')
  if (!value) return null
  params.delete('confirmed')
  const query = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
  return value === '1'
    ? 'Your email address is confirmed. You can sign in now.'
    : 'That confirmation link has expired or was already used. Sign in, or sign up again for a new link.'
}

export function AuthGate() {
  const [notice] = useState(takeConfirmationNotice)
  const [view, setView] = useState<GateView>(notice ? 'login' : 'landing')

  if (view === 'login') {
    return <LoginPage notice={notice} onSwitchToSignup={() => setView('signup')} onBackToLanding={() => setView('landing')} />
  }
  if (view === 'signup') {
    return <SignupPage onSwitchToLogin={() => setView('login')} onBackToLanding={() => setView('landing')} />
  }
  return <LandingPage onSignIn={() => setView('login')} onSignUp={() => setView('signup')} />
}
