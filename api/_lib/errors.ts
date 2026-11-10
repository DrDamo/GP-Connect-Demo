import type { VercelResponse } from '@vercel/node'

/** A non-2xx response from the NHS terminology server or its token endpoint.
 *  `message` carries the upstream body for server logs only. */
export class UpstreamError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'UpstreamError'
    this.status = status
  }
}

/**
 * Logs the full upstream failure and sends the browser a generic 502. The
 * upstream body is never forwarded: it can echo request details or describe
 * the OAuth client, and callers only need to know the request failed.
 */
export function sendUpstreamError(res: VercelResponse, tag: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err)
  console.error(`[${tag}]`, detail)
  const error = err instanceof UpstreamError
    ? `The terminology server request failed (HTTP ${err.status})`
    : 'The terminology server request failed'
  res.status(502).json({ error })
}
