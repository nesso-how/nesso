import { z } from 'zod'
import { iriSchema, newIri, parseGraph, serializeGraph } from '@nesso-how/schema'
import { checkMessageSize, pluginStorageLimits } from '@nesso-how/plugin/runtime'
import { aiChatLimits, aiConversation } from '@nesso-how/ai'
import { viewportKey } from '@nesso-how/core'
import {
  defaultCanvasTabOrder,
  fail,
  parseSettings,
  parseWorkspace,
  preferencesSchema,
} from './settings.ts'

const conversationV1 = z.strictObject({
  version: z.literal(1),
  messages: z
    .array(aiConversation.shape.messages.element.omit({ stats: true }))
    .max(aiChatLimits.messageCount),
})

const documentV1 = z.strictObject({
  version: z.literal(1),
  graph: z.unknown(),
  workspace: z.unknown(),
})
const documentV2 = z.strictObject({
  version: z.literal(2),
  documentId: iriSchema,
  graph: z.unknown(),
  workspace: z.unknown(),
})
const documentV3 = documentV2.extend({ version: z.literal(3) })
const documentV4 = documentV2.extend({ version: z.literal(4) })
const workspaceV2 = z.looseObject({
  savedViews: z.array(z.looseObject({ conceptIds: z.array(z.string()) })),
})
const versionSchema = z.object({ version: z.number().int().positive() })
const preferencesV1 = z.strictObject({
  version: z.literal(1),
  preferences: preferencesSchema.omit({ disabledBundledActionPlugins: true, canvasTabOrder: true }),
})
const preferencesV2 = z.strictObject({
  version: z.literal(2),
  preferences: preferencesSchema.omit({ canvasTabOrder: true }),
})
const preferencesV3 = z.strictObject({ version: z.literal(3), preferences: preferencesSchema })

export function migratePreferences(value: unknown): z.infer<typeof preferencesV3> {
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1:
      return migratePreferences({ ...parseSettings(preferencesV1, value), version: 2 })
    case 2: {
      const saved = parseSettings(preferencesV2, value)
      return {
        version: 3,
        preferences: { ...saved.preferences, canvasTabOrder: [...defaultCanvasTabOrder] },
      }
    }
    case 3:
      return parseSettings(preferencesV3, value)
    default:
      return fail('version', 'Unsupported preferences version')
  }
}

export function migrateConversation(value: unknown): z.infer<typeof aiConversation> {
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1:
      return migrateConversation({ ...parseSettings(conversationV1, value), version: 2 })
    case 2:
      return parseSettings(aiConversation, value)
    default:
      return fail('version', 'Unsupported conversation version')
  }
}

const pluginStorageV1 = z.strictObject({
  version: z.literal(1),
  documentId: iriSchema,
  plugins: z.array(
    z.strictObject({
      pluginId: z.string(),
      revision: z.unknown(),
      records: z.array(
        z.strictObject({
          key: z.string(),
          conceptId: z.string().max(2048).optional(),
          value: z.unknown(),
        }),
      ),
    }),
  ),
})

const pluginStorageV2 = z.strictObject({
  version: z.literal(2),
  documentId: iriSchema,
  plugins: z.array(
    z.strictObject({ pluginId: z.string(), revision: z.unknown(), records: z.unknown() }),
  ),
})

export function migratePluginStorage(value: unknown): unknown {
  checkMessageSize(value, pluginStorageLimits.total)
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1: {
      const saved = parseSettings(pluginStorageV1, value)
      return migratePluginStorage({
        ...saved,
        version: 2,
        plugins: saved.plugins.map((entry) => ({
          ...entry,
          records: entry.records.map(({ conceptId, ...record }) =>
            conceptId === undefined
              ? record
              : { ...record, scope: { kind: 'concept', id: conceptId } },
          ),
        })),
      })
    }
    case 2: {
      const saved = parseSettings(pluginStorageV2, value)
      return {
        ...saved,
        version: 3,
        plugins: saved.plugins.map(({ pluginId, ...entry }) => ({
          pluginId,
          local: false,
          ...entry,
        })),
      }
    }
    case 3:
      return value
    default:
      return fail('version', 'Unsupported plugin storage version')
  }
}

export function migrateDocument(value: unknown): z.infer<typeof documentV4> {
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1: {
      const saved = parseSettings(documentV1, value)
      return migrateDocument({ ...saved, version: 2, documentId: newIri() })
    }
    case 2: {
      const saved = parseSettings(documentV2, value)
      if (saved.graph === null) return migrateDocument({ ...saved, version: 3 })
      const { graph, views } = parseGraph(saved.graph)
      const workspace = parseSettings(workspaceV2, saved.workspace)
      const presentation = new Map(views[0]?.members.map((member) => [member.id, member]))
      const members = (ids: readonly string[]) =>
        ids.map((id) => presentation.get(id) ?? { id, position: { x: 0, y: 0 } })
      const listed = new Set(workspace.savedViews.flatMap(({ conceptIds }) => conceptIds))
      const unsorted = graph.concepts.flatMap(({ id }) => (listed.has(id) ? [] : [id]))
      return migrateDocument({
        ...saved,
        version: 3,
        graph: serializeGraph(graph),
        workspace: {
          ...workspace,
          savedViews: [
            ...workspace.savedViews.map(({ conceptIds, ...view }) => ({
              ...view,
              members: members(conceptIds),
            })),
            ...(unsorted.length
              ? [{ id: newIri(), name: 'Unsorted', members: members(unsorted), pinned: false }]
              : []),
          ],
        },
      })
    }
    case 3: {
      const saved = parseSettings(documentV3, value)
      const workspace = saved.workspace === null ? null : parseWorkspace(saved.workspace)
      return {
        ...saved,
        version: 4,
        workspace: workspace && {
          ...workspace,
          viewports: Object.fromEntries(
            Object.entries(workspace.viewports).map(([rendererId, viewport]) => [
              viewportKey(rendererId, workspace.activeViewId),
              viewport,
            ]),
          ),
        },
      }
    }
    case 4:
      return parseSettings(documentV4, value)
    default:
      return fail('version', 'Unsupported storage version')
  }
}
