import { useState } from 'react'
import type { Gtd } from '../lib/store'
import type { Project } from '../lib/supabase'
import { actionsFor, isStalled, byUrgency } from '../lib/gtd'
import ActionRow from './ActionRow'

/**
 * The top of the app: what you have going, and whether each one has a next
 * action. A project with nothing to do next is the failure mode this view
 * exists to catch, so it is flagged before anything else.
 */
export default function ProjectsTab({ gtd }: { gtd: Gtd }) {
  const [draft, setDraft] = useState('')
  const [showDone, setShowDone] = useState(false)

  const active = gtd.projects.filter((p) => p.status === 'active')
  const parked = gtd.projects.filter((p) => p.status === 'someday')
  const finished = gtd.projects.filter((p) => p.status === 'done')
  const stalled = active.filter((p) => isStalled(gtd.items, p))

  async function add() {
    const name = draft.trim()
    if (!name) return
    setDraft('')
    await gtd.createProject(name)
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
          placeholder="New project — an outcome needing more than one action"
          enterKeyHint="done"
          autoComplete="off"
          aria-label="New project"
        />
        <span className="hint">RETURN</span>
      </div>

      {stalled.length > 0 && (
        <div className="alert">
          <strong>
            {stalled.length} project{stalled.length > 1 ? 's have' : ' has'} no next
            action.
          </strong>
          A project without a next action is a wish. Open the flagged ones below and
          decide the very next physical thing you would do.
        </div>
      )}

      {active.length === 0 && (
        <div className="blank">
          <strong>No projects yet.</strong>
          Anything needing more than one step is a project. Name the outcome — "new
          starter set up", not "onboarding" — and hang the actions off it.
        </div>
      )}

      <ul className="list">
        {active.map((p) => (
          <ProjectRow key={p.id} project={p} gtd={gtd} />
        ))}
      </ul>

      {parked.length > 0 && (
        <section className="section">
          <h2 className="section-head">Someday / maybe · {parked.length}</h2>
          <ul className="list">
            {parked.map((p) => (
              <ProjectRow key={p.id} project={p} gtd={gtd} />
            ))}
          </ul>
        </section>
      )}

      {finished.length > 0 && (
        <section className="section">
          <button className="section-head as-button" onClick={() => setShowDone((s) => !s)}>
            Completed · {finished.length} {showDone ? '−' : '+'}
          </button>
          {showDone && (
            <ul className="list">
              {finished.map((p) => (
                <ProjectRow key={p.id} project={p} gtd={gtd} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function ProjectRow({ project, gtd }: { project: Project; gtd: Gtd }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [outcome, setOutcome] = useState(project.outcome ?? '')

  const actions = actionsFor(gtd.items, project.id).sort(byUrgency)
  const stalled = isStalled(gtd.items, project)
  const done = project.status === 'done'

  async function addAction() {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    await gtd.addAction(project.id, title)
  }

  function save<K extends keyof Project>(key: K, value: string) {
    const next = value.trim() || null
    if ((project[key] ?? null) === next) return
    if (key === 'name' && !next) {
      setName(project.name) // a project must keep its name
      return
    }
    void gtd.updateProject(project.id, { [key]: next } as Partial<Project>)
  }

  return (
    <li className="row project" data-stalled={stalled} data-done={done}>
      <div className="project-head">
        <button
          className="check"
          data-done={done}
          onClick={() =>
            void gtd.updateProject(project.id, {
              status: done ? 'active' : 'done',
              completed_at: done ? null : new Date().toISOString(),
            })
          }
          aria-label={done ? `Reopen ${project.name}` : `Complete ${project.name}`}
        />

        <button className="project-name" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {project.name}
        </button>

        <span className="project-meta">
          {stalled ? (
            <span className="flag">no next action</span>
          ) : (
            <span className="count-sm">{actions.length}</span>
          )}
        </span>
      </div>

      {project.description && !open && (
        <p className="project-desc">{project.description}</p>
      )}

      {open && (
        <div className="project-detail">
          <label className="field field-block">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => save('name', name)}
            />
          </label>

          <label className="field field-block">
            <span>Description</span>
            <textarea
              rows={2}
              value={description}
              placeholder="What is this, and why does it matter?"
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => save('description', description)}
            />
          </label>

          <label className="field field-block">
            <span>Serves goal</span>
            <select
              value={project.goal_id ?? ''}
              onChange={(e) =>
                void gtd.updateProject(project.id, { goal_id: e.target.value || null })
              }
            >
              <option value="">— none, this is upkeep</option>
              {gtd.goals
                .filter((g) => g.status === 'active')
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="field field-block">
            <span>Done looks like</span>
            <textarea
              rows={2}
              value={outcome}
              placeholder="The state of the world when you can cross this off."
              onChange={(e) => setOutcome(e.target.value)}
              onBlur={() => save('outcome', outcome)}
            />
          </label>

          <div className="editor-actions">
            <button
              className="pill"
              onClick={() =>
                void gtd.updateProject(project.id, {
                  status: project.status === 'someday' ? 'active' : 'someday',
                })
              }
            >
              {project.status === 'someday' ? '← make active' : 'park as someday'}
            </button>
            <button className="pill pill-warn" onClick={() => void gtd.deleteProject(project.id)}>
              delete project
            </button>
          </div>
        </div>
      )}

      {(open || actions.length > 0) && (
        <ul className="list sub-list">
          {actions.map((a) => (
            <ActionRow
              key={a.id}
              item={a}
              gtd={gtd}
              projects={gtd.projects}
              showProject={false}
            />
          ))}
        </ul>
      )}

      {!done && (
        <div className="add-action" data-urgent={stalled}>
          <span className="caret" aria-hidden="true">
            +
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addAction()}
            placeholder={stalled ? 'What is the very next action?' : 'Add a next action'}
            autoComplete="off"
            aria-label={`Add a next action to ${project.name}`}
          />
        </div>
      )}
    </li>
  )
}
