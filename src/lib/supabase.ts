import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** 'someday' has no tab — it is the parking bay the weekly review empties. */
export type ItemStatus = 'inbox' | 'next' | 'waiting' | 'someday' | 'done'

export type Item = {
  id: string
  title: string
  status: ItemStatus
  project_id: string | null
  context: string | null
  due_date: string | null // 'YYYY-MM-DD'
  waiting_on: string | null
  notes: string | null
  completed_at: string | null
  created_at: string
}

export type ProjectStatus = 'active' | 'someday' | 'done'

export type Project = {
  id: string
  name: string
  description: string | null
  outcome: string | null
  status: ProjectStatus
  goal_id: string | null
  reviewed_at: string | null
  completed_at: string | null
  created_at: string
}

/** How far out the goal reaches. Anything longer is a vision, not a goal. */
export type Horizon = '3m' | '6m' | '12m'

export type GoalStatus = 'active' | 'achieved' | 'dropped'

export type Goal = {
  id: string
  name: string
  why: string | null
  horizon: Horizon
  target_date: string | null // 'YYYY-MM-DD'
  status: GoalStatus
  reviewed_at: string | null
  created_at: string
}

export const ITEM_COLS =
  'id, title, status, project_id, context, due_date, waiting_on, notes, completed_at, created_at'

export const PROJECT_COLS =
  'id, name, description, outcome, status, goal_id, reviewed_at, completed_at, created_at'

export const GOAL_COLS =
  'id, name, why, horizon, target_date, status, reviewed_at, created_at'
