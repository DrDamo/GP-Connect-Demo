function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const config = {
  clientId: required('NHS_CLIENT_ID'),
  clientSecret: required('NHS_CLIENT_SECRET'),
  fhirBase: (process.env.NHS_FHIR_BASE ?? 'https://ontology.nhs.uk/production1/fhir').replace(/\/$/, ''),
  tokenUrl: process.env.NHS_TOKEN_URL ?? 'https://ontology.nhs.uk/authorisation/auth/realms/nhs-digital-terminology/protocol/openid-connect/token',
}
