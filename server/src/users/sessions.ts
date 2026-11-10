import { createHash, randomBytes } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { config } from '../config.js'
import { owner } from '../db.js'

// Cookie sessions. The cookie holds 32 random bytes; the database stores only
// their SHA-256, so a leaked sessions table can't be replayed.

/** __Host- pins the cookie to this exact host over HTTPS with Path=/. */
const COOKIE = config.secureCookies ? '__Host-gpc_session' : 'gpc_session'
const DAY_MS = 86_400_000
/** Extend a session's expiry at most this often, to save a write per request. */
const TOUCH_INTERVAL_MS = 3_600_000

export const hashToken = (token: string): Buffer => createHash('sha256').update(token).digest()
export const newToken = (): string => randomBytes(32).toString('base64url')

function readCookie(req: Request): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === COOKIE) return part.slice(eq + 1).trim() || null
  }
  return null
}

function setCookie(res: Response, value: string, maxAgeMs: number): void {
  const attrs = [
    `${COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ]
  if (config.secureCookies) attrs.push('Secure')
  res.append('Set-Cookie', attrs.join('; '))
}

export async function startSession(res: Response, userId: string): Promise<void> {
  const token = newToken()
  const ttl = config.sessionDays * DAY_MS
  await owner.query(
    'insert into auth.sessions (token_hash, user_id, expires_at) values ($1, $2, now() + $3 * interval \'1 millisecond\')',
    [hashToken(token), userId, ttl],
  )
  setCookie(res, token, ttl)
  // Housekeeping: drop expired sessions now and then.
  if (Math.random() < 0.05) {
    owner.query('delete from auth.sessions where expires_at < now()').catch(() => {})
  }
}

export async function endSession(req: Request, res: Response): Promise<void> {
  const token = readCookie(req)
  if (token) await owner.query('delete from auth.sessions where token_hash = $1', [hashToken(token)])
  setCookie(res, '', 0)
}

/** Ends every session of a user except, optionally, the current one. */
export async function endOtherSessions(userId: string, req?: Request): Promise<void> {
  const token = req ? readCookie(req) : null
  await owner.query(
    'delete from auth.sessions where user_id = $1 and ($2::bytea is null or token_hash <> $2)',
    [userId, token ? hashToken(token) : null],
  )
}

/** The signed-in user's id, or null. Slides the expiry forward on use. */
export async function sessionUser(req: Request, res: Response): Promise<string | null> {
  const token = readCookie(req)
  if (!token) return null
  const hash = hashToken(token)
  const { rows } = await owner.query<{ user_id: string; last_seen_at: Date }>(
    'select user_id, last_seen_at from auth.sessions where token_hash = $1 and expires_at > now()',
    [hash],
  )
  const session = rows[0]
  if (!session) return null
  if (Date.now() - session.last_seen_at.getTime() > TOUCH_INTERVAL_MS) {
    const ttl = config.sessionDays * DAY_MS
    await owner.query(
      'update auth.sessions set last_seen_at = now(), expires_at = now() + $2 * interval \'1 millisecond\' where token_hash = $1',
      [hash, ttl],
    )
    setCookie(res, token, ttl)
  }
  return session.user_id
}

/** Rejects unauthenticated requests; puts the user id in res.locals.userId. */
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await sessionUser(req, res)
    if (!userId) {
      res.status(401).json({ error: 'Sign in required' })
      return
    }
    res.locals.userId = userId
    next()
  } catch (err) {
    next(err)
  }
}
