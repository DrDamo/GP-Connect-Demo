import { config } from './config.js'
import { UpstreamError } from './errors.js'

interface TokenCache {
  token: string
  expiresAt: number // ms since epoch
}

let cached: TokenCache | null = null
// Concurrent callers share one in-flight exchange instead of each requesting
// a token when the cache is empty or expired.
let pending: Promise<string> | null = null

async function exchangeToken(): Promise<string> {
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new UpstreamError(res.status, `OAuth2 token exchange failed (HTTP ${res.status}): ${text}`)
  }

  const json = (await res.json()) as { access_token: string; expires_in: number }
  cached = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return cached.token
}

export async function getToken(): Promise<string> {
  // Refresh 30 s before expiry to avoid clock-edge failures
  if (cached && Date.now() < cached.expiresAt - 30_000) {
    return cached.token
  }
  pending ??= exchangeToken().finally(() => { pending = null })
  return pending
}
