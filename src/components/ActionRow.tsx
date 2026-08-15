import { useEffect, useRef, useState } from 'react'
import type { Item, Project } from '../lib/supabase'
import type { Gtd } from '../lib/store'
import { CONTEXTS } from '../lib/gtd'
import { dueLabel, dueTone } from '../lib/age'

/**
 * One action, everywhere it appears. Collapsed it is a line of text and a few
 * chips; opened it exposes the four decisions GTD asks of an action — which
 * project, which context, due when, and whether you are waiting on someone.
 */
export default function ActionRow({
  item,
  gtd,
  projects,
  showProject = true,
}: {
  item: Item
  gtd: Gtd
  projects: Project[]
  showProject?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(item.title)
  const [person, setPerson] = useState(item.waiting_on ?? '')
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const personRef = useRef<HTMLInputElement>(null)

  const project = projects.find((p) => p.id === item.project_id) ?? null
  const done = item.status === 'done'

  useEffect(() => setText(item.title), [item.title])
  useEffect(() => setPerson(item.waiting_on ?? ''), [item.waiting_on])

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text, open])

  function commitTitle() {
    const next = text.trim()
    if (!next) {
      setText(item.title) // an empty edit is a slip, not a delete
      return
    }
    if (next !== item.title) void gtd.updateItem(item.id, { title: next })
  }

  function commitPerson() {
    const next = person.trim()
    if (next === (item.waiting_on ?? '')) return
    // Dropping the name would break a waiting-for, so send it back to Next.
    if (!next && item.status === 'waiting') {
      void gtd.updateItem(item.id, { waiting_on: null, status: 'next' })
    } else {
      void gtd.updateItem(item.id, { waiting_on: next || null })
    }
  }

  function toggleWaiting() {
    if (item.status === 'waiting') {
      void gtd.updateItem(item.id, { status: 'next' })
      return
    }
    const name = person.trim()
    if (!name) {
      setOpen(true)
      personRef.current?.focus() // you cannot wait on nobody
      return
    }
    void gtd.updateItem(item.id, { status: 'waiting', waiting_on: name })
  }

  return (
    <li className="row action" data-done={done}>
      <div className="action-head">
        <button
          className="check"
          data-done={done}
          onClick={() =>
            void gtd.updateItem(item.id, { status: done ? 'next' : 'done' })
          }
          aria-label={done ? `Reopen: ${item.title}` : `Complete: ${item.title}`}
        />

        <div className="action-body">
          <textarea
            ref={titleRef}
            className="row-title"
            rows={1}
            value={text}
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

          <div className="chips">
            {showProject && project && (
              <span className="chip chip-project">{project.name}</span>
            )}
            {item.context && <span className="chip">{item.context}</span>}
            {item.status === 'waiting' && item.waiting_on && (
              <span className="chip chip-waiting">waiting · {item.waiting_on}</span>
            )}
            {item.due_date && (
              <span className="chip chip-due" data-tone={dueTone(item.due_date)}>
                {dueLabel(item.due_date)}
              </span>
            )}
          </div>
        </div>

        <button
          className="row-more"
          data-open={open}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Options for: ${item.title}`}
        >
          ⋯
        </button>
      </div>

      {open && (
        <div className="editor">
          <label className="field">
            <span>Project</span>
            <select
              value={item.project_id ?? ''}
              onChange={(e) =>
                void gtd.updateItem(item.id, { project_id: e.target.value || null })
              }
            >
              <option value="">— none, a standalone action</option>
              {projects
                .filter((p) => p.status !== 'done')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="field">
            <span>Context</span>
            <select
              value={item.context ?? ''}
              onChange={(e) =>
                void gtd.updateItem(item.id, { context: e.target.value || null })
              }
            >
              <option value="">— none</option>
              {CONTEXTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{item.status === 'waiting' ? 'Needed by' : 'Due'}</span>
            <input
              type="date"
              value={item.due_date ?? ''}
              onChange={(e) =>
                void gtd.updateItem(item.id, { due_date: e.target.value || null })
              }
            />
          </label>

          <label className="field">
            <span>Waiting on</span>
            <input
              ref={personRef}
              value={person}
              placeholder="who owes you this"
              onChange={(e) => setPerson(e.target.value)}
              onBlur={commitPerson}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>

          <div className="editor-actions">
            <button className="pill" onClick={toggleWaiting}>
              {item.status === 'waiting' ? '← back to next actions' : '→ waiting for'}
            </button>
            <button
              className="pill"
              onClick={() => void gtd.updateItem(item.id, { status: 'someday' })}
            >
              park as someday
            </button>
            <button className="pill pill-warn" onClick={() => void gtd.deleteItem(item.id)}>
              delete
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
