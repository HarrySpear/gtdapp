const HOUR = 1000 * 60 * 60
const DAY = HOUR * 24

/** Hours since an item was captured. */
export function hoursOld(createdAt: string, now = Date.now()): number {
  return Math.max(0, (now - new Date(createdAt).getTime()) / HOUR)
}

/** Days since a timestamp, rounded down. */
export function daysOld(at: string, now = Date.now()): number {
  return Math.floor(Math.max(0, now - new Date(at).getTime()) / DAY)
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

/* ------------------------------------------------------------- due dates -- */

/** Today as 'YYYY-MM-DD' in the reader's own timezone, not UTC. */
export function todayISO(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Whole days from today to a 'YYYY-MM-DD' date. Negative means overdue. */
export function daysUntil(date: string, today = todayISO()): number {
  const [ay, am, ad] = date.split('-').map(Number)
  const [by, bm, bd] = today.split('-').map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / DAY)
}

/** Short due label: 2d late, today, tomorrow, 4d, Fri 22 Aug. */
export function dueLabel(date: string, today = todayISO()): string {
  const d = daysUntil(date, today)
  if (d < 0) return `${Math.abs(d)}d late`
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d <= 6) return `${d}d`
  const [y, m, dd] = date.split('-').map(Number)
  return new Date(y, m - 1, dd).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Drives the colour of a due date without leaking colour into the markup. */
export function dueTone(
  date: string,
  today = todayISO(),
): 'late' | 'today' | 'soon' | 'later' {
  const d = daysUntil(date, today)
  if (d < 0) return 'late'
  if (d === 0) return 'today'
  if (d <= 3) return 'soon'
  return 'later'
}
