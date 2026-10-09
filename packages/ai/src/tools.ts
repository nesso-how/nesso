import { z } from 'zod'
import { aiTextLimits } from './policy.ts'

const id = z.string().min(1)
const ids = z.array(id).max(100)
const position = z.strictObject({ x: z.number(), y: z.number() })
const page = { offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(50) }
const scope = z.enum(['active', 'all']).default('active')
const operation = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('concept.add'), id, position: position.optional() }),
  z.strictObject({ kind: z.literal('concept.label'), id, value: z.string().max(aiTextLimits.conceptLabel) }),
  z.strictObject({ kind: z.literal('concept.position'), id, value: position }),
  z.strictObject({ kind: z.literal('concept.positions'), updates: z.array(z.strictObject({ id, position })).max(500) }),
  z.strictObject({ kind: z.literal('concept.remove'), id }),
  z.strictObject({ kind: z.literal('relation.connect'), source: id, target: id }),
  z.strictObject({ kind: z.literal('relation.reconnect'), id, source: id, target: id }),
  z.strictObject({ kind: z.literal('relation.type'), id, typeId: id }),
  z.strictObject({ kind: z.literal('relation.type.create'), id, typeId: id, label: z.string().max(aiTextLimits.relationLabel) }),
  z.strictObject({ kind: z.literal('relation.remove'), id }),
  z.strictObject({ kind: z.literal('view.create'), id, name: z.string().max(aiTextLimits.viewName), conceptIds: z.array(id).max(500) }),
  z.strictObject({ kind: z.literal('view.rename'), id, name: z.string().max(aiTextLimits.viewName) }),
  z.strictObject({ kind: z.literal('view.pin'), id, pinned: z.boolean() }),
  z.strictObject({ kind: z.literal('view.membership'), viewId: id, conceptId: id, included: z.boolean() }),
  z.strictObject({ kind: z.literal('view.remove'), id }),
])

export const aiTools = {
  context: {
    description: 'Read counts, active view, selection IDs, vocabulary and shared history flags. No complete graph is sent. Read the full selection page by page with the selection tool.',
    inputSchema: z.strictObject({}),
  },
  concepts: {
    description: 'Read a page of concepts by IDs or label search. Defaults to the active view; use all for the complete graph.',
    inputSchema: z.strictObject({ ids: ids.optional(), query: z.string().max(256).optional(), scope, ...page }),
  },
  relations: {
    description: 'Read a page of relations by IDs or incident concept ID. Relation IDs identify triples and change when retyped or reconnected.',
    inputSchema: z.strictObject({ ids: ids.optional(), conceptId: id.optional(), scope, ...page }),
  },
  views: {
    description: 'List paginated saved-view summaries, or read a page of membership IDs with id. All is the complete graph, has id null and cannot be deleted. Deleting the active saved view falls back to All.',
    inputSchema: z.strictObject({ id: id.nullable().optional(), ...page }),
  },
  relation_types: {
    description: 'Read available relation types from the graph and active vocabulary. Preserve their IRIs.',
    inputSchema: z.strictObject({ ...page }),
  },
  selection: {
    description: 'Read the current selection page by page. Use it when selectionCount exceeds the entries shown by context.',
    inputSchema: z.strictObject({ ...page }),
  },
  edit: {
    description: 'Stage ordered undoable graph and saved-view operations, not live writes. Supply unique absolute IRIs for new concepts and types. New concepts join the active view and link to a single selected concept using the default type. All edits in a turn apply together after validation and any in-app approval, as a single undoable batch.',
    inputSchema: z.strictObject({ operations: z.array(operation).min(1).max(500) }),
  },
  history: {
    description: 'Stage shared document undo or redo as the only write in this turn. Cannot be mixed with edit.',
    inputSchema: z.strictObject({ action: z.enum(['undo', 'redo']) }),
  },
} as const
