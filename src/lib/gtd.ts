import type { Item, Project } from './supabase'
import { daysOld, daysUntil, todayISO } from './age'

/**
 * Contexts are the tool, place or person an action needs. You work from a
 * context list, not from one undifferentiated pile — that is the whole point.
 */
export const CONTEXTS = [
  '@calls',
  '@computer',
  '@errands',
  '@home',
  '@office',
  '@agenda',
  '@anywhere',
] as const

export const REVIEW_DUE_DAYS = 7
/** A handover left this long has stopped being "in progress". */
export const CHASE_AFTER_DAYS = 14
/** How far ahead the review looks for things falling due. */
export const HORIZON_DAYS = 7

/** Open actions belonging to a project — the things that keep it alive. */
export function actionsFor(items: Item[], projectId: string): Item[] {
  return items.filter(
    (i) =>
      i.project_id === projectId && (i.status === 'next' || i.status === 'waiting'),
  )
}

/**
 * A project with no next action and nobody to chase is stalled. This is where
 * a GTD system quietly dies, so it is worth shouting about.
 */
export function isStalled(items: Item[], project: Project): boolean {
  return project.status === 'active' && actionsFor(items, project.id).length === 0
}

/** Sort key: overdue first, then by due date, then oldest capture first. */
export function byUrgency(a: Item, b: Item): number {
  if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1
  if (a.due_date) return -1
  if (b.due_date) return 1
  return a.created_at < b.created_at ? -1 : 1
}

/* --------------------------------------------------------------- review -- */

export type ReviewSummary = ReturnType<typeof reviewSummary>

/**
 * The state of the system in one object. The review screen renders it and the
 * calendar reminder describes it, so a nudge can say what is actually wrong
 * rather than just that it is Sunday.
 */
export function reviewSummary(
  items: Item[],
  projects: Project[],
  lastReview: string | null,
  today = todayISO(),
) {
  const inbox = items.filter((i) => i.status === 'inbox')
  const stalled = projects.filter((p) => isStalled(items, p))
  const chase = items.filter(
    (i) => i.status === 'waiting' && daysOld(i.created_at) >= CHASE_AFTER_DAYS,
  )
  const parkedItems = items.filter((i) => i.status === 'someday')
  const parkedProjects = projects.filter((p) => p.status === 'someday')
  const soon = items
    .filter(
      (i) =>
        (i.status === 'next' || i.status === 'waiting') &&
        i.due_date &&
        daysUntil(i.due_date, today) <= HORIZON_DAYS,
    )
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))

  const daysSince = lastReview ? daysOld(lastReview) : null

  return {
    inbox,
    stalled,
    chase,
    parkedItems,
    parkedProjects,
    soon,
    daysSince,
    overdue: daysSince === null || daysSince >= REVIEW_DUE_DAYS,
    /** Steps 1–3 all clear: the lists can be trusted. */
    allClear: inbox.length === 0 && stalled.length === 0 && chase.length === 0,
  }
}

/**
 * What the reminder should actually say. A notification that names the damage
 * gets opened; "time for your weekly review" gets swiped away by week three.
 */
export function reviewNudge(s: ReviewSummary): string[] {
  const lines: string[] = []

  if (s.stalled.length > 0) {
    lines.push(
      `${s.stalled.length} project${s.stalled.length > 1 ? 's have' : ' has'} no next action.`,
    )
  }
  if (s.inbox.length > 0) {
    lines.push(`${s.inbox.length} thing${s.inbox.length > 1 ? 's' : ''} undecided in your inbox.`)
  }
  if (s.chase.length > 0) {
    lines.push(
      `${s.chase.length} handover${s.chase.length > 1 ? 's have' : ' has'} gone quiet for over ${CHASE_AFTER_DAYS} days.`,
    )
  }
  if (s.soon.length > 0) {
    lines.push(`${s.soon.length} thing${s.soon.length > 1 ? 's fall' : ' falls'} due this week.`)
  }

  if (lines.length === 0) lines.push('Everything was clear at your last check.')
  return lines
}
