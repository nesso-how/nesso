import { z } from 'zod'
import { isAbsoluteIri, relationKey } from './core.ts'

export const iriSchema = z
  .string({ error: 'Expected an absolute IRI' })
  .refine(isAbsoluteIri, 'Expected an absolute IRI')
export const positionSchema = z.strictObject({ x: z.number(), y: z.number() })
export const conceptSchema = z.strictObject({
  id: iriSchema,
  label: z.string(),
  notes: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  position: positionSchema,
})
export const relationTypeSchema = z.strictObject({ id: iriSchema, label: z.string() })
const relationSchema = z.strictObject({
  source: iriSchema,
  predicate: iriSchema,
  target: iriSchema,
})

export const graphSchema = z
  .strictObject({
    concepts: z.array(conceptSchema),
    relationTypes: z.array(relationTypeSchema),
    relations: z.array(relationSchema),
  })
  .superRefine((graph, context) => {
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
  })

export type Position = z.infer<typeof positionSchema>
export type Concept = z.infer<typeof conceptSchema>
export type RelationType = z.infer<typeof relationTypeSchema>
export type Relation = z.infer<typeof relationSchema>
export type Graph = z.infer<typeof graphSchema>
