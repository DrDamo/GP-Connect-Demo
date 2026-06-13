export interface FhirDesignation {
  language?: string
  use?: {
    system: string
    code: string
    display?: string
  }
  value: string
}

export interface FhirContains {
  system?: string
  version?: string
  code: string
  display: string
  designation?: FhirDesignation[]
  contains?: FhirContains[]
}

export interface FhirValueSetExpansion {
  resourceType: 'ValueSet'
  expansion?: {
    total?: number
    contains?: FhirContains[]
  }
}
