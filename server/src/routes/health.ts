import { Router } from 'express'
import { tokenStatus } from '../auth.js'
import { config } from '../config.js'

export const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  const token = tokenStatus()
  res.json({
    status: 'ok',
    fhirBase: config.fhirBase,
    token,
  })
})
