import { useEffect, useRef, useState } from 'react'
import type { Gtd } from '../lib/store'
import type { Item } from '../lib/supabase'
import { ageLabel, hoursOld, staleness } from '../lib/age'
import ClarifyFlow from './ClarifyFlow'

const STALE_AFTER_HOURS = 24 * 7

/**
 * Capture stays deliberately dumb — type, return, forget. Deciding what any of
 * it means happens in the clarify queue, never at the moment of writing.
 */
export default function InboxTab({ gtd, now }: { gtd: Gtd; now: number }) {
  const [draft, setDraft] = useState('')
  const [clarifying, setClarifying] = useState(false)
  const captureRef = useRef<HTMLInputElement>(null)

  const items = gtd.items.filter((i) => i.status === 'inbox')
  const oldestFirst = [...items].reverse()

  async function capture() {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    captureRef.current?.focus()
    await gtd.capture(title)
  }

  return (
    <>
      <div className="masthead">
        <div className="count" data-empty={items.length === 0}>
          {gtd.loading ? '··' : String(items.length).padStart(2, '0')}
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
      </div>

      <div className="capture">
        <span className="caret" aria-hidden="true">
          ▸
        </span>
        <input
          ref={captureRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void capture()}
          placeholder="What's on your mind?"
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="sentences"
          aria-label="Capture an item"
        />
        <span className="hint">RETURN</span>
      </div>

      {items.length > 0 && (
        <button className="process" onClick={() => setClarifying(true)}>
          Process {items.length} item{items.length > 1 ? 's' : ''} →
        </button>
      )}

      {!gtd.loading && items.length === 0 && (
        <div className="blank">
          <strong>Nothing captured.</strong>
          Write the next thing on your mind and press return. Deciding what it means
          comes later.
        </div>
      )}

      <ul className="list">
        {items.map((item) => (
          <InboxRow key={item.id} item={item} gtd={gtd} now={now} />
        ))}
      </ul>

      {clarifying && <ClarifyFlow gtd={gtd} onClose={() => setClarifying(false)} />}
    </>
  )
}

function InboxRow({ item, gtd, now }: { item: Item; gtd: Gtd; now: number }) {
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
    if (next !== item.title) void gtd.updateItem(item.id, { title: next })
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
        onClick={() => void gtd.deleteItem(item.id)}
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
