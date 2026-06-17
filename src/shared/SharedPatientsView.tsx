import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { TrashIcon } from '../builder/components/Icons'
import { DeleteConfirmDialog } from '../builder/components/DeleteConfirmDialog'
import type { DraftRecord } from '../builder/types'

interface PatientRow {
  id: string
  name: string | null
  description: string | null
  version: number
  patient_name: string | null
  nhs_number: string | null
  created_at: string
  updated_at: string
  profiles: { username: string; display_name: string | null } | null
}

interface Props {
  onLoadDraft: (draft: DraftRecord, id: string, version: number) => void
}

export function SharedPatientsView({ onLoadDraft }: Props) {
  const { profile } = useAuth()
  const [rows, setRows] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    if (!supabase || !profile) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('patient_drafts')
      .select('id, name, description, version, patient_name, nhs_number, created_at, updated_at, profiles(username, display_name)')
      .order('updated_at', { ascending: false })
    if (err) setError(err.message)
    else setRows((data ?? []) as unknown as PatientRow[])
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchRows() }, [fetchRows])

  const handleLoad = async (id: string) => {
    if (!supabase) return
    setLoadingId(id)
    const { data, error: err } = await supabase
      .from('patient_drafts')
      .select('draft_data, version')
      .eq('id', id)
      .single()
    setLoadingId(null)
    if (err || !data?.draft_data) return
    onLoadDraft(data.draft_data as DraftRecord, id, data.version as number)
  }

  const handleDeleteConfirm = async () => {
    if (!supabase || !deleteTarget) return
    await supabase.from('patient_drafts').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    fetchRows()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-nhs-grey-4 dark:border-gray-700 shrink-0">
        <h2 className="text-sm font-semibold text-nhs-grey-1 dark:text-gray-100">
          Shared Patients
        </h2>
        <button onClick={fetchRows} className="text-xs text-nhs-blue hover:underline">
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <p className="text-sm text-nhs-grey-3 dark:text-gray-500 py-8 text-center">Loading…</p>
        ) : error ? (
          <p className="text-sm text-nhs-red py-8 text-center">Error: {error}</p>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-nhs-grey-3 dark:text-gray-500">
            <p className="text-sm">No shared patients yet.</p>
            <p className="text-xs mt-1">Use the Record Builder to create a patient and save them to the shared area.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(row => {
              const creator = row.profiles?.display_name ?? row.profiles?.username ?? null
              return (
                <div
                  key={row.id}
                  className="bg-white dark:bg-gray-900 border border-nhs-grey-4 dark:border-gray-700 rounded-lg px-4 py-3"
                >
                  {/* Name + actions row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-nhs-grey-1 dark:text-gray-100 truncate">
                        {row.name || <span className="italic font-normal text-nhs-grey-3">Untitled record</span>}
                      </p>
                      {row.description && (
                        <p className="text-xs text-nhs-grey-2 dark:text-gray-300 mt-0.5 line-clamp-2">
                          {row.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleLoad(row.id)}
                        disabled={loadingId === row.id}
                        className="text-xs border border-nhs-blue text-nhs-blue px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                      >
                        {loadingId === row.id ? 'Loading…' : 'Load into builder'}
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: row.id, name: row.name || 'this record' })}
                        className="text-nhs-red hover:opacity-70 p-0.5"
                        title="Delete record"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  {/* Meta row */}
                  <p className="text-xs text-nhs-grey-3 dark:text-gray-500 mt-1.5 flex flex-wrap gap-x-3">
                    <span className="font-medium text-nhs-grey-2 dark:text-gray-400">v{row.version}</span>
                    {row.patient_name && <span>Patient: {row.patient_name}</span>}
                    {row.nhs_number && <span>NHS: {row.nhs_number}</span>}
                    <span>
                      {new Date(row.updated_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                    {creator && <span>by {creator}</span>}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmDialog
          label={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
