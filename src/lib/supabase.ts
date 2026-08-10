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

export const STATUSES = ['inbox', 'next', 'waiting', 'someday', 'done'] as const
export type Status = (typeof STATUSES)[number]

export type Item = {
  id: string
  title: string
  next_action: string | null
  status: Status
  created_at: string
  completed_at: string | null
}

export const ITEM_COLUMNS = 'id, title, next_action, status, created_at, completed_at'
