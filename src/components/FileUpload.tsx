import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface Props {
  onLoad: (text: string, filename: string) => void
}

export function FileUpload({ onLoad }: Props) {
  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        if (text) onLoad(text, file.name)
      }
      reader.readAsText(file)
    },
    [onLoad]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'], 'application/xml': ['.xml'], 'text/xml': ['.xml'], 'text/plain': ['.json', '.xml'] },
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
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
