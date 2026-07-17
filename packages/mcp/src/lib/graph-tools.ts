// SPDX-License-Identifier: MIT
import dagre from 'dagre'
import * as z from 'zod/v4'
import {
  deserialize,
  serialize,
  VOCABULARY,
  RELATION_TYPE_VALUES,
  type ConceptElaboration,
  type NessoGraphDocumentInput,
  type RelationTypeName,
} from '@nesso-how/vocab-learning'

export interface GraphValidationIssue {
  path: string
  message: string
}

export interface GraphValidationResult {
  valid: boolean
  errors: GraphValidationIssue[]
  warnings: GraphValidationIssue[]
}

const elaborationSchema = z.object({
  definition: z.string(),
})

export const relationTypeEnum = z.enum(
  RELATION_TYPE_VALUES as [RelationTypeName, ...RelationTypeName[]],
)

const conceptInputSchema = z.union([
  z.string().describe('Concept label text'),
  z.object({
    id: z.string().optional().describe('Optional stable concept id (n-prefix recommended)'),
    text: z.string().describe('Concept label'),
    elaboration: elaborationSchema.optional(),
  }),
])

export const buildGraphInputSchema = z.object({
  name: z.string().describe('Graph display name'),
  concepts: z
    .array(conceptInputSchema)
    .min(1)
    .describe('Concept labels or objects with optional id and elaboration'),
  relations: z
    .array(
      z.object({
        from: z.string().describe('Source concept id or label text'),
        to: z.string().describe('Target concept id or label text'),
        relation: relationTypeEnum.describe('Semantic relation type id'),
      }),
    )
    .describe('Directed relations between concepts'),
})

export type BuildGraphInput = z.infer<typeof buildGraphInputSchema>

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/** Short element id (`n`/`e` + 5 base36 chars), retried until unique within `used`. */
export function newElementId(prefix: 'n' | 'e', used: ReadonlySet<string>): string {
  for (;;) {
    const id = prefix + Math.random().toString(36).slice(2, 7)
    if (!used.has(id)) return id
  }
}

function issue(path: string, message: string): GraphValidationIssue {
  return { path, message }
}

function detectRuntimeFormat(root: Record<string, unknown>): GraphValidationIssue | null {
  const hasDocumentShape = Array.isArray(root.concepts) && Array.isArray(root.relations)
  const hasRuntimeShape = Array.isArray(root.nodes) || Array.isArray(root.edges)
  if (hasRuntimeShape && !hasDocumentShape) {
    return issue(
      '$',
      'Expected graph document format with concepts[] and relations[], not runtime nodes/edges',
    )
  }
  return null
}

function collectStructuralIssues(doc: NessoGraphDocumentInput): {
  errors: GraphValidationIssue[]
  warnings: GraphValidationIssue[]
} {
  const errors: GraphValidationIssue[] = []
  const warnings: GraphValidationIssue[] = []

  if (doc.vocabulary === undefined) {
    warnings.push(
      issue('vocabulary', 'Missing vocabulary reference; import works but metadata is incomplete'),
    )
  }

  const conceptIds = new Set<string>()
  for (let i = 0; i < doc.concepts.length; i++) {
    const id = doc.concepts[i].id
    if (conceptIds.has(id)) {
      errors.push(issue(`concepts[${i}].id`, `Duplicate concept id "${id}"`))
    }
    conceptIds.add(id)
  }

  const relationIds = new Set<string>()
  for (let i = 0; i < doc.relations.length; i++) {
    const rel = doc.relations[i]
    if (relationIds.has(rel.id)) {
      errors.push(issue(`relations[${i}].id`, `Duplicate relation id "${rel.id}"`))
    }
    relationIds.add(rel.id)

    if (!conceptIds.has(rel.source)) {
      errors.push(
        issue(
          `relations[${i}].source`,
          `Source "${rel.source}" does not reference an existing concept id`,
        ),
      )
    }
    if (!conceptIds.has(rel.target)) {
      errors.push(
        issue(
          `relations[${i}].target`,
          `Target "${rel.target}" does not reference an existing concept id`,
        ),
      )
    }
    if (rel.type === undefined) {
      warnings.push(
        issue(
          `relations[${i}].type`,
          'Missing relation type; the app falls back to "causes" at render time',
        ),
      )
    }
  }

  return { errors, warnings }
}

/** Non-throwing validation for Nesso graph document JSON strings. */
export function validateGraphJson(graph: string): GraphValidationResult {
  const errors: GraphValidationIssue[] = []
  const warnings: GraphValidationIssue[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(graph)
  } catch {
    return {
      valid: false,
      errors: [issue('$', 'Invalid JSON')],
      warnings,
    }
  }

  const root = asRecord(parsed)
  if (!root) {
    return {
      valid: false,
      errors: [issue('$', 'Graph document root must be a JSON object')],
      warnings,
    }
  }

  const runtimeIssue = detectRuntimeFormat(root)
  if (runtimeIssue) {
    return { valid: false, errors: [runtimeIssue], warnings }
  }

  try {
    const doc = deserialize(graph)
    const structural = collectStructuralIssues(doc)
    errors.push(...structural.errors)
    warnings.push(...structural.warnings)
  } catch (err) {
    errors.push(issue('$', err instanceof Error ? err.message : 'Graph document failed validation'))
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

type ResolvedConcept = {
  id: string
  label: string
  elaboration?: ConceptElaboration
}

function normalizeConceptInputs(input: BuildGraphInput['concepts']): ResolvedConcept[] {
  const usedIds = new Set<string>()
  return input.map((item) => {
    if (typeof item === 'string') {
      const id = newElementId('n', usedIds)
      usedIds.add(id)
      return { id, label: item }
    }
    const id = item.id ?? newElementId('n', usedIds)
    if (usedIds.has(id)) {
      throw new Error(`Duplicate concept id "${id}" in build_graph input`)
    }
    usedIds.add(id)
    return { id, label: item.text, elaboration: item.elaboration }
  })
}

function resolveConceptRef(ref: string, concepts: ResolvedConcept[]): string {
  const byId = concepts.find((c) => c.id === ref)
  if (byId) return byId.id

  const byLabel = concepts.filter((c) => c.label === ref)
  if (byLabel.length === 1) return byLabel[0].id
  if (byLabel.length > 1) {
    throw new Error(`Ambiguous concept reference "${ref}" — multiple concepts share that label`)
  }

  throw new Error(`Unknown concept reference "${ref}" — use an id or unique label`)
}

function buildDagreGraph(
  concepts: ResolvedConcept[],
  relations: { source: string; target: string }[],
): dagre.graphlib.Graph {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 120 })
  for (const concept of concepts) {
    g.setNode(concept.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const rel of relations) {
    if (g.hasNode(rel.source) && g.hasNode(rel.target)) {
      g.setEdge(rel.source, rel.target)
    }
  }
  dagre.layout(g)
  return g
}

function dagreNodePosition(
  layout: { x?: number; y?: number } | undefined,
): { x: number; y: number } | null {
  if (layout?.x === undefined || layout?.y === undefined) return null
  return { x: layout.x - NODE_WIDTH / 2, y: layout.y - NODE_HEIGHT / 2 }
}

function gridFallbackPosition(index: number): { x: number; y: number } {
  const col = index % 4
  const row = Math.floor(index / 4)
  return { x: col * 250, y: row * 120 }
}

function layoutConceptPositions(
  concepts: ResolvedConcept[],
  relations: { source: string; target: string }[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const g = buildDagreGraph(concepts, relations)

  for (const concept of concepts) {
    const pos = dagreNodePosition(g.node(concept.id))
    if (pos) positions.set(concept.id, pos)
  }

  let fallbackIndex = 0
  for (const concept of concepts) {
    if (positions.has(concept.id)) continue
    positions.set(concept.id, gridFallbackPosition(fallbackIndex))
    fallbackIndex += 1
  }

  return positions
}

/** Build a valid Nesso graph document from structured agent input. */
export function buildGraphDocument(input: BuildGraphInput): NessoGraphDocumentInput {
  const resolvedConcepts = normalizeConceptInputs(input.concepts)

  const relations = input.relations.map((rel) => ({
    source: resolveConceptRef(rel.from, resolvedConcepts),
    target: resolveConceptRef(rel.to, resolvedConcepts),
    type: rel.relation,
  }))

  const usedEdgeIds = new Set<string>()
  const documentRelations = relations.map((rel) => ({
    id: newElementId('e', usedEdgeIds),
    source: rel.source,
    target: rel.target,
    type: rel.type,
  }))

  const positions = layoutConceptPositions(resolvedConcepts, relations)

  const concepts = resolvedConcepts.map((concept) => {
    const pos = positions.get(concept.id) ?? { x: 0, y: 0 }
    return {
      id: concept.id,
      label: concept.label,
      x: pos.x,
      y: pos.y,
      ...(concept.elaboration !== undefined ? { data: { elaboration: concept.elaboration } } : {}),
    }
  })

  return {
    vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
    name: input.name,
    concepts,
    relations: documentRelations,
  }
}

/** Serialize a built graph document to importable JSON. */
export function buildGraphJson(input: BuildGraphInput): string {
  return serialize(buildGraphDocument(input))
}
