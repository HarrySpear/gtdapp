import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    if (busy || !email || !password) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="gate">
      <h1>Getting things done</h1>
      <p>Capture first, sort later.</p>

      <div className="gate-field">
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />
      </div>

      <div className="gate-field gate-field-last">
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && signIn()}
          aria-label="Password"
        />
        <button className="gate-send" onClick={signIn} disabled={busy}>
          {busy ? 'Checking' : 'Sign in'}
        </button>
      </div>

      {error && <div className="notice">{error}</div>}
    </div>
  )
}
