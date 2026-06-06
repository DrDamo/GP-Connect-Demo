import type { DraftRecord } from '../types'
import type { TempIdMap } from '../idMap'

function makeTelecom(phone?: string, email?: string): fhir3.ContactPoint[] | undefined {
  const arr: fhir3.ContactPoint[] = []
  if (phone) arr.push({ system: 'phone', value: phone, use: 'home' })
  if (email) arr.push({ system: 'email', value: email })
  return arr.length ? arr : undefined
}

function makePatient(draft: DraftRecord, map: TempIdMap): fhir3.BundleEntry {
  const { id, fullUrl } = map.entry(draft.patient._tempId)
  const p = draft.patient

  const verificationCode = p.nhsNumberVerified ? '01' : '04'
  const verificationDisplay = p.nhsNumberVerified ? 'Number present and verified' : 'Trace required'

  const nhsIdentifier: fhir3.Identifier | undefined = p.nhsNumber
    ? {
        system: 'https://fhir.nhs.uk/Id/nhs-number',
        value: p.nhsNumber,
        extension: [
          {
            url: 'https://fhir.hl7.org.uk/STU3/StructureDefinition/Extension-CareConnect-NHSNumberVerificationStatus-1',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'https://fhir.hl7.org.uk/STU3/CodeSystem/CareConnect-NHSNumberVerificationStatus-1',
                  code: verificationCode,
                  display: verificationDisplay,
                },
              ],
            },
          },
        ],
      }
    : undefined

  const name: fhir3.HumanName = {
    use: 'official',
    ...(p.prefix ? { prefix: [p.prefix] } : {}),
    ...(p.givenName ? { given: [p.givenName] } : {}),
    ...(p.familyName ? { family: p.familyName } : {}),
  }

  const registrationExt: fhir3.Extension = {
    url: 'https://fhir.nhs.uk/STU3/StructureDefinition/Extension-CareConnect-GPC-RegistrationDetails-1',
    extension: [
      ...(p.registrationStart
        ? [{ url: 'registrationPeriod', valuePeriod: { start: p.registrationStart } }]
        : []),
      {
        url: 'registrationType',
        valueCodeableConcept: {
          coding: [
            {
              system: 'https://fhir.nhs.uk/STU3/CodeSystem/CareConnect-RegistrationType-1',
              code: 'R',
              display: 'Regular',
            },
          ],
        },
      },
    ],
  }

  const resource: fhir3.Patient = {
    resourceType: 'Patient',
    id,
    active: p.isActive ?? true,
    ...(nhsIdentifier ? { identifier: [nhsIdentifier] } : {}),
    name: [name],
    ...(p.gender ? { gender: p.gender } : {}),
    ...(p.dateOfBirth ? { birthDate: p.dateOfBirth } : {}),
    ...(p.address ? { address: [{ text: p.address }] } : {}),
    ...(makeTelecom(p.phone, p.email) ? { telecom: makeTelecom(p.phone, p.email) } : {}),
    extension: [registrationExt],
  }

  return { fullUrl, resource }
}

function makeOrganisation(draft: DraftRecord, map: TempIdMap): fhir3.BundleEntry {
  const { id, fullUrl } = map.entry(draft.organisation._tempId)
  const o = draft.organisation

  const resource: fhir3.Organization = {
    resourceType: 'Organization',
    id,
    ...(o.name ? { name: o.name } : {}),
    ...(o.odsCode
      ? {
          identifier: [
            { system: 'https://fhir.nhs.uk/Id/ods-organization-code', value: o.odsCode },
          ],
        }
      : {}),
    ...(o.phone ? { telecom: [{ system: 'phone', value: o.phone }] } : {}),
    ...(o.address ? { address: [{ text: o.address }] } : {}),
  }

  return { fullUrl, resource }
}

function makePractitioner(p: DraftRecord['practitioners'][number], map: TempIdMap): fhir3.BundleEntry {
  const { id, fullUrl } = map.entry(p._tempId)

  const name: fhir3.HumanName = {
    use: 'official',
    ...(p.prefix ? { prefix: [p.prefix] } : {}),
    ...(p.givenName ? { given: [p.givenName] } : {}),
    ...(p.familyName ? { family: p.familyName } : {}),
  }

  const resource: fhir3.Practitioner = {
    resourceType: 'Practitioner',
    id,
    meta: {
      profile: ['https://fhir.hl7.org.uk/STU3/StructureDefinition/CareConnect-Practitioner-1'],
    },
    name: [name],
    ...(p.sdsUserId
      ? { identifier: [{ system: 'https://fhir.nhs.uk/Id/sds-user-id', value: p.sdsUserId }] }
      : {}),
    ...(p.gender ? { gender: p.gender } : {}),
  }

  return { fullUrl, resource }
}

function makeLocation(l: DraftRecord['locations'][number], map: TempIdMap): fhir3.BundleEntry {
  const { id, fullUrl } = map.entry(l._tempId)

  const resource: fhir3.Location = {
    resourceType: 'Location',
    id,
    ...(l.name ? { name: l.name } : {}),
    ...(l.address ? { address: { text: l.address } } : {}),
  }

  return { fullUrl, resource }
}

export function generateAdmin(draft: DraftRecord, map: TempIdMap): fhir3.BundleEntry[] {
  return [
    makePatient(draft, map),
    makeOrganisation(draft, map),
    ...draft.practitioners.map(p => makePractitioner(p, map)),
    ...draft.locations.map(l => makeLocation(l, map)),
  ]
}
