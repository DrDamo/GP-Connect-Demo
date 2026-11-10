import { Router, type Request, type Response, type NextFunction } from 'express'
import { asUser, type Db } from '../db.js'
import { requireUser } from '../users/sessions.js'
import { PROFILE_COLUMNS } from '../users/me.js'

// The app's own data. Every query runs through asUser(), i.e. as gpc_app with
// the caller's id set, so the row-level security policies in
// migrations/001_schema.sql decide what each user may read and change. The
// checks here only shape inputs and turn "no row" into the right status.

export const dataRouter = Router()
dataRouter.use(requireUser)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[A-Za-z0-9._:-]{1,100}$/

class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly extra: Record<string, unknown> = {}) {
    super(message)
  }
}

type Handler = (req: Request, db: Db) => Promise<unknown>

/** Runs the handler as the signed-in user. A returned value is sent as JSON;
 *  undefined sends 204. */
function route(handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await asUser(res.locals.userId, db => handler(req, db))
      if (result === undefined) res.status(204).end()
      else res.json(result)
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message, ...err.extra })
        return
      }
      next(err)
    }
  }
}

function uuidParam(req: Request, name = 'id'): string {
  const v = String(req.params[name] ?? '')
  if (!UUID_RE.test(v)) throw new HttpError(404, 'Not found')
  return v
}

function slugParam(req: Request, name: string): string {
  const v = String(req.params[name] ?? '')
  if (!SLUG_RE.test(v)) throw new HttpError(400, `Invalid ${name}`)
  return v
}

function optText(body: Record<string, unknown>, key: string, max: number): string | null {
  const v = body[key]
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string') throw new HttpError(400, `${key} must be a string`)
  return v.slice(0, max)
}

function reqText(body: Record<string, unknown>, key: string, max: number): string {
  const v = body[key]
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${key} is required`)
  if (v.length > max) throw new HttpError(400, `${key} is too long`)
  return v
}

function draftData(body: Record<string, unknown>): string {
  const v = body.draft_data
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, 'draft_data must be an object')
  return JSON.stringify(v)
}

const body = (req: Request): Record<string, unknown> =>
  req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}

const AUTHOR = "json_build_object('username', p.username, 'display_name', p.display_name) as profiles"

// ---------------------------------------------------------------------------
// Shared patients (patient_drafts)
// ---------------------------------------------------------------------------

dataRouter.get('/drafts', route(async (_req, db) => {
  const { rows } = await db.query(
    `select d.id, d.name, d.description, d.version, d.patient_name, d.nhs_number,
            d.created_at, d.updated_at, ${AUTHOR}
     from public.patient_drafts d left join public.profiles p on p.id = d.created_by
     order by d.updated_at desc`)
  return rows
}))

dataRouter.get('/drafts/:id', route(async (req, db) => {
  const { rows: [row] } = await db.query(
    'select draft_data, version from public.patient_drafts where id = $1', [uuidParam(req)])
  if (!row) throw new HttpError(404, 'Not found')
  return row
}))

dataRouter.post('/drafts', route(async (req, db) => {
  const b = body(req)
  const { rows: [row] } = await db.query(
    `insert into public.patient_drafts
       (org_id, created_by, name, description, patient_name, nhs_number, draft_data, version)
     values (public.current_org_id(), auth.uid(), $1, $2, $3, $4, $5::jsonb, 1)
     returning id, version`,
    [optText(b, 'name', 200), optText(b, 'description', 2000), optText(b, 'patient_name', 200),
     optText(b, 'nhs_number', 20), draftData(b)])
  return row
}))

// Saves a new version only if nobody else has saved since `expectedVersion`.
dataRouter.put('/drafts/:id', route(async (req, db) => {
  const id = uuidParam(req)
  const b = body(req)
  const expected = b.expectedVersion
  if (!Number.isInteger(expected)) throw new HttpError(400, 'expectedVersion is required')
  const { rows: [row] } = await db.query(
    `update public.patient_drafts
     set patient_name = $3, nhs_number = $4, draft_data = $5::jsonb, version = version + 1
     where id = $1 and version = $2
     returning id, version`,
    [id, expected, optText(b, 'patient_name', 200), optText(b, 'nhs_number', 20), draftData(b)])
  if (row) return row
  const { rows: [current] } = await db.query('select version from public.patient_drafts where id = $1', [id])
  if (!current) throw new HttpError(404, 'Not found')
  throw new HttpError(409, 'A newer version has been saved', { currentVersion: current.version })
}))

dataRouter.delete('/drafts/:id', route(async (req, db) => {
  const { rowCount } = await db.query('delete from public.patient_drafts where id = $1', [uuidParam(req)])
  if (!rowCount) throw new HttpError(404, 'Not found')
  return undefined
}))

// ---------------------------------------------------------------------------
// Training content overrides (platform admins write; everyone reads)
// ---------------------------------------------------------------------------

dataRouter.get('/training-content', route(async (_req, db) => {
  const { rows } = await db.query('select page_id, content, version, updated_at from public.training_content')
  return rows
}))

dataRouter.put('/training-content/:pageId', route(async (req, db) => {
  const pageId = slugParam(req, 'pageId')
  const content = reqText(body(req), 'content', 200_000)
  const { rows: [admin] } = await db.query<{ is: boolean }>('select public.is_platform_admin() as is')
  if (!admin?.is) throw new HttpError(403, 'Only platform admins can edit training content')
  const { rows: [row] } = await db.query(
    `insert into public.training_content (page_id, content, version, updated_by)
     values ($1, $2, 1, auth.uid())
     on conflict (page_id) do update
       set content = excluded.content, updated_by = excluded.updated_by,
           version = public.training_content.version + 1
     returning page_id, content, version, updated_at`,
    [pageId, content])
  return row
}))

dataRouter.delete('/training-content/:pageId', route(async (req, db) => {
  const { rowCount } = await db.query('delete from public.training_content where page_id = $1', [slugParam(req, 'pageId')])
  if (!rowCount) throw new HttpError(404, 'Not found')
  return undefined
}))

// ---------------------------------------------------------------------------
// Training notes (per organisation)
// ---------------------------------------------------------------------------

const NOTE_COLUMNS = `n.id, n.org_id, n.page_id, n.created_by, n.body, n.created_at, n.updated_at, ${AUTHOR}`

dataRouter.get('/training-notes', route(async (_req, db) => {
  const { rows } = await db.query(
    `select ${NOTE_COLUMNS} from public.training_notes n
     left join public.profiles p on p.id = n.created_by
     order by n.created_at asc`)
  return rows
}))

dataRouter.post('/training-notes', route(async (req, db) => {
  const b = body(req)
  const pageId = reqText(b, 'page_id', 100)
  if (!SLUG_RE.test(pageId)) throw new HttpError(400, 'Invalid page_id')
  const { rows: [row] } = await db.query(
    `insert into public.training_notes (org_id, page_id, created_by, body)
     values (public.current_org_id(), $1, auth.uid(), $2) returning id`,
    [pageId, reqText(b, 'body', 20_000)])
  return row
}))

dataRouter.patch('/training-notes/:id', route(async (req, db) => {
  const { rowCount } = await db.query('update public.training_notes set body = $2 where id = $1',
    [uuidParam(req), reqText(body(req), 'body', 20_000)])
  if (!rowCount) throw new HttpError(404, 'Not found')
  return undefined
}))

dataRouter.delete('/training-notes/:id', route(async (req, db) => {
  const { rowCount } = await db.query('delete from public.training_notes where id = $1', [uuidParam(req)])
  if (!rowCount) throw new HttpError(404, 'Not found')
  return undefined
}))

// ---------------------------------------------------------------------------
// The signed-in user: profile, organisation, onboarding progress
// ---------------------------------------------------------------------------

const PROFILE_FIELDS = ['display_name', 'job_title', 'date_of_birth', 'address'] as const

dataRouter.patch('/me', route(async (req, db) => {
  const b = body(req)
  const fields = PROFILE_FIELDS.filter(f => f in b)
  if (!fields.length) throw new HttpError(400, 'Nothing to update')
  const values = fields.map(f => optText(b, f, 500))
  const dob = values[fields.indexOf('date_of_birth' as never)]
  if (fields.includes('date_of_birth') && dob !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    throw new HttpError(400, 'date_of_birth must be YYYY-MM-DD')
  }
  const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
  const { rows: [row] } = await db.query(
    `update public.profiles set ${sets} where id = auth.uid() returning ${PROFILE_COLUMNS}`, values)
  if (!row) throw new HttpError(404, 'Profile not found')
  return row
}))

dataRouter.patch('/org', route(async (req, db) => {
  const name = reqText(body(req), 'name', 200).trim()
  const { rows: [row] } = await db.query(
    'update public.organisations set name = $1 where id = public.current_org_id() returning id, name', [name])
  if (!row) throw new HttpError(403, 'Only organisation admins can rename the organisation')
  return row
}))

dataRouter.get('/me/onboarding', route(async (_req, db) => {
  const tours = await db.query<{ tour_id: string }>('select tour_id from public.user_tour_progress where user_id = auth.uid()')
  const hints = await db.query<{ hint_id: string }>('select hint_id from public.user_hint_dismissals where user_id = auth.uid()')
  return { tours: tours.rows.map(r => r.tour_id), hints: hints.rows.map(r => r.hint_id) }
}))

dataRouter.put('/me/tours/:tourId', route(async (req, db) => {
  await db.query(
    'insert into public.user_tour_progress (user_id, tour_id) values (auth.uid(), $1) on conflict do nothing',
    [slugParam(req, 'tourId')])
  return undefined
}))

dataRouter.delete('/me/tours/:tourId', route(async (req, db) => {
  await db.query('delete from public.user_tour_progress where user_id = auth.uid() and tour_id = $1', [slugParam(req, 'tourId')])
  return undefined
}))

dataRouter.put('/me/hints/:hintId', route(async (req, db) => {
  await db.query(
    'insert into public.user_hint_dismissals (user_id, hint_id) values (auth.uid(), $1) on conflict do nothing',
    [slugParam(req, 'hintId')])
  return undefined
}))

dataRouter.delete('/me/hints', route(async (_req, db) => {
  await db.query('delete from public.user_hint_dismissals where user_id = auth.uid()')
  return undefined
}))
