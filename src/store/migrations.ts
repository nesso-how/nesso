import { z } from 'zod'
import {
  iriSchema,
  migratePresetColor,
  newIri,
  parseGraph,
  serializeGraph,
} from '@nesso-how/schema'
import { checkMessageSize, pluginStorageLimits } from '@nesso-how/plugin/runtime'
import { aiChatLimits, aiConversation } from '@nesso-how/ai'
import { viewportKey } from '@nesso-how/core'
import { defaultCanvasTabOrder, fail, parseSettings, preferencesSchema } from './settings.ts'

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
const documentV5 = documentV2.extend({ version: z.literal(5) })
const documentV6 = documentV2.extend({ version: z.literal(6) })
const documentV7 = documentV2.extend({ version: z.literal(7) })
const workspaceV2 = z.looseObject({
  savedViews: z.array(z.looseObject({ conceptIds: z.array(z.string()) })),
})
const workspaceV3 = z.looseObject({
  activeViewId: z.string().nullable(),
  viewports: z.record(z.string(), z.unknown()),
})
const workspaceV4 = z.looseObject({
  savedViews: z.array(z.looseObject({ members: z.array(z.unknown()) })),
})
const workspaceV6 = z.looseObject({ activeViewId: z.unknown(), savedViews: z.unknown() })
const legacySections = new Map([
  ['sidebar.pinned-views', 'sidebar.pinned-maps'],
  ['sidebar.views', 'sidebar.maps'],
  ['inspector.views', 'inspector.maps'],
])
const legacyPreferences = preferencesSchema.extend({
  collapsedSections: z.array(z.string()).optional(),
})
const versionSchema = z.object({ version: z.number().int().positive() })
const preferencesV1 = z.strictObject({
  version: z.literal(1),
  preferences: legacyPreferences.omit({ disabledBundledActionPlugins: true, canvasTabOrder: true }),
})
const preferencesV2 = z.strictObject({
  version: z.literal(2),
  preferences: legacyPreferences.omit({ canvasTabOrder: true }),
})
const preferencesV3 = z.strictObject({ version: z.literal(3), preferences: legacyPreferences })
const preferencesV4 = z.strictObject({ version: z.literal(4), preferences: preferencesSchema })

export function migratePreferences(value: unknown): z.infer<typeof preferencesV4> {
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1:
      return migratePreferences({ ...parseSettings(preferencesV1, value), version: 2 })
    case 2: {
      const saved = parseSettings(preferencesV2, value)
      return migratePreferences({
        version: 3,
        preferences: { ...saved.preferences, canvasTabOrder: [...defaultCanvasTabOrder] },
      })
    }
    case 3: {
      const { preferences } = parseSettings(preferencesV3, value)
      const { collapsedSections, ...rest } = preferences
      return migratePreferences({
        version: 4,
        preferences:
          collapsedSections === undefined
            ? rest
            : {
                ...rest,
                collapsedSections: collapsedSections.map((id) => legacySections.get(id) ?? id),
              },
      })
    }
    case 4:
      return parseSettings(preferencesV4, value)
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

const pluginStorageV3 = z.strictObject({
  version: z.literal(3),
  documentId: iriSchema,
  plugins: z.array(
    z.looseObject({
      records: z.array(z.looseObject({ scope: z.looseObject({ kind: z.unknown() }).optional() })),
    }),
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
      return migratePluginStorage({
        ...saved,
        version: 3,
        plugins: saved.plugins.map(({ pluginId, ...entry }) => ({
          pluginId,
          local: false,
          ...entry,
        })),
      })
    }
    case 3: {
      const saved = parseSettings(pluginStorageV3, value)
      return {
        ...saved,
        version: 4,
        plugins: saved.plugins.map((entry) => ({
          ...entry,
          records: entry.records.map((record) =>
            record.scope?.kind === 'view'
              ? { ...record, scope: { ...record.scope, kind: 'map' } }
              : record,
          ),
        })),
      }
    }
    case 4:
      return value
    default:
      return fail('version', 'Unsupported plugin storage version')
  }
}

export function migrateDocument(value: unknown): z.infer<typeof documentV7> {
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1: {
      const saved = parseSettings(documentV1, value)
      return migrateDocument({ ...saved, version: 2, documentId: newIri() })
    }
    case 2: {
      const saved = parseSettings(documentV2, value)
      if (saved.graph === null) return migrateDocument({ ...saved, version: 3 })
      const { graph, maps: views } = parseGraph(saved.graph)
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
      const workspace =
        saved.workspace === null ? null : parseSettings(workspaceV3, saved.workspace, 'workspace')
      return migrateDocument({
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
      })
    }
    case 4: {
      const saved = parseSettings(documentV4, value)
      const workspace =
        saved.workspace === null ? null : parseSettings(workspaceV4, saved.workspace)
      return migrateDocument({
        ...saved,
        version: 5,
        workspace: workspace && {
          ...workspace,
          savedViews: workspace.savedViews.map((view) => ({
            ...view,
            members: view.members.map(migratePresetColor),
          })),
        },
      })
    }
    case 5:
      return migrateDocument({ ...parseSettings(documentV5, value), version: 6 })
    case 6: {
      const saved = parseSettings(documentV6, value)
      if (saved.workspace === null) return { ...saved, version: 7 }
      const { activeViewId, savedViews, ...workspace } = parseSettings(
        workspaceV6,
        saved.workspace,
        'workspace',
      )
      return {
        ...saved,
        version: 7,
        workspace: { activeMapId: activeViewId, maps: savedViews, ...workspace },
      }
    }
    case 7:
      return parseSettings(documentV7, value)
    default:
      return fail('version', 'Unsupported storage version')
  }
}
