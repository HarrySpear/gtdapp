import { useCallback, useEffect, useState } from 'react'
import {
  supabase,
  ITEM_COLS,
  PROJECT_COLS,
  type Item,
  type Project,
} from './supabase'

/** Completed work stays visible for a week, then stops taking up room. */
const KEEP_DONE_DAYS = 7

export type Gtd = ReturnType<typeof useGtd>

export function useGtd() {
  const [items, setItems] = useState<Item[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [lastReview, setLastReview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const since = new Date(
      Date.now() - KEEP_DONE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    const [i, p, r] = await Promise.all([
      supabase
        .from('items')
        .select(ITEM_COLS)
        .or(`status.neq.done,completed_at.gte.${since}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('projects')
        .select(PROJECT_COLS)
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('completed_at')
        .order('completed_at', { ascending: false })
        .limit(1),
    ])

    const failed = i.error ?? p.error ?? r.error
    if (failed) {
      setError(failed.message)
    } else {
      setItems(i.data as Item[])
      setProjects(p.data as Project[])
      setLastReview(r.data?.[0]?.completed_at ?? null)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Apply optimistically, roll the whole list back if the write is rejected. */
  const write = useCallback(
    async <T,>(
      apply: () => void,
      snapshot: T[],
      restore: (s: T[]) => void,
      // Supabase query builders are thenables, not full Promises.
      run: () => PromiseLike<{ error: { message: string } | null }>,
    ) => {
      apply()
      const { error } = await run()
      if (error) {
        restore(snapshot)
        setError(error.message)
        return false
      }
      setError(null)
      return true
    },
    [],
  )

  /* ------------------------------------------------------------- items -- */

  const capture = useCallback(async (title: string) => {
    const clean = title.trim()
    if (!clean) return

    const tempId = `pending-${crypto.randomUUID()}`
    setItems((prev) => [
      {
        id: tempId,
        title: clean,
        status: 'inbox',
        project_id: null,
        context: null,
        due_date: null,
        waiting_on: null,
        notes: null,
        completed_at: null,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])

    const { data, error } = await supabase
      .from('items')
      .insert({ title: clean })
      .select(ITEM_COLS)
      .single()

    if (error) {
      setItems((prev) => prev.filter((i) => i.id !== tempId))
      setError(error.message)
      return null
    }
    setItems((prev) => prev.map((i) => (i.id === tempId ? (data as Item) : i)))
    setError(null)
    return data as Item
  }, [])

  const updateItem = useCallback(
    (id: string, patch: Partial<Item>) =>
      write(
        () => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i))),
        items,
        setItems,
        () => supabase.from('items').update(patch).eq('id', id),
      ),
    [items, write],
  )

  const deleteItem = useCallback(
    (id: string) =>
      write(
        () => setItems((prev) => prev.filter((i) => i.id !== id)),
        items,
        setItems,
        () => supabase.from('items').delete().eq('id', id),
      ),
    [items, write],
  )

  const completeItem = useCallback(
    (id: string) => updateItem(id, { status: 'done' }),
    [updateItem],
  )

  /**
   * Add an action straight onto a project — the move you make constantly during
   * a review, so it skips the inbox entirely.
   */
  const addAction = useCallback(
    async (projectId: string | null, title: string) => {
      const clean = title.trim()
      if (!clean) return null

      const { data, error } = await supabase
        .from('items')
        .insert({ title: clean, status: 'next', project_id: projectId })
        .select(ITEM_COLS)
        .single()

      if (error) {
        setError(error.message)
        return null
      }
      setItems((prev) => [data as Item, ...prev])
      setError(null)
      return data as Item
    },
    [],
  )

  /* ---------------------------------------------------------- projects -- */

  const createProject = useCallback(async (name: string, description?: string) => {
    const clean = name.trim()
    if (!clean) return null

    const { data, error } = await supabase
      .from('projects')
      .insert({ name: clean, description: description?.trim() || null })
      .select(PROJECT_COLS)
      .single()

    if (error) {
      setError(error.message)
      return null
    }
    setProjects((prev) => [data as Project, ...prev])
    setError(null)
    return data as Project
  }, [])

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>) =>
      write(
        () =>
          setProjects((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          ),
        projects,
        setProjects,
        () => supabase.from('projects').update(patch).eq('id', id),
      ),
    [projects, write],
  )

  const deleteProject = useCallback(
    async (id: string) => {
      const ok = await write(
        () => setProjects((prev) => prev.filter((p) => p.id !== id)),
        projects,
        setProjects,
        () => supabase.from('projects').delete().eq('id', id),
      )
      // The FK is ON DELETE SET NULL, so its actions survive as loose ends.
      if (ok) {
        setItems((prev) =>
          prev.map((i) => (i.project_id === id ? { ...i, project_id: null } : i)),
        )
      }
      return ok
    },
    [projects, write],
  )

  /** Convert a captured thought into a project, keeping the wording. */
  const promoteToProject = useCallback(
    async (item: Item) => {
      const project = await createProject(item.title)
      if (!project) return null
      await deleteItem(item.id)
      return project
    },
    [createProject, deleteItem],
  )

  /* ----------------------------------------------------------- reviews -- */

  const logReview = useCallback(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .insert({})
      .select('completed_at')
      .single()

    if (error) {
      setError(error.message)
      return false
    }
    setLastReview(data.completed_at as string)
    setError(null)
    return true
  }, [])

  return {
    items,
    projects,
    lastReview,
    loading,
    error,
    reload: load,
    dismissError: () => setError(null),
    capture,
    updateItem,
    deleteItem,
    completeItem,
    addAction,
    createProject,
    updateProject,
    deleteProject,
    promoteToProject,
    logReview,
  }
}
