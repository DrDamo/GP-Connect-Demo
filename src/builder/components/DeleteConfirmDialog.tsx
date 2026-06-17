import { useEffect } from 'react'

interface DeleteConfirmDialogProps {
  label: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({ label, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete item?</h2>
        </div>

        <div className="px-5 py-4 space-y-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to delete &ldquo;{label}&rdquo;? This cannot be undone.
          </p>
          <p className="text-sm text-[var(--nhs-red,#DA291C)] dark:text-red-400 font-medium">
            This is not a normal GP system function - it will leave no trace.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-[var(--nhs-red,#DA291C)] hover:bg-[var(--nhs-red-dark,#ad1f15)] transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
