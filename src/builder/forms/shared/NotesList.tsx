// ---------------------------------------------------------------------------
// NotesList — list of free-text note inputs with add/remove
// ---------------------------------------------------------------------------

const INPUT_CLS =
  'flex-1 rounded border border-nhs-grey-4 dark:border-nhs-grey-2 px-2 py-1.5 text-sm ' +
  'text-nhs-grey-1 dark:bg-gray-800 ' +
  'focus:border-nhs-blue focus:outline-none focus:ring-1 focus:ring-nhs-blue'

export interface NotesListProps {
  notes: string[]
  onChange: (notes: string[]) => void
  placeholder?: string
}

export function NotesList({ notes, onChange, placeholder = 'Add a note…' }: NotesListProps) {
  const update = (idx: number, val: string) => {
    const next = [...notes]
    next[idx] = val
    onChange(next)
  }

  const remove = (idx: number) => {
    onChange(notes.filter((_, i) => i !== idx))
  }

  const add = () => onChange([...notes, ''])

  return (
    <div>
      <label className="block text-xs font-medium text-nhs-grey-3 uppercase tracking-wide mb-1">
        Notes
      </label>
      <div className="space-y-1">
        {notes.map((note, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <input
              type="text"
              value={note}
              onChange={e => update(idx, e.target.value)}
              placeholder={placeholder}
              className={INPUT_CLS}
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="shrink-0 text-nhs-red hover:opacity-70 px-1 py-1 transition-opacity"
              title="Remove note"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-1.5 text-xs text-nhs-blue hover:underline"
      >
        + Add note
      </button>
    </div>
  )
}
