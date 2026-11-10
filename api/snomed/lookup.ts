import type { VercelRequest, VercelResponse } from '@vercel/node'
import { lookupCode, looksLikeDescriptionId, resolveDescriptionIdToConcept } from '../_lib/lookup'
import { toSnomedDetail } from '../_lib/mappers'
import { guard } from '../_lib/guard'
import { UpstreamError, sendUpstreamError } from '../_lib/errors'

const SNOMED_SYSTEM = 'http://snomed.info/sct'

// GET /api/snomed/lookup?code=73211009&system=http://snomed.info/sct
// system defaults to SNOMED CT, and SNOMED CT is the only system accepted
// (dm+d codes are SNOMED CT concepts too). Response: { raw: Parameters, detail: SnomedDetail } —
// raw is the full FHIR CodeSystem/$lookup response (for inspecting anything
// the mapper doesn't surface), detail pulls out inactive/parent/child/
// designations/attributes generically (see toSnomedDetail — there's no fixed
// attribute set for arbitrary SNOMED concepts the way there is for dm+d).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await guard(req, res, 'GET'))) return

  const code = typeof req.query.code === 'string' ? req.query.code.trim() : ''
  const system = typeof req.query.system === 'string' && req.query.system
    ? req.query.system
    : SNOMED_SYSTEM

  if (!code) { res.status(400).json({ error: 'code is required' }); return }
  if (system !== SNOMED_SYSTEM) { res.status(400).json({ error: `Only ${SNOMED_SYSTEM} codes can be looked up` }); return }
  // SCTIDs (concept and description ids alike) are 6–18 digits.
  if (!/^\d{6,18}$/.test(code)) { res.status(400).json({ error: `${code.slice(0, 40)} is not a SNOMED CT identifier` }); return }

  try {
    const raw = await lookupCode(system, code)
    res.json({ raw, detail: toSnomedDetail(raw) })
  } catch (err) {
    // $lookup only resolves concept ids — if this looks like a SNOMED CT
    // description id instead (e.g. a Coding's `descriptionId` extension
    // value from a GP Connect/CareConnect record), resolve it to its owning
    // concept and look that up instead (see resolveDescriptionIdToConcept).
    if (system === SNOMED_SYSTEM && looksLikeDescriptionId(code)) {
      try {
        const conceptCode = await resolveDescriptionIdToConcept(code)
        if (conceptCode) {
          const raw = await lookupCode(system, conceptCode)
          res.json({ raw, detail: toSnomedDetail(raw), resolvedFromDescriptionId: code })
          return
        }
        // Structurally a description id, but resolveDescriptionIdToConcept's
        // $expand search found no match — confirmed live that this Ontoserver
        // instance's search index only covers active descriptions, so this is
        // almost always an inactive/historical description (e.g. a
        // superseded synonym still referenced by an old clinical record),
        // not a genuinely made-up number. There's no FHIR-standard operation
        // to resolve those, so this is a real terminology-server limitation,
        // not something retryable.
        res.status(502).json({
          error: `Could not resolve description ID ${code} to a concept — it looks like an inactive/historical SNOMED CT description, which this terminology server's search doesn't index.`,
        })
        return
      } catch { /* resolution itself errored (network/server) — fall through to the original error below */ }
    }
    // $lookup answers an unknown code with HTTP 404 — pass that through as a
    // real 404 so the client can say "not found" without reading upstream text.
    if (err instanceof UpstreamError && err.status === 404) {
      res.status(404).json({ error: `No SNOMED CT concept found for code ${code}` })
      return
    }
    sendUpstreamError(res, 'snomed/lookup', err)
  }
}
