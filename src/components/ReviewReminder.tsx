import { useState } from 'react'
import type { ReviewSummary } from '../lib/gtd'
import { reviewNudge } from '../lib/gtd'
import {
  buildReviewIcs,
  downloadIcs,
  nextOccurrence,
  DAY_NAMES,
  DEFAULT_REMINDER,
  type Reminder,
} from '../lib/ics'

const STORE_KEY = 'gtd.reminder'

function load(): Reminder {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...DEFAULT_REMINDER, ...JSON.parse(raw) } : DEFAULT_REMINDER
  } catch {
    return DEFAULT_REMINDER // a corrupt preference is not worth crashing over
  }
}

/**
 * Hands the scheduling job to the calendar app, which already has permission to
 * interrupt you and does not need a server, a service worker or a push key.
 */
export default function ReviewReminder({ summary }: { summary: ReviewSummary }) {
  const [reminder, setReminder] = useState<Reminder>(load)
  const [saved, setSaved] = useState(false)

  const lines = reviewNudge(summary)
  const next = nextOccurrence(reminder)

  function set(patch: Partial<Reminder>) {
    const merged = { ...reminder, ...patch }
    setReminder(merged)
    setSaved(false)
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(merged))
    } catch {
      // Private browsing can refuse writes; the reminder still downloads.
    }
  }

  function download() {
    const deepLink = `${window.location.origin}${window.location.pathname}#review`
    downloadIcs(buildReviewIcs(reminder, lines, deepLink))
    setSaved(true)
  }

  const time = `${String(reminder.hour).padStart(2, '0')}:${String(
    reminder.minute,
  ).padStart(2, '0')}`

  return (
    <section className="reminder">
      <h2 className="section-head">Remind me weekly</h2>

      <div className="reminder-controls">
        <label className="field">
          <span>Every</span>
          <select
            value={reminder.weekday}
            onChange={(e) => set({ weekday: Number(e.target.value) })}
          >
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>At</span>
          <input
            type="time"
            value={time}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number)
              if (!Number.isNaN(h) && !Number.isNaN(m)) set({ hour: h, minute: m })
            }}
          />
        </label>

        <label className="field">
          <span>Alert</span>
          <select
            value={reminder.alarmBefore}
            onChange={(e) => set({ alarmBefore: Number(e.target.value) })}
          >
            <option value={0}>on time</option>
            <option value={10}>10 min before</option>
            <option value={30}>30 min before</option>
            <option value={60}>1 hour before</option>
          </select>
        </label>
      </div>

      <div className="reminder-preview">
        <span className="reminder-when">
          Next: {DAY_NAMES[reminder.weekday]}{' '}
          {next.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at{' '}
          {time}
        </span>
        <p>
          The event carries today's state and a link straight back to this screen:
        </p>
        <ul>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      <button className="pill pill-go" onClick={download}>
        {saved ? 'downloaded — open it to add' : 'add to my calendar'}
      </button>

      {saved && (
        <p className="reminder-note">
          Open the downloaded file to add the repeating event. On a phone it is
          usually easier to do this on a computer and let the calendar sync across.
          Re-download any time to refresh the wording — it replaces the event rather
          than adding a second one.
        </p>
      )}
    </section>
  )
}
