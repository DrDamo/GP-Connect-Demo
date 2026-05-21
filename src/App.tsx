import { useState, useCallback } from 'react'
import { FileUpload } from './components/FileUpload'
import { ValidationPanel } from './components/ValidationPanel'
import { RawSourceViewer } from './components/RawSourceViewer'
import { ClinicalView } from './components/clinical/ClinicalView'
import { InspectorView } from './components/InspectorView'
import { parseBundle } from './fhir/parser'
import { validateMedicationsBundle } from './fhir/validator'
import { extractMedications } from './fhir/medications'
import { extractAllergies } from './fhir/allergies'
import { extractProblems } from './fhir/problems'
import { extractConsultations } from './fhir/consultations'
import { extractImmunisations } from './fhir/immunisations'
import { extractInvestigations } from './fhir/investigations'
import { extractReferrals } from './fhir/referrals'
import { extractDiaryEntries } from './fhir/diaryEntries'
import { extractCodedData } from './fhir/codedData'
import { extractDocuments } from './fhir/documents'
import { extractPatientInfo, getOrganisationName } from './fhir/utils'
import type { ValidationResult, GpConnectMedicationsRecord } from './fhir/types'
import sampleBundle from './sample-data/medications-bundle.json'

type ActiveTab = 'clinical' | 'raw' | 'validation' | 'inspector'

interface LoadedBundle {
  source: string
  filename: string
  format: 'json' | 'xml'
  validation: ValidationResult
  record: GpConnectMedicationsRecord
}

export default function App() {
  const [loaded, setLoaded] = useState<LoadedBundle | null>(null)
  const [tab, setTab] = useState<ActiveTab>('clinical')
  const [parseError, setParseError] = useState<string | null>(null)

  const handleLoad = useCallback((text: string, filename: string) => {
    setParseError(null)
    const parsed = parseBundle(text)
    if (!parsed.ok) {
      setParseError(parsed.error)
      return
    }
    const validation = validateMedicationsBundle(parsed.data)
    const record: GpConnectMedicationsRecord = {
      patient: extractPatientInfo(parsed.data),
      practiceOrganisation: getOrganisationName(parsed.data),
      medications: extractMedications(parsed.data),
      allergies: extractAllergies(parsed.data),
      problems: extractProblems(parsed.data),
      consultations: extractConsultations(parsed.data),
      immunisations: extractImmunisations(parsed.data),
      investigations: extractInvestigations(parsed.data),
      referrals: extractReferrals(parsed.data),
      diaryEntries: extractDiaryEntries(parsed.data),
      codedData: extractCodedData(parsed.data),
      documents: extractDocuments(parsed.data),
    }
    setLoaded({ source: text, filename, format: parsed.format, validation, record })
    setTab('clinical')
  }, [])

  const handleLoadSample = useCallback(() => {
    const text = JSON.stringify(sampleBundle, null, 2)
    handleLoad(text, 'medications-bundle.json')
  }, [handleLoad])

  const handleClear = useCallback(() => {
    setLoaded(null)
    setParseError(null)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-nhs-grey-5 overflow-hidden">
      {/* NHS-style header */}
      <header className="bg-nhs-blue text-white shadow-md shrink-0">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* NHS logo mark */}
            <div className="bg-white text-nhs-blue font-extrabold text-sm px-2 py-1 rounded leading-tight">NHS</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">GP Connect Demonstrator</h1>
              <p className="text-xs opacity-75 leading-tight">Access Record Structured · FHIR STU3</p>
            </div>
          </div>
          {loaded && (
            <button
              onClick={handleClear}
              className="text-xs text-white opacity-70 hover:opacity-100 border border-white/40 hover:border-white/80 px-3 py-1.5 rounded transition-all"
            >
              ← Load different file
            </button>
          )}
        </div>
      </header>

      {!loaded ? (
        /* Upload screen */
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-xl space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-nhs-grey-1">Load a GP Connect Bundle</h2>
              <p className="text-sm text-nhs-grey-3 mt-1">
                FHIR STU3 · JSON or XML · Access Record Structured
              </p>
            </div>

            <FileUpload onLoad={handleLoad} />

            {parseError && (
              <div className="p-3 bg-red-50 border border-red-300 rounded text-sm text-nhs-red">
                <strong>Parse error:</strong> {parseError}
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-nhs-grey-4" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-nhs-grey-5 px-3 text-xs text-nhs-grey-3">or</span>
              </div>
            </div>

            <button
              onClick={handleLoadSample}
              className="w-full py-2.5 px-4 border-2 border-nhs-blue text-nhs-blue rounded-lg text-sm font-medium hover:bg-nhs-blue hover:text-white transition-colors"
            >
              Load sample GP Connect Bundle
            </button>

            <p className="text-xs text-center text-nhs-grey-3">
              Supports all clinical domains: Medications, Allergies, Problems, Consultations, Immunisations, Investigations, Referrals, Diary Entries &amp; Coded Data
            </p>
          </div>
        </main>
      ) : (
        /* Main workspace */
        <main className={`flex-1 flex flex-col w-full p-4 gap-4 min-h-0 ${tab !== 'inspector' ? 'max-w-screen-2xl mx-auto' : ''}`}>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-nhs-grey-4">
            {(['clinical', 'inspector', 'raw', 'validation'] as ActiveTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-t transition-colors capitalize ${
                  tab === t
                    ? 'bg-white border border-b-white border-nhs-grey-4 text-nhs-blue -mb-px'
                    : 'text-nhs-grey-2 hover:text-nhs-blue'
                }`}
              >
                {t === 'clinical' ? 'Clinical View' : t === 'raw' ? 'Raw Source' : t === 'validation' ? 'Validation' : 'Inspector'}
                {t === 'validation' && loaded.validation.issues.some(i => i.severity === 'error') && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-nhs-red text-white rounded-full">
                    {loaded.validation.issues.filter(i => i.severity === 'error').length}
                  </span>
                )}
                {t === 'validation' && !loaded.validation.issues.some(i => i.severity === 'error') && loaded.validation.issues.some(i => i.severity === 'warning') && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-nhs-yellow text-nhs-grey-1 rounded-full">
                    {loaded.validation.issues.filter(i => i.severity === 'warning').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div className={`flex-1 min-h-0 ${tab === 'inspector' ? 'overflow-hidden' : 'overflow-auto'}`}>
            {tab === 'clinical' && (
              <div className="bg-white rounded-lg border border-nhs-grey-4 h-full overflow-hidden">
                <ClinicalView record={loaded.record} />
              </div>
            )}

            {tab === 'inspector' && (
              <div className="h-full">
                <InspectorView record={loaded.record} source={loaded.source} format={loaded.format} />
              </div>
            )}

            {tab === 'raw' && (
              <div className="bg-white rounded-lg border border-nhs-grey-4 h-full flex flex-col overflow-hidden">
                <RawSourceViewer source={loaded.source} format={loaded.format} filename={loaded.filename} />
              </div>
            )}

            {tab === 'validation' && (
              <div className="bg-white rounded-lg border border-nhs-grey-4 p-4">
                <ValidationPanel result={loaded.validation} />
              </div>
            )}
          </div>
        </main>
      )}

      <footer className="shrink-0 border-t border-nhs-grey-4 bg-white py-2 px-4">
        <p className="text-xs text-center text-nhs-grey-3">
          GP Connect Demonstrator · FHIR STU3 · Not a clinical system · For testing and demonstration purposes only
        </p>
      </footer>
    </div>
  )
}
