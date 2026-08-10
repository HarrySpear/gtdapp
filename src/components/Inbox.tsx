import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, type Item } from '../lib/supabase'
import { ageLabel, hoursOld, staleness } from '../lib/age'

const STALE_AFTER_HOURS = 24 * 7

export default function Inbox() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const captureRef = useRef<HTMLInputElement>(null)

  // Ages are the whole point of this screen, so keep them moving.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('items')
      .select('id, title, status, created_at')
      .eq('status', 'inbox')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else {
      setItems(data as Item[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function capture() {
    const title = draft.trim()
    if (!title) return

    const tempId = `pending-${crypto.randomUUID()}`
    const optimistic: Item = {
      id: tempId,
      title,
      status: 'inbox',
      created_at: new Date().toISOString(),
    }
    setItems((prev) => [optimistic, ...prev])
    setDraft('')
    captureRef.current?.focus()

    const { data, error } = await supabase
      .from('items')
      .insert({ title })
      .select('id, title, status, created_at')
      .single()

    if (error) {
      setItems((prev) => prev.filter((i) => i.id !== tempId))
      setDraft(title) // hand the words back rather than losing them
      setError(error.message)
    } else {
      setItems((prev) => prev.map((i) => (i.id === tempId ? (data as Item) : i)))
      setError(null)
    }
  }

  async function rename(id: string, title: string) {
    const before = items
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, title } : i)))
    const { error } = await supabase.from('items').update({ title }).eq('id', id)
    if (error) {
      setItems(before)
      setError(error.message)
    }
  }

  async function drop(id: string) {
    const before = items
    setItems((prev) => prev.filter((i) => i.id !== id))
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) {
      setItems(before)
      setError(error.message)
    }
  }

  const oldestFirst = [...items].reverse()

  return (
    <div className="shell">
      <header className="masthead">
        <div className="eyebrow">
          <span>Inbox — unsorted</span>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>

        <div className="count" data-empty={items.length === 0}>
          {loading ? '··' : String(items.length).padStart(2, '0')}
        </div>

        {oldestFirst.length > 0 ? (
          <div className="ticks" aria-hidden="true">
            {oldestFirst.map((item) => {
              const s = staleness(item.created_at, now)
              return (
                <span
                  key={item.id}
                  className="tick"
                  style={{ height: `${35 + s * 65}%`, color: tickColor(s) }}
                />
              )
            })}
          </div>
        ) : (
          <div className="ticks-empty" aria-hidden="true" />
        )}
      </header>

      <div className="capture">
        <span className="caret" aria-hidden="true">
          ▸
        </span>
        <input
          ref={captureRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && capture()}
          placeholder="What's on your mind?"
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="sentences"
          aria-label="Capture an item"
        />
        <span className="hint">RETURN</span>
      </div>

      {error && <div className="notice">Couldn't reach the database: {error}</div>}

      {!loading && items.length === 0 && !error && (
        <div className="blank">
          <strong>Nothing captured.</strong>
          Write the next thing on your mind and press return. Deciding what it
          means comes later.
        </div>
      )}

      <ul className="list">
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            now={now}
            onRename={rename}
            onDrop={drop}
          />
        ))}
      </ul>
    </div>
  )
}

function Row({
  item,
  now,
  onRename,
  onDrop,
}: {
  item: Item
  now: number
  onRename: (id: string, title: string) => void
  onDrop: (id: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(item.title)
  const pending = item.id.startsWith('pending-')

  useEffect(() => setText(item.title), [item.title])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  function commit() {
    const next = text.trim()
    if (!next) {
      setText(item.title) // an empty edit is a slip, not a delete
      return
    }
    if (next !== item.title) onRename(item.id, next)
  }

  return (
    <li className="row" data-pending={pending}>
      <textarea
        ref={ref}
        className="row-title"
        rows={1}
        value={text}
        disabled={pending}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            setText(item.title)
            e.currentTarget.blur()
          }
        }}
        aria-label={`Edit: ${item.title}`}
      />
      <span
        className="row-age"
        data-stale={hoursOld(item.created_at, now) > STALE_AFTER_HOURS}
      >
        {ageLabel(item.created_at, now)}
      </span>
      <button
        className="row-drop"
        onClick={() => onDrop(item.id)}
        disabled={pending}
        aria-label={`Delete: ${item.title}`}
      >
        ✕
      </button>
    </li>
  )
}

/** Grey when fresh, burnt amber when it has been sitting a fortnight. */
function tickColor(s: number) {
  const from = [201, 203, 197]
  const to = [168, 98, 27]
  const rgb = from.map((c, i) => Math.round(c + (to[i] - c) * s))
  return `rgb(${rgb.join(', ')})`
}
