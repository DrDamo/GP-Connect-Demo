// Eagerly-loaded registry of the FHIR example files referenced throughout the
// training guides (`fhir_examples/foo.json` in the markdown). Built at bundle
// time so the training UI can show/preview/load them without end users needing
// filesystem access to the repo.
const modules = import.meta.glob('../../training-content/fhir_examples/*.json', { eager: true })

export const FHIR_EXAMPLES: Record<string, unknown> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => {
    const filename = path.split('/').pop()!
    const data = (mod as { default: unknown }).default
    return [filename, data]
  })
)

export function getFhirExample(filename: string): unknown | undefined {
  return FHIR_EXAMPLES[filename]
}
