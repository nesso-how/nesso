import { z } from 'zod'
import { conceptKeys, isAbsoluteIri, relationKey } from './core.ts'

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
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
})
export const viewMemberSchema = presentationSchema.extend({ id: iriSchema })
export const relationTypeSchema = z.strictObject({
  id: iriSchema.refine((id) => !conceptKeys.includes(id), 'Reserved concept property IRI'),
  label: z.string(),
})
const relationSchema = z.strictObject({
  source: iriSchema,
  predicate: iriSchema,
  target: iriSchema,
})
const viewSchema = z.strictObject({
  id: iriSchema,
  name: z.string(),
  members: z.array(viewMemberSchema),
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
export const viewGraphSchema = z
  .strictObject({
    ...graphShape,
    concepts: z.array(conceptSchema.extend(presentationSchema.partial().shape)),
  })
  .superRefine(checkReferences)

export const viewsSchema = (graph: Graph) =>
  z.array(viewSchema).superRefine((views, context) => {
    const concepts = new Set(graph.concepts.map(({ id }) => id))
    const taken = new Set([...concepts, ...graph.relationTypes.map(({ id }) => id)])
    for (const [index, view] of views.entries()) {
      if (taken.has(view.id))
        context.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `Duplicate view IRI: ${view.id}`,
        })
      taken.add(view.id)
      const members = new Set<string>()
      for (const [position, member] of view.members.entries()) {
        if (!concepts.has(member.id) || members.has(member.id))
          context.addIssue({
            code: 'custom',
            path: [index, 'members', position, 'id'],
            message: `${members.has(member.id) ? 'Duplicate' : 'Unknown'} view member: ${member.id}`,
          })
        members.add(member.id)
      }
    }
  })

export type Position = z.infer<typeof positionSchema>
export type Concept = z.infer<typeof conceptSchema>
export type Presentation = z.infer<typeof presentationSchema>
export type ViewMember = z.infer<typeof viewMemberSchema>
export type View = z.infer<typeof viewSchema>
export type RelationType = z.infer<typeof relationTypeSchema>
export type Relation = z.infer<typeof relationSchema>
export type Graph = z.infer<typeof graphSchema>
