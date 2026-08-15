import { useState } from 'react'
import type { Gtd } from '../lib/store'
import type { Tab } from './Shell'
import { reviewSummary, CHASE_AFTER_DAYS, HORIZON_DAYS } from '../lib/gtd'
import { daysOld, daysUntil, dueLabel, todayISO } from '../lib/age'
import ReviewReminder from './ReviewReminder'

/**
 * The weekly review — the habit the whole system rests on. Rather than a
 * checklist you tick by hand, each step reports whether it is actually clear,
 * so "done" means the lists are honest, not that you scrolled past them.
 */
export default function ReviewTab({ gtd, onGo }: { gtd: Gtd; onGo: (t: Tab) => void }) {
  const [justLogged, setJustLogged] = useState(false)
  const today = todayISO()
  const s = reviewSummary(gtd.items, gtd.projects, gtd.lastReview, today)

  return (
    <>
      <div className="masthead">
        <div className="count" data-empty={!s.overdue}>
          {s.daysSince === null ? '—' : s.daysSince}
        </div>
        <p className="review-since">
          {s.daysSince === null
            ? 'You have never logged a review. Start now; it takes half an hour.'
            : `days since your last review. ${
                s.overdue ? 'Overdue — the lists are drifting.' : 'Still fresh.'
              }`}
        </p>
      </div>

      <Step n={1} label="Empty the inbox" clear={s.inbox.length === 0}>
        {s.inbox.length > 0 ? (
          <>
            <p>
              {s.inbox.length} captured thought{s.inbox.length > 1 ? 's have' : ' has'}{' '}
              not been decided on.
            </p>
            <button className="pill pill-go" onClick={() => onGo('inbox')}>
              process them →
            </button>
          </>
        ) : (
          <p>Nothing undecided.</p>
        )}
      </Step>

      <Step n={2} label="Every project has a next action" clear={s.stalled.length === 0}>
        {s.stalled.length > 0 ? (
          <>
            <p>These have nothing to do next:</p>
            <ul className="review-list">
              {s.stalled.map((p) => (
                <StalledProject key={p.id} name={p.name} id={p.id} gtd={gtd} />
              ))}
            </ul>
          </>
        ) : (
          <p>Every active project has something to do next.</p>
        )}
      </Step>

      <Step n={3} label="Chase the waiting-fors" clear={s.chase.length === 0}>
        {s.chase.length > 0 ? (
          <>
            <p>Handed off over {CHASE_AFTER_DAYS} days ago and still open:</p>
            <ul className="review-list">
              {s.chase.map((i) => (
                <li key={i.id}>
                  <span>
                    {i.waiting_on} — {i.title}
                  </span>
                  <span className="review-age">{daysOld(i.created_at)}d</span>
                </li>
              ))}
            </ul>
            <button className="pill" onClick={() => onGo('waiting')}>
              open the list →
            </button>
          </>
        ) : (
          <p>Nothing has gone quiet.</p>
        )}
      </Step>

      <Step
        n={4}
        label="Revisit someday / maybe"
        clear={s.parkedItems.length + s.parkedProjects.length === 0}
        optional
      >
        {s.parkedItems.length + s.parkedProjects.length > 0 ? (
          <>
            <p>Parked. Is now the time for any of these?</p>
            <ul className="review-list">
              {s.parkedProjects.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <button
                    className="pill pill-sm"
                    onClick={() => void gtd.updateProject(p.id, { status: 'active' })}
                  >
                    activate
                  </button>
                </li>
              ))}
              {s.parkedItems.map((i) => (
                <li key={i.id}>
                  <span>{i.title}</span>
                  <span className="review-pair">
                    <button
                      className="pill pill-sm"
                      onClick={() => void gtd.updateItem(i.id, { status: 'next' })}
                    >
                      do it
                    </button>
                    <button
                      className="pill pill-sm pill-warn"
                      onClick={() => void gtd.deleteItem(i.id)}
                    >
                      drop
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Nothing parked.</p>
        )}
      </Step>

      <Step n={5} label="Look at the week ahead" clear optional>
        {s.soon.length > 0 ? (
          <ul className="review-list">
            {s.soon.map((i) => (
              <li key={i.id}>
                <span>{i.title}</span>
                <span
                  className="review-age"
                  data-tone={daysUntil(i.due_date!, today) < 0 ? 'late' : undefined}
                >
                  {dueLabel(i.due_date!, today)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nothing falls due in the next {HORIZON_DAYS} days.</p>
        )}
      </Step>

      <div className="review-finish">
        {justLogged ? (
          <p className="review-done">Review logged. Go and do the work.</p>
        ) : (
          <>
            <button
              className="pill pill-go pill-lg"
              onClick={async () => {
                if (await gtd.logReview()) setJustLogged(true)
              }}
            >
              mark this review complete
            </button>
            {!s.allClear && (
              <p className="review-warn">
                Steps 1–3 are not clear yet. You can log it anyway — just know what you
                are signing off.
              </p>
            )}
          </>
        )}
      </div>

      <ReviewReminder summary={s} />
    </>
  )
}

function Step({
  n,
  label,
  clear,
  optional,
  children,
}: {
  n: number
  label: string
  clear: boolean
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="step" data-clear={clear}>
      <h2 className="step-head">
        <span className="step-n">{clear ? '✓' : n}</span>
        {label}
        {optional && <span className="step-opt">optional</span>}
      </h2>
      <div className="step-body">{children}</div>
    </section>
  )
}

/** Fix a stalled project without leaving the review. */
function StalledProject({ name, id, gtd }: { name: string; id: string; gtd: Gtd }) {
  const [draft, setDraft] = useState('')

  return (
    <li className="stalled">
      <span>{name}</span>
      <input
        value={draft}
        placeholder="next action…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key !== 'Enter' || !draft.trim()) return
          const title = draft.trim()
          setDraft('')
          await gtd.addAction(id, title)
        }}
        aria-label={`Next action for ${name}`}
      />
    </li>
  )
}
