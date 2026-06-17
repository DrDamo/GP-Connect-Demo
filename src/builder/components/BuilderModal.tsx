import { useEffect, useState } from 'react'

interface BuilderModalProps {
  title: string
  onDone: () => void
  onCancel: () => void
  children: React.ReactNode
  size?: 'md' | 'lg' | 'xl'
}

export function BuilderModal({ title, onDone, onCancel, children, size = 'lg' }: BuilderModalProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const requestCancel = () => setConfirmDiscard(true)
  const confirmCancel = () => { setConfirmDiscard(false); onCancel() }
  const keepEditing = () => setConfirmDiscard(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setConfirmDiscard(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const maxW = size === 'xl' ? 'max-w-3xl' : size === 'md' ? 'max-w-lg' : 'max-w-2xl'

  return (
    // Backdrop — click does nothing (modal is locked)
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div
        className={`bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full ${maxW} my-4`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={requestCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded p-1 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {children}
        </div>

        {/* Footer — normal or discard-confirm */}
        {confirmDiscard ? (
          <div className="px-4 py-3 border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-b-xl">
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-3 font-medium">
              Discard changes? Any unsaved edits will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={keepEditing}
                className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={requestCancel}
              className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDone}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-[var(--nhs-blue,#005EB8)] hover:bg-[var(--nhs-blue-dark,#003D78)] transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
