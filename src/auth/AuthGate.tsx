import { useState } from 'react'
import { LandingPage } from '../marketing/LandingPage'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'

type GateView = 'landing' | 'login' | 'signup'

export function AuthGate() {
  const [view, setView] = useState<GateView>('landing')

  if (view === 'login') {
    return <LoginPage onSwitchToSignup={() => setView('signup')} onBackToLanding={() => setView('landing')} />
  }
  if (view === 'signup') {
    return <SignupPage onSwitchToLogin={() => setView('login')} onBackToLanding={() => setView('landing')} />
  }
  return <LandingPage onSignIn={() => setView('login')} onSignUp={() => setView('signup')} />
}
