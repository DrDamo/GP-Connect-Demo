import { Router } from 'express'
import { config } from '../config.js'
import { owner } from '../db.js'
import { rateLimit } from '../rateLimit.js'
import { startSession, endSession, endOtherSessions, requireUser, hashToken, newToken } from './sessions.js'
import { hashPassword, verifyPassword, passwordProblem } from './passwords.js'
import { canSendMail, sendConfirmationEmail } from './mail.js'
import { loadMe } from './me.js'

export const authRouter = Router()

const FIFTEEN_MIN = 15 * 60_000
/** Brute-force limits: per client IP, and per account across all IPs. */
const loginByIp = rateLimit({ windowMs: FIFTEEN_MIN, max: config.loginRateMax * 2 })
const loginByAccount = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: config.loginRateMax,
  key: req => `acct:${normaliseIdentifier(req.body?.identifier)}`,
})
const signupByIp = rateLimit({ windowMs: 60 * 60_000, max: 5 })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONFIRM_TTL_HOURS = 24

/** Admin-provisioned accounts sign in with a username, which maps to a
 *  synthetic address (username@gpc-demo.local); signups use a real email. */
function normaliseIdentifier(identifier: unknown): string {
  if (typeof identifier !== 'string') return ''
  const id = identifier.trim().toLowerCase().slice(0, 320)
  return id.includes('@') ? id : `${id}@gpc-demo.local`
}

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

// POST /api/auth/login  { identifier, password }
authRouter.post('/login', loginByIp, loginByAccount, async (req, res, next) => {
  try {
    const email = normaliseIdentifier(req.body?.identifier)
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const { rows } = await owner.query<{ id: string; password_hash: string; email_confirmed_at: Date | null }>(
      'select id, password_hash, email_confirmed_at from auth.users where email = $1',
      [email],
    )
    const user = rows[0]
    if (!email || !password || !(await verifyPassword(password, user?.password_hash))) {
      res.status(401).json({ error: 'Invalid email/username or password.' })
      return
    }
    if (!user.email_confirmed_at) {
      res.status(403).json({ error: 'Confirm your email address first: use the link we sent you.' })
      return
    }
    await startSession(res, user.id)
    res.json(await loadMe(user.id))
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/logout
authRouter.post('/logout', async (req, res, next) => {
  try {
    await endSession(req, res)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me — the signed-in user, or 401
authRouter.get('/me', requireUser, async (_req, res, next) => {
  try {
    const me = await loadMe(res.locals.userId)
    if (!me) {
      res.status(401).json({ error: 'Sign in required' })
      return
    }
    res.json(me)
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/signup  { email, password, displayName, orgName }
//
// Creates the account, a new organisation and an admin-less 'staff' profile
// (as Supabase's handle_new_user trigger did), then emails a confirmation
// link. An address that is already registered gets the same response, so the
// form can't be used to discover accounts.
authRouter.post('/signup', signupByIp, async (req, res, next) => {
  try {
    if (!canSendMail()) {
      res.status(503).json({ error: 'Sign-up is not available at the moment.' })
      return
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(email) || email.length > 320 || email.endsWith('@gpc-demo.local')) {
      res.status(400).json({ error: 'Please enter a valid email address.' })
      return
    }
    const problem = passwordProblem(req.body?.password)
    if (problem) {
      res.status(400).json({ error: problem })
      return
    }
    const displayName = text(req.body?.displayName, 200)
    const orgName = text(req.body?.orgName, 200) ?? `${email.split('@')[0]}'s Workspace`
    const passwordHash = await hashPassword(req.body.password)
    const token = newToken()

    const created = await owner.transaction(async db => {
      const existing = await db.query<{ id: string; email_confirmed_at: Date | null }>(
        'select id, email_confirmed_at from auth.users where email = $1', [email])
      if (existing.rows[0]) {
        // Unconfirmed: send a fresh link. Confirmed: say nothing.
        if (existing.rows[0].email_confirmed_at) return false
        await db.query("delete from auth.email_tokens where user_id = $1 and purpose = 'confirm_email'", [existing.rows[0].id])
        await db.query(
          `insert into auth.email_tokens (token_hash, user_id, purpose, expires_at)
           values ($1, $2, 'confirm_email', now() + interval '${CONFIRM_TTL_HOURS} hours')`,
          [hashToken(token), existing.rows[0].id])
        return true
      }
      const { rows: [user] } = await db.query<{ id: string }>(
        `insert into auth.users (email, password_hash, raw_user_meta_data)
         values ($1, $2, jsonb_build_object('self_signup', 'true')) returning id`,
        [email, passwordHash])
      const { rows: [org] } = await db.query<{ id: string }>(
        'insert into public.organisations (name) values ($1) returning id', [orgName])
      await db.query(
        `insert into public.profiles (id, username, display_name, org_id, role)
         values ($1, $2, $3, $4, 'staff')`,
        [user.id, email, displayName, org.id])
      await db.query(
        `insert into auth.email_tokens (token_hash, user_id, purpose, expires_at)
         values ($1, $2, 'confirm_email', now() + interval '${CONFIRM_TTL_HOURS} hours')`,
        [hashToken(token), user.id])
      return true
    })

    if (created) {
      await sendConfirmationEmail(email, `${config.publicUrl}/api/auth/confirm?token=${encodeURIComponent(token)}`)
    }
    res.status(202).json({ needsConfirmation: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/confirm?token=…  (the link in the email)
authRouter.get('/confirm', async (req, res, next) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : ''
    const userId = token && await owner.transaction(async db => {
      const { rows } = await db.query<{ user_id: string }>(
        `delete from auth.email_tokens
         where token_hash = $1 and purpose = 'confirm_email' and expires_at > now()
         returning user_id`,
        [hashToken(token)])
      if (!rows[0]) return null
      await db.query(
        'update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = $1',
        [rows[0].user_id])
      return rows[0].user_id
    })
    res.redirect(303, userId ? '/?confirmed=1' : '/?confirmed=expired')
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/password  { password }
authRouter.post('/password', requireUser, async (req, res, next) => {
  try {
    const problem = passwordProblem(req.body?.password)
    if (problem) {
      res.status(400).json({ error: problem })
      return
    }
    const hash = await hashPassword(req.body.password)
    await owner.query('update auth.users set password_hash = $2, updated_at = now() where id = $1', [res.locals.userId, hash])
    // A changed password signs out every other device.
    await endOtherSessions(res.locals.userId, req)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
