import { z } from 'zod'
import { colorPresets, conceptKeys, isAbsoluteIri, relationKey } from './core.ts'

export const iriSchema = z
  .string({ error: 'Expected an absolute IRI' })
  .refine(isAbsoluteIri, 'Expected an absolute IRI')
export const positionSchema = z.strictObject({ x: z.number(), y: z.number() })
export const conceptSchema = z.strictObject({
  id: iriSchema,
  label: z.string(),
  notes: z.string().optional(),
})
export const presentationSchema = z.strictObject({
  position: positionSchema,
  color: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.enum(colorPresets)]).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
})
export const conceptMapMemberSchema = presentationSchema.extend({ id: iriSchema })
export const relationTypeSchema = z.strictObject({
  id: iriSchema.refine((id) => !conceptKeys.includes(id), 'Reserved concept property IRI'),
  label: z.string(),
})
const relationSchema = z.strictObject({
  source: iriSchema,
  predicate: iriSchema,
  target: iriSchema,
})
export const relationBendSchema = relationSchema
  .extend({ bend: z.number().refine((value) => value !== 0, 'Manual bend must be nonzero') })
  .refine((relation) => relation.source !== relation.target, 'Self-relations cannot be bent')
const mapSchema = z.strictObject({
  id: iriSchema,
  name: z.string(),
  members: z.array(conceptMapMemberSchema),
  relationBends: z.array(relationBendSchema).optional(),
})

const graphShape = {
  concepts: z.array(conceptSchema),
  relationTypes: z.array(relationTypeSchema),
  relations: z.array(relationSchema),
}

const checkReferences = (
  graph: { concepts: { id: string }[]; relationTypes: { id: string }[]; relations: Relation[] },
  context: z.RefinementCtx,
) => {
  const concepts = new Set<string>()
  const types = new Set<string>()
  const relations = new Set<string>()
  for (const [index, concept] of graph.concepts.entries()) {
    if (concepts.has(concept.id))
      context.addIssue({
        code: 'custom',
        path: ['concepts', index, 'id'],
        message: `Duplicate concept IRI: ${concept.id}`,
      })
    concepts.add(concept.id)
  }
  for (const [index, type] of graph.relationTypes.entries()) {
    if (types.has(type.id) || concepts.has(type.id))
      context.addIssue({
        code: 'custom',
        path: ['relationTypes', index, 'id'],
        message: `Duplicate relation IRI: ${type.id}`,
      })
    types.add(type.id)
  }
  for (const [index, relation] of graph.relations.entries()) {
    const key = relationKey(relation)
    if (!concepts.has(relation.source) || !concepts.has(relation.target))
      context.addIssue({
        code: 'custom',
        path: ['relations', index],
        message: `Unknown concept in relation: ${key}`,
      })
    if (!types.has(relation.predicate))
      context.addIssue({
        code: 'custom',
        path: ['relations', index, 'predicate'],
        message: `Unknown relation type: ${relation.predicate}`,
      })
    if (relations.has(key))
      context.addIssue({
        code: 'custom',
        path: ['relations', index],
        message: `Duplicate relation: ${key}`,
      })
    relations.add(key)
  }
}

export const graphSchema = z.strictObject(graphShape).superRefine(checkReferences)
export const mapGraphSchema = z
  .strictObject({
    ...graphShape,
    concepts: z.array(conceptSchema.extend(presentationSchema.partial().shape)),
    relations: z.array(relationSchema.extend({ bend: z.number().optional() })),
  })
  .superRefine(checkReferences)

export const mapsSchema = (graph: Graph) =>
  z.array(mapSchema).superRefine((maps, context) => {
    const concepts = new Set(graph.concepts.map(({ id }) => id))
    const relations = new Set(graph.relations.map(relationKey))
    const taken = new Set([...concepts, ...graph.relationTypes.map(({ id }) => id)])
    for (const [index, map] of maps.entries()) {
      if (taken.has(map.id))
        context.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `Duplicate map IRI: ${map.id}`,
        })
      taken.add(map.id)
      const members = new Set<string>()
      for (const [position, member] of map.members.entries()) {
        if (!concepts.has(member.id) || members.has(member.id))
          context.addIssue({
            code: 'custom',
            path: [index, 'members', position, 'id'],
            message: `${members.has(member.id) ? 'Duplicate' : 'Unknown'} map member: ${member.id}`,
          })
        members.add(member.id)
      }
      const bends = new Set<string>()
      for (const [position, relation] of (map.relationBends ?? []).entries()) {
        const key = relationKey(relation)
        if (
          bends.has(key) ||
          !relations.has(key) ||
          !members.has(relation.source) ||
          !members.has(relation.target)
        )
          context.addIssue({
            code: 'custom',
            path: [index, 'relationBends', position],
            message: 'Duplicate or invalid relation bend',
          })
        bends.add(key)
      }
    }
  })

export type Position = z.infer<typeof positionSchema>
export type Concept = z.infer<typeof conceptSchema>
export type Presentation = z.infer<typeof presentationSchema>
export type ConceptMapMember = z.infer<typeof conceptMapMemberSchema>
export type ConceptMap = z.infer<typeof mapSchema>
export type RelationType = z.infer<typeof relationTypeSchema>
export type Relation = z.infer<typeof relationSchema>
export type RelationBend = z.infer<typeof relationBendSchema>
export type Graph = z.infer<typeof graphSchema>
