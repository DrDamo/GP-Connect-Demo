import { config } from './config'
import { UpstreamError } from './errors'

interface TokenCache {
  token: string
  expiresAt: number
}

let cached: TokenCache | null = null

export async function getToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 30_000) {
    return cached.token
  }

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

  const json = await res.json() as { access_token: string; expires_in: number }
  cached = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return cached.token
}
