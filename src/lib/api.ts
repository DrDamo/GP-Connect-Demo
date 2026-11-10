// Client for the app's own backend (server/): sign-in, shared patients,
// training content and per-user settings. The session is an HttpOnly cookie,
// so nothing here handles tokens; same-origin requests send it automatically.

/** Sign-in and the shared features need the backend. A static build without
 *  one (e.g. a GitHub Pages demo) sets VITE_AUTH=off and runs signed-out. */
export const isAuthEnabled = import.meta.env.VITE_AUTH !== 'off'

export class ApiError extends Error {
  readonly status: number
  readonly body: Record<string, unknown>
  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${base}/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let json: unknown = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const obj = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
    const message = typeof obj.error === 'string' ? obj.error : `Request failed (HTTP ${res.status})`
    throw new ApiError(res.status, message, obj)
  }
  return json as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}

/** A user-facing message for a failed call. */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.'
