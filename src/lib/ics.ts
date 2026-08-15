/**
 * A recurring calendar event for the weekly review. Your phone already has a
 * reliable, battery-friendly, permission-free scheduler in it — this hands the
 * job to that rather than reinventing it with push notifications.
 */

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

/** Stable, so re-importing updates the event instead of duplicating it. */
const UID = 'weekly-review@gtdapp'

export type Reminder = {
  /** 0 = Sunday. */
  weekday: number
  hour: number
  minute: number
  /** Minutes before the event to alert. */
  alarmBefore: number
}

export const DEFAULT_REMINDER: Reminder = {
  weekday: 0,
  hour: 17,
  minute: 0,
  alarmBefore: 10,
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/** Escape per RFC 5545: backslash, semicolon, comma and newline are special. */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Fold to 75 octets per line. Continuation lines begin with a space, which
 * itself counts toward the limit.
 */
function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line

  const parts: string[] = []
  let current = ''
  let bytes = 0

  for (const ch of line) {
    const size = enc.encode(ch).length
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  if (current) parts.push(current)

  return parts.join('\r\n ')
}

/** YYYYMMDDTHHMMSS in local wall-clock time. */
function floating(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `T${p(d.getHours())}${p(d.getMinutes())}00`
  )
}

/** YYYYMMDDTHHMMSSZ — DTSTAMP must be UTC. */
function utc(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
}

/** The next time this weekday and time comes round. */
export function nextOccurrence(r: Reminder, from = new Date()): Date {
  const d = new Date(from)
  d.setHours(r.hour, r.minute, 0, 0)
  const delta = (r.weekday - d.getDay() + 7) % 7
  if (delta === 0 && d <= from) d.setDate(d.getDate() + 7)
  else d.setDate(d.getDate() + delta)
  return d
}

/**
 * Times are deliberately floating — no timezone, no VTIMEZONE block. The event
 * means "5pm wherever you are", which is what you want for a personal habit and
 * sidesteps a whole category of DST bugs.
 */
export function buildReviewIcs(
  reminder: Reminder,
  lines: string[],
  deepLink: string,
  now = new Date(),
): string {
  const start = nextOccurrence(reminder, now)

  const description = [
    ...lines,
    '',
    'Open the review:',
    deepLink,
  ].join('\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//gtdapp//weekly review//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${UID}`,
    `DTSTAMP:${utc(now)}`,
    `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
    `DTSTART:${floating(start)}`,
    'DURATION:PT30M',
    `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[reminder.weekday]}`,
    `SUMMARY:${esc('Weekly review')}`,
    `DESCRIPTION:${esc(description)}`,
    `URL:${esc(deepLink)}`,
    'BEGIN:VALARM',
    `TRIGGER:-PT${reminder.alarmBefore}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Weekly review')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  // CRLF throughout, and a trailing one — some parsers are strict about both.
  return ics.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(content: string, filename = 'weekly-review.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
