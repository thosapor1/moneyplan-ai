'use client'

/**
 * React hook + module-level cache for the user's effective expense-category list.
 *
 * Strategy:
 * - Fetch once per session (cached at module scope, shared across hook callers).
 * - While loading, serve hardcoded defaults so UI never shows an empty list.
 * - If the DB table does not exist (migration 007 not applied) or fetch fails,
 *   continue with hardcoded defaults — the app keeps working through rollout.
 *
 * Returns:
 * - categories: full list (ordered by sort_order)
 * - byName: name -> row, for O(1) icon/kind lookups
 * - names: list of name strings (handy for picker iteration)
 * - fixed / variable: pre-split lists for forecast + daily-budget math
 * - isLoading: true until the first fetch settles
 * - source: 'db' | 'default' — useful for diagnostics
 */

import { useEffect, useState } from 'react'
import {
  fetchExpenseCategories,
  supabase,
  type ExpenseCategoryRow,
} from '../../infrastructure/supabase/supabase'
import { registerCategoryIcons } from '../category-icons/category-icons'
import { getDefaultExpenseCategories } from './expense-category-defaults'

type CacheState = {
  rows: ExpenseCategoryRow[]
  source: 'db' | 'default'
}

const DEFAULTS: CacheState = {
  rows: getDefaultExpenseCategories(),
  source: 'default',
}

// Seed the runtime icon registry with defaults so icons resolve correctly
// even before the DB fetch completes.
registerCategoryIcons(DEFAULTS.rows)

let cache: CacheState | null = null
let inflight: Promise<CacheState> | null = null

async function loadOnce(userId: string): Promise<CacheState> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const rows = await fetchExpenseCategories(userId)
      if (rows && rows.length > 0) {
        registerCategoryIcons(rows)
        const result: CacheState = { rows, source: 'db' }
        cache = result
        return result
      }
    } catch (e) {
      console.error('useExpenseCategories load:', e)
    }
    cache = DEFAULTS
    return DEFAULTS
  })()
  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/** Invalidate the in-memory cache so the next hook call refetches. */
export function invalidateExpenseCategoriesCache(): void {
  cache = null
  inflight = null
}

export type UseExpenseCategoriesResult = {
  categories: ExpenseCategoryRow[]
  byName: Map<string, ExpenseCategoryRow>
  names: string[]
  fixed: ExpenseCategoryRow[]
  variable: ExpenseCategoryRow[]
  isLoading: boolean
  source: 'db' | 'default'
}

function deriveResult(state: CacheState, isLoading: boolean): UseExpenseCategoriesResult {
  const byName = new Map<string, ExpenseCategoryRow>()
  for (const r of state.rows) byName.set(r.name, r)
  return {
    categories: state.rows,
    byName,
    names: state.rows.map((r) => r.name),
    fixed: state.rows.filter((r) => r.kind === 'fixed'),
    variable: state.rows.filter((r) => r.kind === 'variable'),
    isLoading,
    source: state.source,
  }
}

export function useExpenseCategories(): UseExpenseCategoriesResult {
  const [state, setState] = useState<CacheState>(cache ?? DEFAULTS)
  const [isLoading, setIsLoading] = useState<boolean>(cache == null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // Not signed in yet — keep defaults, but mark loading false so the
        // page can proceed without a hang.
        if (!cancelled) setIsLoading(false)
        return
      }
      const loaded = await loadOnce(session.user.id)
      if (!cancelled) {
        setState(loaded)
        setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return deriveResult(state, isLoading)
}
