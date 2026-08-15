import type { Item, Project } from './supabase'

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
