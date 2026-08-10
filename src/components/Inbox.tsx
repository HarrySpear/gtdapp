import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  supabase,
  ITEM_COLUMNS,
  type Item,
  type Status,
} from '../lib/supabase'
import {
  ageLabel,
  clockLabel,
  dayKey,
  dayLabel,
  hoursOld,
  staleness,
} from '../lib/age'

const STALE_AFTER_HOURS = 24 * 7
const HISTORY_LIMIT = 200

const VIEWS: { key: Status; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'next', label: 'Next' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'someday', label: 'Someday' },
  { key: 'done', label: 'Done' },
]

/** Where an item can go from the process panel, in the order you'd decide. */
const MOVES: { key: Status; label: string }[] = [
  { key: 'next', label: 'Next' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'someday', label: 'Someday' },
  { key: 'done', label: 'Done' },
]

export default function Inbox() {
  const [active, setActive] = useState<Item[]>([])
  const [history, setHistory] = useState<Item[] | null>(null)
  const [view, setView] = useState<Status>('inbox')
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const captureRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const loadActive = useCallback(async () => {
    const { data, error } = await supabase
      .from('items')
      .select(ITEM_COLUMNS)
      .neq('status', 'done')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else {
      setActive(data as Item[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadActive()
  }, [loadActive])

  // History is only fetched when you first look at it, and it's capped.
  useEffect(() => {
    if (view !== 'done' || history !== null) return
    void (async () => {
      const { data, error } = await supabase
        .from('items')
        .select(ITEM_COLUMNS)
        .eq('status', 'done')
        .order('completed_at', { ascending: false })
        .limit(HISTORY_LIMIT)

      if (error) setError(error.message)
      else setHistory(data as Item[])
    })()
  }, [view, history])

  async function capture() {
    const title = draft.trim()
    if (!title) return

    const tempId = `pending-${crypto.randomUUID()}`
    const optimistic: Item = {
      id: tempId,
      title,
      next_action: null,
      status: 'inbox',
      created_at: new Date().toISOString(),
      completed_at: null,
    }
    setActive((prev) => [optimistic, ...prev])
    setDraft('')
    setView('inbox')
    captureRef.current?.focus()

    const { data, error } = await supabase
      .from('items')
      .insert({ title })
      .select(ITEM_COLUMNS)
      .single()

    if (error) {
      setActive((prev) => prev.filter((i) => i.id !== tempId))
      setDraft(title)
      setError(error.message)
    } else {
      setActive((prev) => prev.map((i) => (i.id === tempId ? (data as Item) : i)))
      setError(null)
    }
  }

  async function patch(id: string, fields: Partial<Item>) {
    const beforeActive = active
    const beforeHistory = history

    setActive((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)))
    setHistory((prev) =>
      prev ? prev.map((i) => (i.id === id ? { ...i, ...fields } : i)) : prev,
    )

    const { error } = await supabase.from('items').update(fields).eq('id', id)
    if (error) {
      setActive(beforeActive)
      setHistory(beforeHistory)
      setError(error.message)
    }
  }

  /** Move an item between statuses, keeping the two lists in sync. */
  async function move(item: Item, status: Status) {
    const completed_at = status === 'done' ? new Date().toISOString() : null
    const moved: Item = { ...item, status, completed_at }

    const beforeActive = active
    const beforeHistory = history
    setOpenId(null)

    if (status === 'done') {
      setActive((prev) => prev.filter((i) => i.id !== item.id))
      setHistory((prev) => (prev ? [moved, ...prev] : prev))
    } else {
      setHistory((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev))
      setActive((prev) =>
        prev.some((i) => i.id === item.id)
          ? prev.map((i) => (i.id === item.id ? moved : i))
          : [moved, ...prev],
      )
    }

    const { error } = await supabase
      .from('items')
      .update({ status, completed_at })
      .eq('id', item.id)

    if (error) {
      setActive(beforeActive)
      setHistory(beforeHistory)
      setError(error.message)
    }
  }

  async function drop(id: string) {
    const beforeActive = active
    const beforeHistory = history
    setOpenId(null)
    setActive((prev) => prev.filter((i) => i.id !== id))
    setHistory((prev) => (prev ? prev.filter((i) => i.id !== id) : prev))

    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) {
      setActive(beforeActive)
      setHistory(beforeHistory)
      setError(error.message)
    }
  }

  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {}
    for (const i of active) c[i.status] = (c[i.status] ?? 0) + 1
    return c
  }, [active])

  const visible = useMemo(
    () =>
      view === 'done' ? (history ?? []) : active.filter((i) => i.status === view),
    [view, history, active],
  )

  const showTicks = view !== 'done' && visible.length > 0
  const oldestFirst = useMemo(() => [...visible].reverse(), [visible])

  return (
    <div className="shell">
      <header className="masthead">
        <div className="eyebrow">
          <span>{VIEWS.find((v) => v.key === view)?.label} — {view === 'done' ? 'archive' : 'open'}</span>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>

        <div className="count" data-empty={visible.length === 0}>
          {loading ? '··' : String(visible.length).padStart(2, '0')}
        </div>

        {showTicks ? (
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

        <nav className="tabs">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              className="tab"
              data-active={view === v.key}
              onClick={() => {
                setView(v.key)
                setOpenId(null)
              }}
            >
              {v.label}
              {v.key !== 'done' && counts[v.key] ? (
                <span className="tab-count">{counts[v.key]}</span>
              ) : null}
            </button>
          ))}
        </nav>
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

      {!loading && visible.length === 0 && !error && (
        <div className="blank">
          <strong>{blankTitle(view)}</strong>
          {blankBody(view)}
        </div>
      )}

      <ul className="list">
        {visible.map((item, index) => (
          <li key={item.id} className="group">
            {view === 'done' && needsDayHead(visible, index) && (
              <div className="day-head">
                {item.completed_at ? dayLabel(item.completed_at, now) : 'Undated'}
              </div>
            )}
            <Row
              item={item}
              view={view}
              now={now}
              open={openId === item.id}
              onToggle={() => setOpenId(openId === item.id ? null : item.id)}
              onPatch={patch}
              onMove={move}
              onDrop={drop}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Row({
  item,
  view,
  now,
  open,
  onToggle,
  onPatch,
  onMove,
  onDrop,
}: {
  item: Item
  view: Status
  now: number
  open: boolean
  onToggle: () => void
  onPatch: (id: string, fields: Partial<Item>) => void
  onMove: (item: Item, status: Status) => void
  onDrop: (id: string) => void
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(item.title)
  const [action, setAction] = useState(item.next_action ?? '')
  const pending = item.id.startsWith('pending-')

  useEffect(() => setText(item.title), [item.title])
  useEffect(() => setAction(item.next_action ?? ''), [item.next_action])

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  function commitTitle() {
    const next = text.trim()
    if (!next) {
      setText(item.title)
      return
    }
    if (next !== item.title) onPatch(item.id, { title: next })
  }

  function commitAction() {
    const next = action.trim()
    const current = item.next_action ?? ''
    if (next !== current) onPatch(item.id, { next_action: next || null })
  }

  const done = item.status === 'done'
  const stamp = done
    ? item.completed_at
      ? clockLabel(item.completed_at)
      : '—'
    : ageLabel(item.created_at, now)

  return (
    <div className="row" data-pending={pending} data-done={done}>
      <div className="row-body">
        <textarea
          ref={titleRef}
          className="row-title"
          rows={1}
          value={text}
          disabled={pending}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitTitle}
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

        {!open && item.next_action && (
          <div className="row-next">
            <span aria-hidden="true">→</span> {item.next_action}
          </div>
        )}

        {open && (
          <div className="panel">
            <label className="panel-label" htmlFor={`action-${item.id}`}>
              Next physical action
            </label>
            <input
              id={`action-${item.id}`}
              className="panel-input"
              value={action}
              placeholder="The very next thing you'd do"
              onChange={(e) => setAction(e.target.value)}
              onBlur={commitAction}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              autoCapitalize="sentences"
            />

            <div className="panel-actions">
              {(done ? RESTORE_MOVES : MOVES)
                .filter((m) => m.key !== item.status)
                .map((m) => (
                  <button
                    key={m.key}
                    className="chip"
                    data-emphasis={m.key === 'done' ? 'true' : undefined}
                    onClick={() => onMove(item, m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              <button className="chip chip-drop" onClick={() => onDrop(item.id)}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <span
        className="row-age"
        data-stale={!done && hoursOld(item.created_at, now) > STALE_AFTER_HOURS}
      >
        {stamp}
      </span>

      <button
        className="row-more"
        data-open={open}
        onClick={onToggle}
        disabled={pending}
        aria-expanded={open}
        aria-label={open ? 'Close options' : `Options for: ${item.title}`}
      >
        {open ? '×' : '⋯'}
      </button>

      {view === 'inbox' && !open && !pending && (
        <span className="row-cue" aria-hidden="true" />
      )}
    </div>
  )
}

const RESTORE_MOVES: { key: Status; label: string }[] = [
  { key: 'next', label: 'Reopen as next' },
  { key: 'inbox', label: 'Back to inbox' },
]

function needsDayHead(items: Item[], index: number) {
  const current = items[index].completed_at
  if (!current) return index === 0
  const prev = items[index - 1]?.completed_at
  if (!prev) return true
  return dayKey(current) !== dayKey(prev)
}

function blankTitle(view: Status) {
  if (view === 'inbox') return 'Inbox zero.'
  if (view === 'next') return 'No next actions.'
  if (view === 'waiting') return 'Waiting on nobody.'
  if (view === 'someday') return 'Nothing parked.'
  return 'Nothing finished yet.'
}

function blankBody(view: Status) {
  if (view === 'inbox')
    return 'Everything captured has been decided on. Write the next thing that turns up.'
  if (view === 'next')
    return 'Open an inbox item, write the next physical action, and send it here.'
  if (view === 'waiting')
    return "Items you've handed to someone else live here, so you can chase them."
  if (view === 'someday')
    return 'Things worth keeping but not worth doing now.'
  return 'Finished items land here, newest first.'
}

/** Grey when fresh, burnt amber when it has been sitting a fortnight. */
function tickColor(s: number) {
  const from = [201, 203, 197]
  const to = [168, 98, 27]
  const rgb = from.map((c, i) => Math.round(c + (to[i] - c) * s))
  return `rgb(${rgb.join(', ')})`
}
