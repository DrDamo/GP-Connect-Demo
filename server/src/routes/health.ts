import { Router } from 'express'
import { config } from '../config.js'
import { pool } from '../db.js'

export const healthRouter = Router()

// Liveness plus a database round trip. Token state and upstream
// configuration stay server-side.
healthRouter.get('/', async (_req, res) => {
  try {
    await pool.query('select 1')
    res.json({ status: 'ok', commit: config.gitCommitSha })
  } catch {
    res.status(503).json({ status: 'degraded', commit: config.gitCommitSha })
  }
})
