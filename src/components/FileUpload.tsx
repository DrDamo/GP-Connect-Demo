import { useCallback } from 'react'
import { useDropzone, type FileWithPath } from 'react-dropzone'
import { isFileSystemAccessSupported } from '../lib/fileHistory'

interface Props {
  /** `fileHandle` is only set where the browser's File System Access API made one
   *  available (Chromium, via the picker or drag-and-drop) — it lets the caller
   *  record a real handle to the file for the "recent files" history panel. */
  onLoad: (text: string, filename: string, fileHandle?: FileSystemFileHandle) => void
}

const PICKER_TYPES = [{ description: 'GP Connect Bundle', accept: { 'application/json': ['.json'], 'application/xml': ['.xml'] } }]

export function FileUpload({ onLoad }: Props) {
  const supportsPicker = isFileSystemAccessSupported()

  const loadFile = useCallback(
    (file: File, fileHandle?: FileSystemFileHandle) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        if (text) onLoad(text, file.name, fileHandle)
      }
      reader.readAsText(file)
    },
    [onLoad]
  )

  const onDrop = useCallback(
    (files: FileWithPath[], _rejections: unknown, event: unknown) => {
      const file = files[0]
      if (!file) return
      // Chromium exposes a real file handle on dropped items too, not just from
      // the picker — grab it when available so this file can later be re-read
      // from disk via the recent-files history, not just reopened from cache.
      const dragEvent = event as DragEvent | undefined
      const item = dragEvent?.dataTransfer?.items?.[0]
      if (item?.getAsFileSystemHandle) {
        item.getAsFileSystemHandle()
          .then(handle => loadFile(file, handle instanceof FileSystemFileHandle ? handle : undefined))
          .catch(() => loadFile(file))
      } else {
        loadFile(file)
      }
    },
    [loadFile]
  )

  const handleBrowseClick = useCallback(async () => {
    if (!supportsPicker || !window.showOpenFilePicker) return
    try {
      const [handle] = await window.showOpenFilePicker({ types: PICKER_TYPES, multiple: false })
      const file = await handle.getFile()
      loadFile(file, handle)
    } catch (err) {
      // AbortError just means the user cancelled the picker.
      if (err instanceof Error && err.name !== 'AbortError') console.error(err)
    }
  }, [supportsPicker, loadFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: supportsPicker,
    accept: { 'application/json': ['.json'], 'application/xml': ['.xml'], 'text/xml': ['.xml'], 'text/plain': ['.json', '.xml'] },
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps(supportsPicker ? { onClick: handleBrowseClick } : {})}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-nhs-blue bg-blue-50' : 'border-nhs-grey-4 hover:border-nhs-blue hover:bg-blue-50'
      }`}
    >
      <input {...getInputProps()} />
      <svg className="mx-auto mb-3 h-10 w-10 text-nhs-grey-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {isDragActive ? (
        <p className="text-nhs-blue font-medium">Drop the file here</p>
      ) : (
        <>
          <p className="font-medium text-nhs-grey-1">Drag &amp; drop a GP Connect Bundle file</p>
          <p className="text-sm text-nhs-grey-3 mt-1">or click to browse &mdash; JSON or XML, FHIR STU3</p>
        </>
      )}
    </div>
  )
}
