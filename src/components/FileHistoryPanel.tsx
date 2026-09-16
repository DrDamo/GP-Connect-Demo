import { useCallback, useEffect, useState } from 'react'
import {
  isFileSystemAccessSupported,
  listFileHistory,
  removeFileHistoryEntry,
  subscribeFileHistory,
  touchFileHistoryEntry,
  type FileHistoryEntry,
} from '../lib/fileHistory'

interface Props {
  onOpen: (text: string, filename: string, label?: string) => void
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function FileHistoryPanel({ onOpen }: Props) {
  const [entries, setEntries] = useState<FileHistoryEntry[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const supportsPicker = isFileSystemAccessSupported()

  const refresh = useCallback(() => {
    listFileHistory().then(setEntries).catch(() => setEntries([]))
  }, [])

  useEffect(() => {
    refresh()
    return subscribeFileHistory(refresh)
  }, [refresh])

  const setErrorFor = (id: string, message: string | null) => {
    setErrors(prev => {
      if (message === null) {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: message }
    })
  }

  const handleOpenFromCache = (entry: FileHistoryEntry) => {
    if (!entry.content) return
    setErrorFor(entry.id, null)
    onOpen(entry.content, entry.filename, entry.label)
    void touchFileHistoryEntry(entry.id)
  }

  const handleOpenFromFile = async (entry: FileHistoryEntry) => {
    const handle = entry.fileHandle
    if (!handle) return
    setBusyId(entry.id)
    setErrorFor(entry.id, null)
    try {
      if (handle.queryPermission) {
        let state = await handle.queryPermission({ mode: 'read' })
        if (state !== 'granted' && handle.requestPermission) {
          state = await handle.requestPermission({ mode: 'read' })
        }
        if (state !== 'granted') {
          setErrorFor(entry.id, 'Permission denied for this file.')
          return
        }
      }
      const file = await handle.getFile()
      const text = await file.text()
      onOpen(text, file.name, entry.label)
      void touchFileHistoryEntry(entry.id, { content: text, filename: file.name })
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotFoundError') {
        setErrorFor(entry.id, 'File not found — it may have been moved or deleted.')
      } else if (name === 'NotAllowedError') {
        setErrorFor(entry.id, 'Permission denied for this file.')
      } else {
        setErrorFor(entry.id, 'Could not reopen this file.')
      }
    } finally {
      setBusyId(null)
    }
  }

  if (entries.length === 0) return null

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-nhs-grey-4 dark:border-gray-700 p-6 space-y-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-nhs-blue flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-nhs-grey-1 dark:text-gray-100">Recent files</h3>
          <p className="text-xs text-nhs-grey-3 dark:text-gray-500">
            Reopen a cached copy instantly, or re-read the file from disk where your browser allows it
          </p>
        </div>
      </div>

      <ul className="divide-y divide-nhs-grey-4 dark:divide-gray-700 -mx-6 px-6 max-h-72 overflow-y-auto">
        {entries.map(entry => {
          const canOpenFromFile = supportsPicker && !!entry.fileHandle
          const canOpenFromCache = !!entry.content
          const error = errors[entry.id]
          return (
            <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-7 h-7 rounded bg-nhs-grey-5 dark:bg-gray-800 text-nhs-grey-2 dark:text-gray-400 flex items-center justify-center">
                  {entry.source === 'paste' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-nhs-grey-1 dark:text-gray-100 truncate">{entry.label}</p>
                  <p className="text-xs text-nhs-grey-3 dark:text-gray-500">{formatRelativeTime(entry.openedAt)}</p>
                  {error && <p className="text-xs text-nhs-red dark:text-red-400 mt-0.5">{error}</p>}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canOpenFromCache && (
                    <button
                      onClick={() => handleOpenFromCache(entry)}
                      disabled={busyId === entry.id}
                      className="py-1.5 px-3 border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded-lg text-xs font-medium hover:border-nhs-blue hover:text-nhs-blue transition-colors disabled:opacity-40"
                    >
                      Open from Cache
                    </button>
                  )}
                  {canOpenFromFile && (
                    <button
                      onClick={() => handleOpenFromFile(entry)}
                      disabled={busyId === entry.id}
                      className="py-1.5 px-3 bg-nhs-blue text-white rounded-lg text-xs font-medium hover:bg-nhs-dark-blue transition-colors disabled:opacity-40"
                    >
                      {busyId === entry.id ? 'Opening…' : 'Open from File'}
                    </button>
                  )}
                  <button
                    onClick={() => void removeFileHistoryEntry(entry.id)}
                    aria-label={`Remove ${entry.label} from recent files`}
                    className="p-1.5 text-nhs-grey-3 dark:text-gray-500 hover:text-nhs-red rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
