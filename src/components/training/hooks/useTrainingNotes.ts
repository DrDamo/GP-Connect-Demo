import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
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
    if (!supabase || !profile) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('training_notes')
      .select('id, org_id, page_id, created_by, body, created_at, updated_at, profiles(username, display_name)')
      .order('created_at', { ascending: true })
    const grouped: Record<string, TrainingNote[]> = {}
    for (const row of (data ?? []) as unknown as TrainingNote[]) {
      (grouped[row.page_id] ??= []).push(row)
    }
    setNotesByPage(grouped)
    setLoading(false)
  }, [profile])

  useEffect(() => { refetch() }, [refetch])

  const addNote = useCallback(async (pageId: string, body: string) => {
    if (!supabase || !profile) return
    await supabase.from('training_notes').insert({
      page_id: pageId,
      org_id: profile.org_id,
      created_by: profile.id,
      body,
    })
    await refetch()
  }, [profile, refetch])

  const updateNote = useCallback(async (id: string, body: string) => {
    if (!supabase) return
    await supabase.from('training_notes').update({ body }).eq('id', id)
    await refetch()
  }, [refetch])

  const deleteNote = useCallback(async (id: string) => {
    if (!supabase) return
    await supabase.from('training_notes').delete().eq('id', id)
    await refetch()
  }, [refetch])

  return { notesByPage, loading, refetch, addNote, updateNote, deleteNote }
}
