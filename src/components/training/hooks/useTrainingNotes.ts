import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../auth/AuthContext'

export interface TrainingNote {
  id: string
  org_id: string
  page_id: string
  created_by: string
  body: string
  created_at: string
  updated_at: string
  profiles: { username: string; display_name: string | null } | null
}

export function useTrainingNotes() {
  const { profile } = useAuth()
  const [notesByPage, setNotesByPage] = useState<Record<string, TrainingNote[]>>({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    setLoading(true)
    let data: TrainingNote[] = []
    try {
      data = await api.get<TrainingNote[]>('/training-notes')
    } catch { /* shown as no notes; the panel stays usable */ }
    const grouped: Record<string, TrainingNote[]> = {}
    for (const row of data) {
      (grouped[row.page_id] ??= []).push(row)
    }
    setNotesByPage(grouped)
    setLoading(false)
  }, [profile])

  useEffect(() => { refetch() }, [refetch])

  const addNote = useCallback(async (pageId: string, body: string) => {
    if (!profile) return
    try {
      await api.post('/training-notes', { page_id: pageId, body })
    } finally {
      await refetch()
    }
  }, [profile, refetch])

  const updateNote = useCallback(async (id: string, body: string) => {
    try {
      await api.patch(`/training-notes/${id}`, { body })
    } finally {
      await refetch()
    }
  }, [refetch])

  const deleteNote = useCallback(async (id: string) => {
    try {
      await api.delete(`/training-notes/${id}`)
    } finally {
      await refetch()
    }
  }, [refetch])

  return { notesByPage, loading, refetch, addNote, updateNote, deleteNote }
}
