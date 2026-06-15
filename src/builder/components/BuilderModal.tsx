import { useEffect } from 'react'

interface BuilderModalProps {
  title: string
  onDone: () => void
  onCancel: () => void
  children: React.ReactNode
  size?: 'md' | 'lg' | 'xl'
}

export function BuilderModal({ title, onDone, onCancel, children, size = 'lg' }: BuilderModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  const maxW = size === 'xl' ? 'max-w-3xl' : 'max-w-2xl'

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4"
      onClick={onCancel}
    >
      <div
        className={`bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full ${maxW} my-4`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded p-1 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {children}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-[var(--nhs-blue,#005EB8)] hover:bg-[var(--nhs-blue-dark,#003D78)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
