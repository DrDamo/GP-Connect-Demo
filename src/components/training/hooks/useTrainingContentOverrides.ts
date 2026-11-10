import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../lib/api'
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
    if (!user) { setLoading(false); return }
    setLoading(true)
    let data: TrainingContentOverride[] = []
    try {
      data = await api.get<TrainingContentOverride[]>('/training-content')
    } catch { /* fall back to the built-in content */ }
    const byPage: Record<string, TrainingContentOverride> = {}
    for (const row of data) {
      byPage[row.page_id] = row
    }
    setOverrides(byPage)
    setLoading(false)
  }, [user])

  useEffect(() => { refetch() }, [refetch])

  return { overrides, loading, refetch }
}
