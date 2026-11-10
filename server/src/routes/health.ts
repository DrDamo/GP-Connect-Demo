import { Router } from 'express'

export const healthRouter = Router()

// Liveness only — token state and upstream configuration stay server-side.
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok' })
})
