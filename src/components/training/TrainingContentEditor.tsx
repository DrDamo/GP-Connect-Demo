import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { BuilderModal } from '../../builder/components/BuilderModal'
import { MarkdownContent } from './MarkdownContent'
import { TrainingMarkdownEditor } from './TrainingMarkdownEditor'

interface Props {
  pageId: string
  title: string
  initialContent: string
  hasOverride: boolean
  onSaved: () => void
  onReverted: () => void
  onClose: () => void
}

export function TrainingContentEditor({ pageId, title, initialContent, hasOverride, onSaved, onReverted, onClose }: Props) {
  const { profile } = useAuth()
  const [draftContent, setDraftContent] = useState(initialContent)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const doSave = useCallback(async () => {
    if (!supabase || !profile) { setSaveError('Your profile has not loaded — try refreshing the page.'); return }
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    if (!hasOverride) {
      const { error } = await supabase
        .from('training_content')
        .insert({ page_id: pageId, content: draftContent, version: 1, updated_by: profile.id })
      if (error) setSaveError(error.message)
      else {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        onSaved()
      }
    } else {
      const { error } = await supabase
        .from('training_content')
        .update({ content: draftContent, updated_by: profile.id })
        .eq('page_id', pageId)
      if (error) setSaveError(error.message)
      else {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        onSaved()
      }
    }
    setSaving(false)
  }, [profile, hasOverride, pageId, draftContent, onSaved])

  const doRevert = useCallback(async () => {
    if (!supabase) return
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('training_content').delete().eq('page_id', pageId)
    setSaving(false)
    if (error) setSaveError(error.message)
    else onReverted()
  }, [pageId, onReverted])

  return (
    <BuilderModal title={`Edit training page — ${title}`} onDone={doSave} onCancel={onClose} size="full">
      <div className="space-y-3">
        {saveError && (
          <p className="text-sm text-[var(--nhs-red,#DA291C)]">{saveError}</p>
        )}
        {saveSuccess && (
          <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>
        )}

        <div className="flex items-center justify-between">
          <div className="md:hidden flex gap-1">
            <button
              type="button"
              onClick={() => setTab('edit')}
              className={`px-3 py-1 rounded text-xs font-medium ${tab === 'edit' ? 'bg-nhs-blue text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`px-3 py-1 rounded text-xs font-medium ${tab === 'preview' ? 'bg-nhs-blue text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
            >
              Preview
            </button>
          </div>
          {hasOverride && (
            <button
              type="button"
              onClick={doRevert}
              disabled={saving}
              className="ml-auto text-xs text-nhs-red hover:underline disabled:opacity-50"
            >
              Revert to default
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 h-[72vh]">
          <div className={`${tab === 'edit' ? 'block' : 'hidden'} md:block border border-nhs-grey-4 dark:border-gray-700 rounded-md overflow-hidden h-full`}>
            <TrainingMarkdownEditor source={draftContent} onChange={setDraftContent} />
          </div>
          <div className={`${tab === 'preview' ? 'block' : 'hidden'} md:block overflow-y-auto h-full border border-nhs-grey-4 dark:border-gray-700 rounded-md p-4`}>
            <MarkdownContent content={draftContent} />
          </div>
        </div>
      </div>
    </BuilderModal>
  )
}
