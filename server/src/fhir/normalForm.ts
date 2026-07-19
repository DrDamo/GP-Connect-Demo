// Parses the `normalForm` property returned by CodeSystem/$lookup — a SNOMED CT
// Compositional Grammar (SCG) defining expression, e.g.:
//   === 776713006|Product containing only metformin|+...:{1142138002|Has concentration
//     strength numerator value|=#50,733725009|Has concentration strength numerator unit|
//     =258684004|milligram|},{...}
//
// This is a flat attribute-value extractor, not a full SCG parser: it finds every
// `attributeId|attributeName|=value` occurrence regardless of brace/paren nesting.
// That's sufficient here because callers only look up a fixed set of known dm+d
// attribute IDs (see mappers.ts) rather than needing the expression's full tree
// structure.
export interface NormalFormAttribute {
  attributeId: string
  attributeName: string
  valueNumber?: number
  valueCode?: string
  valueDisplay?: string
}

const ATTR_VALUE_RE = /(\d+)\|([^|]*)\|\s*=\s*\(?(?:#(-?\d+(?:\.\d+)?)|(\d+)\|([^|]*)\|)/g

export function parseNormalFormAttributes(expression: string): NormalFormAttribute[] {
  const attrs: NormalFormAttribute[] = []
  for (const m of expression.matchAll(ATTR_VALUE_RE)) {
    const [, attributeId, attributeName, numLiteral, valueCode, valueDisplay] = m
    attrs.push({
      attributeId,
      attributeName: attributeName.trim(),
      valueNumber: numLiteral !== undefined ? Number(numLiteral) : undefined,
      valueCode,
      valueDisplay: valueDisplay?.trim(),
    })
  }
  return attrs
}
