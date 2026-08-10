import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!email.includes('@') || state === 'sending') return
    setState('sending')
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setState('idle')
    } else {
      setState('sent')
    }
  }

  return (
    <div className="gate">
      <h1>Inbox</h1>
      <p>Capture first, sort later.</p>

      <div className="gate-field">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={state === 'sent'}
          aria-label="Email address"
        />
        <button className="gate-send" onClick={send} disabled={state !== 'idle'}>
          {state === 'sending' ? 'Sending' : 'Send link'}
        </button>
      </div>

      {state === 'sent' && (
        <p className="gate-msg">
          Link sent to {email}. Open it on this device to finish signing in.
        </p>
      )}
      {error && <div className="notice">{error}</div>}
    </div>
  )
}
