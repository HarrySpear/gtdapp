import { useEffect, useState } from 'react'
import type { Gtd } from '../lib/store'
import type { Item } from '../lib/supabase'
import { CONTEXTS } from '../lib/gtd'

type Stage = 'actionable' | 'effort' | 'next' | 'waiting'

/**
 * The clarify step from the book, as a queue you drain rather than a list you
 * stare at. One item, one question at a time: is it actionable, is it a
 * two-minute job, and if not — what is the next action and whose is it?
 */
export default function ClarifyFlow({ gtd, onClose }: { gtd: Gtd; onClose: () => void }) {
  const queue = gtd.items
    .filter((i) => i.status === 'inbox')
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1)) // oldest first

  const [index, setIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('actionable')
  const [context, setContext] = useState('')
  const [due, setDue] = useState('')
  const [projectId, setProjectId] = useState('')
  const [person, setPerson] = useState('')

  const item: Item | undefined = queue[index]

  useEffect(() => {
    setStage('actionable')
    setContext('')
    setDue('')
    setProjectId('')
    setPerson('')
  }, [item?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!item) {
    return (
      <div className="clarify">
        <div className="clarify-card">
          <p className="clarify-q">Inbox empty.</p>
          <p className="clarify-note">
            Everything captured has been decided on. That is the whole trick.
          </p>
          <div className="clarify-actions">
            <button className="pill pill-go" onClick={onClose}>
              done
            </button>
          </div>
        </div>
      </div>
    )
  }

  /** The queue is recomputed from state, so leaving the item's status alone
   *  means stepping past it; changing the status shrinks the queue under us. */
  const skip = () => setIndex((i) => i + 1)

  const settle = async (patch: Partial<Item>) => {
    await gtd.updateItem(item.id, patch)
  }

  return (
    <div className="clarify">
      <div className="clarify-card">
        <div className="clarify-progress">
          <span>
            {index + 1} of {queue.length}
          </span>
          <button onClick={onClose}>close</button>
        </div>

        <p className="clarify-item">{item.title}</p>

        {stage === 'actionable' && (
          <>
            <p className="clarify-q">Is this actionable?</p>
            <div className="clarify-actions">
              <button className="pill pill-go" onClick={() => setStage('effort')}>
                yes
              </button>
              <button className="pill" onClick={() => void settle({ status: 'someday' })}>
                someday / maybe
              </button>
              <button className="pill pill-warn" onClick={() => void gtd.deleteItem(item.id)}>
                bin it
              </button>
              <button className="pill pill-quiet" onClick={skip}>
                skip
              </button>
            </div>
          </>
        )}

        {stage === 'effort' && (
          <>
            <p className="clarify-q">What does doing it look like?</p>
            <div className="clarify-actions clarify-stack">
              <button className="pill pill-go" onClick={() => void settle({ status: 'done' })}>
                under two minutes — I just did it
              </button>
              <button className="pill" onClick={() => setStage('next')}>
                one action I will do myself
              </button>
              <button className="pill" onClick={() => setStage('waiting')}>
                someone else owes me this
              </button>
              <button className="pill" onClick={() => void gtd.promoteToProject(item)}>
                more than one step — make it a project
              </button>
            </div>
            <button className="clarify-back" onClick={() => setStage('actionable')}>
              ← back
            </button>
          </>
        )}

        {stage === 'next' && (
          <>
            <p className="clarify-q">Where and by when?</p>
            <div className="clarify-fields">
              <label className="field">
                <span>Context</span>
                <select value={context} onChange={(e) => setContext(e.target.value)}>
                  <option value="">— none</option>
                  {CONTEXTS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Due</span>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </label>
              <label className="field">
                <span>Project</span>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">— standalone</option>
                  {gtd.projects
                    .filter((p) => p.status === 'active')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="clarify-actions">
              <button
                className="pill pill-go"
                onClick={() =>
                  void settle({
                    status: 'next',
                    context: context || null,
                    due_date: due || null,
                    project_id: projectId || null,
                  })
                }
              >
                file it
              </button>
            </div>
            <button className="clarify-back" onClick={() => setStage('effort')}>
              ← back
            </button>
          </>
        )}

        {stage === 'waiting' && (
          <>
            <p className="clarify-q">Who has it, and when do you need it?</p>
            <div className="clarify-fields">
              <label className="field">
                <span>Waiting on</span>
                <input
                  autoFocus
                  value={person}
                  placeholder="name"
                  onChange={(e) => setPerson(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Needed by</span>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </label>
            </div>
            <div className="clarify-actions">
              <button
                className="pill pill-go"
                disabled={!person.trim()}
                onClick={() =>
                  void settle({
                    status: 'waiting',
                    waiting_on: person.trim(),
                    due_date: due || null,
                  })
                }
              >
                file it
              </button>
            </div>
            <button className="clarify-back" onClick={() => setStage('effort')}>
              ← back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
