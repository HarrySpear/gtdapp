import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import SignIn from './components/SignIn'
import Shell from './components/Shell'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!live) return
        if (error) setError(error.message)
        setSession(data.session)
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        // Always resolve the gate. A failed session lookup means "sign in",
        // never a blank page.
        if (live) setReady(true)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (live) setSession(s)
    })

    return () => {
      live = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!ready) {
    return (
      <div className="gate">
        <h1>Getting things done</h1>
      </div>
    )
  }

  if (session) return <Shell />

  return (
    <>
      <SignIn />
      {error && (
        <div className="gate">
          <div className="notice">{error}</div>
        </div>
      )}
    </>
  )
}
