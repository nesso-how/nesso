import { z } from 'zod'
import { newIri, schemaContext } from './core.ts'
import { fail, parseSchema } from './errors.ts'
import { iriSchema, presentationSchema } from './types.ts'

type JsonObject = Record<string, unknown>
const jsonObject = z.record(z.string(), z.unknown())
const legacyDocument = z.strictObject({ '@context': jsonObject, '@graph': z.array(jsonObject) })
const legacyPresentation = presentationSchema.partial()
const versionSchema = z.object({ schemaVersion: z.number().int().positive().optional() })

function upgradeLegacy(document: z.infer<typeof legacyDocument>) {
  let legacy = false
  const members: JsonObject[] = []
  const entries = document['@graph'].map((entry, index) => {
    if (entry['@type'] !== undefined) return entry
    const { position, color, bold, italic, ...concept } = entry
    if ([position, color, bold, italic].some((value) => value !== undefined)) legacy = true
    const presentation = parseSchema(
      legacyPresentation,
      { position, color, bold, italic },
      `@graph[${index}]`,
    )
    members.push({
      concept: { '@id': concept['@id'] },
      ...presentation,
      position: presentation.position ?? { x: 0, y: 0 },
    })
    return concept
  })
  if (legacy && entries.some((entry) => entry['@type'] === 'View'))
    fail('@graph', 'Concept presentation belongs to views')
  const newTerms = {
    schemaVersion: schemaContext.schemaVersion,
    ...(legacy
      ? { View: schemaContext.View, members: schemaContext.members, concept: schemaContext.concept }
      : {}),
  }
  for (const term of Object.keys(newTerms)) {
    const mapping = jsonObject.safeParse(document['@context'][term])
    if (!mapping.success || mapping.data['@type'] !== '@id') continue
    const predicate = parseSchema(iriSchema, mapping.data['@id'], `@context.${term}.@id`)
    for (const entry of entries) {
      if (entry['@type'] !== undefined || !(term in entry)) continue
      entry[predicate] = [...(predicate in entry ? [entry[predicate]] : []), entry[term]].flat()
      delete entry[term]
    }
  }
  return {
    schemaVersion: 1,
    '@context': { ...document['@context'], ...newTerms },
    '@graph': [
      ...entries,
      ...(legacy ? [{ '@id': newIri(), '@type': 'View', 'rdfs:label': '', members }] : []),
    ],
  }
}

export function migrateGraph(value: unknown): unknown {
  const { schemaVersion } = parseSchema(versionSchema, value)
  switch (schemaVersion) {
    case undefined:
      return upgradeLegacy(parseSchema(legacyDocument, value))
    case 1:
      return value
    default:
      return fail('schemaVersion', 'Unsupported JSON-LD schema version')
  }
}
