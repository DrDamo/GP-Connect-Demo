// UK-order partial dates (YYYY, MM-YYYY, DD-MM-YYYY) <-> ISO partial dates,
// as used by DateField. See DateField.tsx for the accepted input formats.

const pad = (s: string) => (s.length === 1 ? `0${s}` : s)

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Parse user text into an ISO date. Returns null when unparseable, or when
// fullOnly is set and the text doesn't resolve to a complete DD-MM-YYYY date.
export function parseToIso(input: string, fullOnly = false): string | null {
  const text = input.trim()
  if (text === '') return ''

  const parts = text.split(/[-/. ]+/).filter(Boolean)
  if (parts.length === 0 || parts.length > 3) return null
  if (fullOnly && parts.length !== 3) return null
  if (!parts.every(p => /^\d{1,4}$/.test(p))) return null

  // A 4-digit leading part means ISO order was typed; otherwise UK order.
  const isoOrder = parts[0].length === 4
  let year: string, month: string | undefined, day: string | undefined
  if (isoOrder) {
    [year, month, day] = parts
  } else {
    if (parts.length === 1) return null // a bare 1-2 digit number isn't a date
    const last = parts[parts.length - 1]
    if (last.length !== 4) return null  // year must be 4 digits
    year = last
    if (parts.length === 2) month = parts[0]
    else { day = parts[0]; month = parts[1] }
  }

  if (!/^\d{4}$/.test(year)) return null
  const y = Number(year)
  if (y < 1000 || y > 2999) return null
  if (month === undefined) return year

  const m = Number(month)
  if (!Number.isInteger(m) || m < 1 || m > 12) return null
  if (day === undefined) return `${year}-${pad(String(m))}`

  const d = Number(day)
  if (!Number.isInteger(d) || d < 1 || d > daysInMonth(y, m)) return null
  return `${year}-${pad(String(m))}-${pad(String(d))}`
}

// Render a stored ISO partial date in UK order for display.
export function isoToDisplay(iso: string | undefined): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[1]}-${parts[0]}`
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}
