// Minimal STU3 bundle builders for parser tests. Resources are typed loosely
// on purpose: GP Connect profiles add fields @types/fhir's base STU3 lacks.
export const SCT = 'http://snomed.info/sct'

export function bundle(...resources: Record<string, unknown>[]): fhir3.Bundle {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: resources.map(resource => ({ resource: resource as unknown as fhir3.Resource })),
  }
}

export function sct(code: string, display?: string): fhir3.Coding {
  return { system: SCT, code, ...(display ? { display } : {}) }
}
