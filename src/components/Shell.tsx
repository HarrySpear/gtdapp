import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useGtd } from '../lib/store'
import { isStalled, REVIEW_DUE_DAYS } from '../lib/gtd'
import { daysOld, daysUntil, todayISO } from '../lib/age'
import ProjectsTab from './ProjectsTab'
import NextTab from './NextTab'
import WaitingTab from './WaitingTab'
import InboxTab from './InboxTab'
import ReviewTab from './ReviewTab'

export type Tab = 'projects' | 'next' | 'waiting' | 'inbox' | 'review'

const TABS: { id: Tab; label: string }[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'next', label: 'Next' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'review', label: 'Review' },
]

/**
 * Projects sit first on purpose: you look at what you have committed to before
 * you look at what to do about it. Someday/maybe has no tab — it is a parking
 * bay, and the weekly review is the only place it should interrupt you.
 */
export default function Shell() {
  const gtd = useGtd()
  const [tab, setTab] = useState<Tab>('projects')
  const [now, setNow] = useState(() => Date.now())

  // Ages are load-bearing on the inbox screen, so keep them moving.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const today = todayISO()
  const counts: Record<Tab, number> = {
    projects: gtd.projects.filter((p) => p.status === 'active').length,
    next: gtd.items.filter((i) => i.status === 'next').length,
    waiting: gtd.items.filter((i) => i.status === 'waiting').length,
    inbox: gtd.items.filter((i) => i.status === 'inbox').length,
    review: 0,
  }

  // A dot means "this tab wants you": a stalled project, something overdue,
  // or a review that has gone stale.
  const flags: Partial<Record<Tab, boolean>> = {
    projects: gtd.projects.some((p) => isStalled(gtd.items, p)),
    next: gtd.items.some(
      (i) => i.status === 'next' && i.due_date && daysUntil(i.due_date, today) < 0,
    ),
    review: gtd.lastReview === null || daysOld(gtd.lastReview) >= REVIEW_DUE_DAYS,
  }

  return (
    <div className="shell">
      <div className="eyebrow">
        <span>Getting things done</span>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>

      <nav className="tabs" role="tablist" aria-label="Lists">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className="tab"
            data-on={tab === t.id}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {counts[t.id] > 0 && <span className="tab-count">{counts[t.id]}</span>}
            {flags[t.id] && <span className="tab-flag" aria-label="needs attention" />}
          </button>
        ))}
      </nav>

      {gtd.error && (
        <div className="notice">
          Couldn't reach the database: {gtd.error}
          <button onClick={gtd.dismissError}>dismiss</button>
        </div>
      )}

      {tab === 'projects' && <ProjectsTab gtd={gtd} />}
      {tab === 'next' && <NextTab gtd={gtd} />}
      {tab === 'waiting' && <WaitingTab gtd={gtd} />}
      {tab === 'inbox' && <InboxTab gtd={gtd} now={now} />}
      {tab === 'review' && <ReviewTab gtd={gtd} onGo={setTab} />}
    </div>
  )
}
