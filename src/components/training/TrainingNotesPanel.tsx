import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { PencilIcon, TrashIcon } from '../../builder/components/Icons'
import { DeleteConfirmDialog } from '../../builder/components/DeleteConfirmDialog'
import type { TrainingNote } from './hooks/useTrainingNotes'

interface Props {
  pageId: string
  notes: TrainingNote[]
  onAdd: (pageId: string, body: string) => Promise<void>
  onUpdate: (id: string, body: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function TrainingNotesPanel({ pageId, notes, onAdd, onUpdate, onDelete }: Props) {
  const { user, profile } = useAuth()
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)

  if (!profile) return null

  const canModify = (note: TrainingNote) => note.created_by === user?.id || profile.role === 'admin'

  const handleAdd = async () => {
    const body = newBody.trim()
    if (!body) return
    setSubmitting(true)
    await onAdd(pageId, body)
    setNewBody('')
    setSubmitting(false)
  }

  const startEdit = (note: TrainingNote) => {
    setEditingId(note.id)
    setEditBody(note.body)
  }

  const saveEdit = async (id: string) => {
    const body = editBody.trim()
    if (!body) return
    await onUpdate(id, body)
    setEditingId(null)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-nhs-grey-4 dark:border-slate-600 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-nhs-grey-1 dark:text-slate-100">
        Notes from your organisation
      </h3>

      {notes.length === 0 && (
        <p className="text-xs text-nhs-grey-3 dark:text-slate-500">No notes yet.</p>
      )}

      <div className="space-y-3">
        {notes.map(note => {
          const author = note.profiles?.display_name ?? note.profiles?.username ?? 'Unknown'
          return (
            <div key={note.id} className="border-b border-nhs-grey-5 dark:border-slate-700 pb-3 last:border-0 last:pb-0">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    className="w-full text-sm border border-nhs-grey-4 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md p-2"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(note.id)}
                      className="text-xs px-3 py-1 rounded bg-nhs-blue text-white hover:bg-nhs-blue-dark"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs px-3 py-1 rounded text-nhs-grey-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-nhs-grey-1 dark:text-slate-200 whitespace-pre-wrap flex-1">{note.body}</p>
                    {canModify(note) && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEdit(note)} className="text-nhs-grey-3 hover:opacity-70 p-0.5" title="Edit note">
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: note.id, label: 'this note' })}
                          className="text-nhs-red hover:opacity-70 p-0.5"
                          title="Delete note"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-nhs-grey-3 dark:text-slate-500 mt-1">
                    {author} · {formatDate(note.created_at)}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        <textarea
          value={newBody}
          onChange={e => setNewBody(e.target.value)}
          placeholder="Add a note for your organisation…"
          className="w-full text-sm border border-nhs-grey-4 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md p-2"
          rows={2}
        />
        <button
          onClick={handleAdd}
          disabled={submitting || !newBody.trim()}
          className="text-xs px-3 py-1.5 rounded bg-nhs-blue text-white hover:bg-nhs-blue-dark disabled:opacity-50"
        >
          Add note
        </button>
      </div>

      {deleteTarget && (
        <DeleteConfirmDialog
          label={deleteTarget.label}
          onConfirm={async () => { await onDelete(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
