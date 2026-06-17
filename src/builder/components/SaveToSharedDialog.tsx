import { useState } from 'react'

interface Props {
  onSave: (name: string, description: string) => void
  onCancel: () => void
}

export function SaveToSharedDialog({ onSave, onCancel }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave(name.trim(), description.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-nhs-grey-4 dark:border-gray-700 w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-nhs-grey-4 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-nhs-grey-1 dark:text-gray-100">Save to Shared Patients</h2>
          <p className="text-xs text-nhs-grey-3 dark:text-gray-500 mt-0.5">This record will be visible to everyone in your organisation.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-nhs-grey-1 dark:text-gray-300 mb-1">
              Record name <span className="text-nhs-red">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith — polypharmacy review"
              autoFocus
              required
              className="w-full rounded border border-nhs-grey-4 dark:border-gray-600 px-3 py-2 text-sm text-nhs-grey-1 dark:text-gray-100 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-nhs-grey-1 dark:text-gray-300 mb-1">
              Description <span className="text-nhs-grey-3 dark:text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Purpose of this record, scenario being demonstrated…"
              rows={3}
              className="w-full rounded border border-nhs-grey-4 dark:border-gray-600 px-3 py-2 text-sm text-nhs-grey-1 dark:text-gray-100 dark:bg-gray-800 focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-nhs-grey-4 dark:border-gray-600 text-nhs-grey-2 dark:text-gray-300 rounded hover:border-nhs-grey-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm bg-nhs-green text-white rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
