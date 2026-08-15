import { useState } from 'react'
import type { Gtd } from '../lib/store'
import { CONTEXTS, byUrgency } from '../lib/gtd'
import { todayISO, daysUntil } from '../lib/age'
import ActionRow from './ActionRow'

/**
 * Everything you could actually do right now, filtered by context — the list
 * you work from. Overdue and due-today float to the top.
 */
export default function NextTab({ gtd }: { gtd: Gtd }) {
  const [context, setContext] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const all = gtd.items.filter((i) => i.status === 'next')
  const used = CONTEXTS.filter((c) => all.some((i) => i.context === c))
  const shown = (context ? all.filter((i) => i.context === context) : all).sort(byUrgency)

  const today = todayISO()
  const overdue = shown.filter((i) => i.due_date && daysUntil(i.due_date, today) < 0)
  const dueToday = shown.filter((i) => i.due_date && daysUntil(i.due_date, today) === 0)
  const rest = shown.filter(
    (i) => !i.due_date || daysUntil(i.due_date, today) > 0,
  )

  const done = gtd.items.filter((i) => i.status === 'done')

  async function add() {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    const item = await gtd.addAction(null, title)
    if (item && context) await gtd.updateItem(item.id, { context })
  }

  return (
    <>
      <div className="capture">
        <span className="caret" aria-hidden="true">
          ▸
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          placeholder="Next action — start it with a verb"
          enterKeyHint="done"
          autoComplete="off"
          aria-label="Add a next action"
        />
        <span className="hint">RETURN</span>
      </div>

      {used.length > 0 && (
        <div className="filters" role="group" aria-label="Filter by context">
          <button data-on={context === null} onClick={() => setContext(null)}>
            all · {all.length}
          </button>
          {used.map((c) => (
            <button
              key={c}
              data-on={context === c}
              onClick={() => setContext(context === c ? null : c)}
            >
              {c} · {all.filter((i) => i.context === c).length}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <div className="blank">
          <strong>{context ? `Nothing in ${context}.` : 'No next actions.'}</strong>
          {context
            ? 'Clear this filter, or pick a different context.'
            : 'Process the inbox, or open a project and decide its next physical action.'}
        </div>
      )}

      {overdue.length > 0 && (
        <Group label={`Overdue · ${overdue.length}`} tone="late">
          {overdue.map((i) => (
            <ActionRow key={i.id} item={i} gtd={gtd} projects={gtd.projects} />
          ))}
        </Group>
      )}

      {dueToday.length > 0 && (
        <Group label={`Today · ${dueToday.length}`} tone="today">
          {dueToday.map((i) => (
            <ActionRow key={i.id} item={i} gtd={gtd} projects={gtd.projects} />
          ))}
        </Group>
      )}

      {rest.length > 0 && (
        <Group label={overdue.length || dueToday.length ? 'Anytime' : ''}>
          {rest.map((i) => (
            <ActionRow key={i.id} item={i} gtd={gtd} projects={gtd.projects} />
          ))}
        </Group>
      )}

      {done.length > 0 && (
        <section className="section">
          <h2 className="section-head">Done this week · {done.length}</h2>
          <ul className="list">
            {done.map((i) => (
              <ActionRow key={i.id} item={i} gtd={gtd} projects={gtd.projects} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function Group({
  label,
  tone,
  children,
}: {
  label: string
  tone?: 'late' | 'today'
  children: React.ReactNode
}) {
  return (
    <section className="section">
      {label && (
        <h2 className="section-head" data-tone={tone}>
          {label}
        </h2>
      )}
      <ul className="list">{children}</ul>
    </section>
  )
}
