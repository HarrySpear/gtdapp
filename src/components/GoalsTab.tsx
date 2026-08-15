import { useState } from 'react'
import type { Gtd } from '../lib/store'
import type { Goal, Horizon } from '../lib/supabase'
import {
  HORIZONS,
  actionsFor,
  byUrgency,
  goalNeedsReview,
  isGoalStalled,
  projectsFor,
  targetDateFor,
  unalignedProjects,
  weeksLeft,
} from '../lib/gtd'

/**
 * The horizon above projects, and the one screen that answers "is my daily
 * work actually moving my year?". Goal → project → next action: break any
 * link and it lights up, the same way a stalled project already does.
 */
export default function GoalsTab({ gtd }: { gtd: Gtd }) {
  const [draft, setDraft] = useState('')
  const [horizon, setHorizon] = useState<Horizon>('3m')
  const [showClosed, setShowClosed] = useState(false)

  const active = gtd.goals.filter((g) => g.status === 'active')
  const closed = gtd.goals.filter((g) => g.status !== 'active')
  const stalled = active.filter((g) => isGoalStalled(gtd.projects, g))
  const stray = unalignedProjects(gtd.projects)

  async function add() {
    const name = draft.trim()
    if (!name) return
    setDraft('')
    await gtd.createGoal(name, horizon)
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
          placeholder="New goal — what will be true by then?"
          enterKeyHint="done"
          autoComplete="off"
          aria-label="New goal"
        />
        <select
          className="horizon-pick"
          value={horizon}
          onChange={(e) => setHorizon(e.target.value as Horizon)}
          aria-label="Horizon for the new goal"
        >
          {HORIZONS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
      </div>

      {stalled.length > 0 && (
        <div className="alert">
          <strong>
            {stalled.length} goal{stalled.length > 1 ? 's have' : ' has'} nothing
            being done about {stalled.length > 1 ? 'them' : 'it'}.
          </strong>
          A goal with no project underneath it is a wish. Either start a project or
          be honest and drop it.
        </div>
      )}

      {active.length === 0 && (
        <div className="blank">
          <strong>No goals set.</strong>
          A goal is what will be true in 3, 6 or 12 months. Projects hang off it,
          actions hang off those — and you can see at a glance whether this week is
          moving your year.
        </div>
      )}

      {HORIZONS.map((h) => {
        const inHorizon = active.filter((g) => g.horizon === h.id)
        if (inHorizon.length === 0) return null
        return (
          <section className="section" key={h.id}>
            <h2 className="section-head">
              {h.label} · {inHorizon.length}
            </h2>
            <ul className="list">
              {inHorizon.map((g) => (
                <GoalRow key={g.id} goal={g} gtd={gtd} />
              ))}
            </ul>
          </section>
        )
      })}

      {stray.length > 0 && (
        <section className="section">
          <h2 className="section-head">Serving no goal · {stray.length}</h2>
          <p className="section-note">
            Not a problem in itself — plenty of real work is upkeep. Worth a glance
            for anything that has quietly become your whole week.
          </p>
          <ul className="list">
            {stray.map((p) => (
              <li className="row stray" key={p.id}>
                <span className="stray-name">{p.name}</span>
                <select
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    void gtd.updateProject(p.id, { goal_id: e.target.value })
                  }
                  aria-label={`Attach ${p.name} to a goal`}
                >
                  <option value="">attach to…</option>
                  {active.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {closed.length > 0 && (
        <section className="section">
          <button
            className="section-head as-button"
            onClick={() => setShowClosed((s) => !s)}
          >
            Achieved and dropped · {closed.length} {showClosed ? '−' : '+'}
          </button>
          {showClosed && (
            <ul className="list">
              {closed.map((g) => (
                <GoalRow key={g.id} goal={g} gtd={gtd} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function GoalRow({ goal, gtd }: { goal: Goal; gtd: Gtd }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(goal.name)
  const [why, setWhy] = useState(goal.why ?? '')

  const projects = projectsFor(gtd.projects, goal.id)
  const stalled = isGoalStalled(gtd.projects, goal)
  const stale = goalNeedsReview(goal)
  const left = goal.target_date ? weeksLeft(goal.target_date) : null
  const closed = goal.status !== 'active'

  function save<K extends keyof Goal>(key: K, value: string) {
    const next = value.trim() || null
    if ((goal[key] ?? null) === next) return
    if (key === 'name' && !next) {
      setName(goal.name)
      return
    }
    void gtd.updateGoal(goal.id, { [key]: next } as Partial<Goal>)
  }

  return (
    <li className="row goal" data-stalled={stalled} data-closed={closed}>
      <div className="goal-head">
        <button className="goal-name" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {goal.name}
        </button>

        <span className="goal-meta">
          {stale && !closed && <span className="flag flag-quiet">review due</span>}
          {stalled ? (
            <span className="flag">no projects</span>
          ) : (
            left !== null &&
            !closed && (
              <span className="weeks" data-tone={left < 0 ? 'late' : left <= 4 ? 'soon' : undefined}>
                {left < 0 ? `${Math.abs(left)}w over` : `${left}w left`}
              </span>
            )
          )}
          {closed && <span className="count-sm">{goal.status}</span>}
        </span>
      </div>

      {goal.why && !open && <p className="project-desc">{goal.why}</p>}

      {open && (
        <div className="project-detail">
          <label className="field field-block">
            <span>Goal</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => save('name', name)}
            />
          </label>

          <label className="field field-block">
            <span>Why this matters</span>
            <textarea
              rows={2}
              value={why}
              placeholder="Motivation decays over a year. Write what will make you care in month eight."
              onChange={(e) => setWhy(e.target.value)}
              onBlur={() => save('why', why)}
            />
          </label>

          <div className="reminder-controls">
            <label className="field">
              <span>Horizon</span>
              <select
                value={goal.horizon}
                onChange={(e) => {
                  const h = e.target.value as Horizon
                  void gtd.updateGoal(goal.id, {
                    horizon: h,
                    target_date: targetDateFor(h, new Date(goal.created_at)),
                  })
                }}
              >
                {HORIZONS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>By</span>
              <input
                type="date"
                value={goal.target_date ?? ''}
                onChange={(e) =>
                  void gtd.updateGoal(goal.id, { target_date: e.target.value || null })
                }
              />
            </label>
          </div>

          <div className="editor-actions">
            {/* No tick-box on a goal: it is reached when its projects are done,
                not when you feel like marking it. */}
            <button
              className="pill"
              onClick={() =>
                void gtd.updateGoal(goal.id, {
                  status: goal.status === 'achieved' ? 'active' : 'achieved',
                })
              }
            >
              {goal.status === 'achieved' ? '← reopen' : 'reached it'}
            </button>
            <button
              className="pill"
              onClick={() =>
                void gtd.updateGoal(goal.id, {
                  status: goal.status === 'dropped' ? 'active' : 'dropped',
                })
              }
            >
              {goal.status === 'dropped' ? '← reinstate' : 'drop it'}
            </button>
            <button
              className="pill"
              onClick={() =>
                void gtd.updateGoal(goal.id, { reviewed_at: new Date().toISOString() })
              }
            >
              reviewed today
            </button>
            <button className="pill pill-warn" onClick={() => void gtd.deleteGoal(goal.id)}>
              delete
            </button>
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <ul className="list sub-list">
          {projects.map((p) => {
            const next = actionsFor(gtd.items, p.id).sort(byUrgency)[0]
            return (
              <li className="chain" key={p.id}>
                <span className="chain-project">{p.name}</span>
                {next ? (
                  <span className="chain-next">→ {next.title}</span>
                ) : (
                  <span className="flag">no next action</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
