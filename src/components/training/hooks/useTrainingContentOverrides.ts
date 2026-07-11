import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../auth/AuthContext'

export interface TrainingContentOverride {
  page_id: string
  content: string
  version: number
  updated_at: string
}

export function useTrainingContentOverrides() {
  const { user } = useAuth()
  const [overrides, setOverrides] = useState<Record<string, TrainingContentOverride>>({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!supabase || !user) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('training_content')
      .select('page_id, content, version, updated_at')
    const byPage: Record<string, TrainingContentOverride> = {}
    for (const row of (data ?? []) as TrainingContentOverride[]) {
      byPage[row.page_id] = row
    }
    setOverrides(byPage)
    setLoading(false)
  }, [user])

  useEffect(() => { refetch() }, [refetch])

  return { overrides, loading, refetch }
}
