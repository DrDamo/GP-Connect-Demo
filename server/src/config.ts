import { config as loadDotenv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

loadDotenv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Copy server/.env.example to server/.env and fill in your credentials.`,
    )
  }
  return value
}

function positiveInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const config = {
  clientId: required('NHS_CLIENT_ID'),
  clientSecret: required('NHS_CLIENT_SECRET'),
  fhirBase: (process.env.NHS_FHIR_BASE ?? 'https://ontology.nhs.uk/production1/fhir').replace(/\/$/, ''),
  tokenUrl: process.env.NHS_TOKEN_URL ?? 'https://ontology.nhs.uk/authorisation/auth/realms/nhs-digital-terminology/protocol/openid-connect/token',
  port: positiveInt('PORT', 3001),
  /** Interface to listen on. Loopback by default: put a reverse proxy in front
   *  rather than exposing this process directly. */
  host: process.env.HOST || '127.0.0.1',
  /** Browser origins allowed to call the proxy cross-origin (comma-separated).
   *  Leave empty when the frontend is served from the same origin. */
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',').map(o => o.trim()).filter(Boolean),
  /** Express `trust proxy` setting — set to the number of reverse-proxy hops
   *  (e.g. 1 behind nginx) so rate limiting sees real client IPs. */
  trustProxy: positiveInt('TRUST_PROXY', 0),
  rateLimitWindowMs: positiveInt('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMax: positiveInt('RATE_LIMIT_MAX', 120),
}
