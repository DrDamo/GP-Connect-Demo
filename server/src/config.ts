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

const isProduction = process.env.NODE_ENV === 'production'

/** The site's public address, e.g. https://gpc.drdamo.me.uk. Used for links
 *  in emails, the Origin check on writes and the cookie's Secure flag. */
const publicUrl = (process.env.PUBLIC_URL || (isProduction ? '' : 'http://localhost:5173')).replace(/\/$/, '')
if (!publicUrl) throw new Error('Missing required environment variable: PUBLIC_URL')

export const config = {
  isProduction,
  clientId: required('NHS_CLIENT_ID'),
  clientSecret: required('NHS_CLIENT_SECRET'),
  fhirBase: (process.env.NHS_FHIR_BASE ?? 'https://ontology.nhs.uk/production1/fhir').replace(/\/$/, ''),
  tokenUrl: process.env.NHS_TOKEN_URL ?? 'https://ontology.nhs.uk/authorisation/auth/realms/nhs-digital-terminology/protocol/openid-connect/token',
  databaseUrl: required('DATABASE_URL'),
  publicUrl,
  publicOrigin: new URL(publicUrl).origin,
  /** Secure cookies need HTTPS; local development runs on plain http. */
  secureCookies: publicUrl.startsWith('https://'),
  sessionDays: positiveInt('SESSION_DAYS', 7),
  /** Built frontend to serve (the container sets this). Unset in development,
   *  where Vite serves the frontend and proxies /api here. */
  staticDir: process.env.STATIC_DIR || '',
  gitCommitSha: process.env.GIT_COMMIT_SHA || 'dev',
  /** Self-service signup needs email confirmation, so it is off without SMTP
   *  (outside development, where the link is logged instead). */
  smtp: process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: positiveInt('SMTP_PORT', 587),
        user: process.env.SMTP_USER ?? '',
        password: process.env.SMTP_PASSWORD ?? '',
        from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
      }
    : null,
  port: positiveInt('PORT', 3001),
  /** Interface to listen on. Loopback by default; the container sets 0.0.0.0
   *  so Caddy can reach it over the Docker network. */
  host: process.env.HOST || '127.0.0.1',
  /** Browser origins allowed to call the API cross-origin (comma-separated).
   *  Leave empty when the frontend is served from the same origin. */
  corsOrigins: (process.env.CORS_ORIGINS ?? (isProduction ? '' : 'http://localhost:5173'))
    .split(',').map(o => o.trim()).filter(Boolean),
  /** Express `trust proxy` setting: the number of reverse-proxy hops (1
   *  behind Caddy), so rate limiting and secure cookies see the real client. */
  trustProxy: positiveInt('TRUST_PROXY', 0),
  rateLimitWindowMs: positiveInt('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMax: positiveInt('RATE_LIMIT_MAX', 120),
  /** Sign-in attempts per account per 15 minutes (per IP: twice this). */
  loginRateMax: positiveInt('LOGIN_RATE_MAX', 10),
}
