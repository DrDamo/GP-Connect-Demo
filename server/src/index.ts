import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { snomedRouter } from './routes/snomed.js'
import { dmdRouter } from './routes/dmd.js'
import { healthRouter } from './routes/health.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/snomed', snomedRouter)
app.use('/api/dmd', dmdRouter)
app.use('/api/health', healthRouter)

// Keep the existing SnomedPicker login endpoint alive so users don't see a
// broken config modal — credentials are managed server-side, so this is a no-op
app.post('/api/auth/login', (_req, res) => {
  res.status(410).json({
    error: 'Client credentials are managed server-side. No user login required. Point the server URL to this proxy and use Verify & Save with any placeholder token.',
  })
})

app.listen(config.port, () => {
  console.log(`NHS Terminology Proxy running on http://localhost:${config.port}`)
  console.log(`FHIR base: ${config.fhirBase}`)
})
