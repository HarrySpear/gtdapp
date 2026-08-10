const HOUR = 1000 * 60 * 60
const DAY = HOUR * 24

/** Hours since an item was captured. */
export function hoursOld(createdAt: string, now = Date.now()): number {
  return Math.max(0, (now - new Date(createdAt).getTime()) / HOUR)
}

/** Compact age label: now, 3h, 2d, 14d. */
export function ageLabel(createdAt: string, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(createdAt).getTime())
  if (ms < HOUR) return 'now'
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`
  return `${Math.floor(ms / DAY)}d`
}

/**
 * 0 = fresh, 1 = fully stale. Saturates at 14 days, which is roughly the point
 * where an item in the inbox has stopped being a task and started being a lie.
 */
export function staleness(createdAt: string, now = Date.now()): number {
  return Math.min(1, hoursOld(createdAt, now) / (24 * 14))
}
