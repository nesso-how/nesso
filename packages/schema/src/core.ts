export const schemaContext = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  position: { '@id': 'urn:uuid:af4fb77d-c82c-5e04-bf5c-68588670d18b', '@type': '@json' },
  color: { '@id': 'urn:uuid:c9d8a2c8-6ed8-5d10-83ee-fb11e19a4db1' },
  bold: { '@id': 'urn:uuid:5d843456-1cae-4e78-9121-80dc1eaaec41' },
  italic: { '@id': 'urn:uuid:a532a410-360e-4449-9750-9934b49b2d39' },
} as const

export const newIri = () => `urn:uuid:${crypto.randomUUID()}`
export const isAbsoluteIri = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9+.-]*:/i.test(value)
export const relationKey = ({ source, predicate, target }: {
  source: string; predicate: string; target: string
}) => JSON.stringify([source, predicate, target])
