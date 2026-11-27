import { z } from 'zod'
import type { PanelSizes, Preferences, WorkspaceState } from '@nesso-how/core'
import { isLocale } from '@nesso-how/i18n'
import { aiConversation, aiTextLimits } from '@nesso-how/ai'
import { NessoError, validationIssues } from '@nesso-how/errors'
import { relationBendSchema, conceptMapMemberSchema } from '@nesso-how/schema'
import { sectionIds } from './types.ts'
import { appearances } from '../../shared/appearance.ts'

export const defaultPanels: PanelSizes = { explorerWidth: 180, inspectorWidth: 210 }
export const defaultCanvasTabOrder: readonly string[] = [
  '@nesso-how/notes:notes',
  '@nesso-how/review:review',
]
export const panelLimits = {
  explorerWidth: { min: 180, max: 480 },
  inspectorWidth: { min: 200 },
} as const
export const maxMapNameLength = aiTextLimits.mapName
export const maxConceptLabelLength = aiTextLimits.conceptLabel
export const maxRelationLabelLength = aiTextLimits.relationLabel

export const resolveInspector = (panels: PanelSizes, hasChat: boolean) => ({
  width: hasChat && panels.inspectorWidth < 300 ? 360 : panels.inspectorWidth,
  minWidth: hasChat ? 300 : panelLimits.inspectorWidth.min,
})

export const fail = (path: string, message: string): never => {
  throw new NessoError([{ path, message }])
}

export function parseSettings<T extends z.ZodType>(
  schema: T,
  value: unknown,
  prefix = '',
): z.output<T> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new NessoError(validationIssues(parsed.error.issues, prefix))
  return parsed.data
}

export const parseConversation = (value: unknown) => ({
  messages: parseSettings(aiConversation, value).messages,
})

const viewportSchema = z.strictObject({ x: z.number(), y: z.number(), zoom: z.number().positive() })
const mapSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(maxMapNameLength),
  members: z
    .array(conceptMapMemberSchema)
    .refine(
      (members) => new Set(members.map(({ id }) => id)).size === members.length,
      'Duplicate concept id',
    ),
  groupId: z.string().min(1).optional(),
  relationBends: z.array(relationBendSchema).optional(),
})
export const workspaceFieldsSchema = z.strictObject({
  activeMapId: z.string().nullable(),
  maps: z.array(mapSchema),
  pinnedMapIds: z
    .array(mapSchema.shape.id)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate map id'),
  mapGroups: z.array(z.strictObject({ id: mapSchema.shape.id, name: mapSchema.shape.name })),
  collapsedMapGroupIds: z
    .array(mapSchema.shape.id)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate group id')
    .optional(),
  viewports: z.record(z.string().min(1), viewportSchema),
})

const checkReferences = (
  workspace: WorkspaceState,
  report: (path: (string | number)[], message: string) => void,
): void => {
  const groupIds = new Set<string>()
  for (const [index, group] of workspace.mapGroups.entries()) {
    if (groupIds.has(group.id)) report(['mapGroups', index, 'id'], 'Duplicate group id')
    groupIds.add(group.id)
  }
  for (const [index, id] of (workspace.collapsedMapGroupIds ?? []).entries()) {
    if (!groupIds.has(id)) report(['collapsedMapGroupIds', index], 'Unknown group')
  }
  const ids = new Set<string>()
  for (const [index, map] of workspace.maps.entries()) {
    if (ids.has(map.id)) report(['maps', index, 'id'], 'Duplicate map id')
    ids.add(map.id)
    if (map.groupId !== undefined && !groupIds.has(map.groupId))
      report(['maps', index, 'groupId'], 'Unknown group')
  }
  if (workspace.activeMapId !== null && !ids.has(workspace.activeMapId))
    report(['activeMapId'], 'Unknown map')
  for (const [index, id] of workspace.pinnedMapIds.entries()) {
    if (!ids.has(id)) report(['pinnedMapIds', index], 'Unknown map')
  }
}

export const validReferences = (workspace: WorkspaceState): boolean => {
  let valid = true
  checkReferences(workspace, () => {
    valid = false
  })
  return valid
}

const workspaceSchema = workspaceFieldsSchema.superRefine((workspace, context) =>
  checkReferences(workspace, (path, message) =>
    context.addIssue({ code: 'custom', path, message }),
  ),
) satisfies z.ZodType<WorkspaceState>

export const preferencesSchema = z.strictObject({
  locale: z.custom<NonNullable<Preferences['locale']>>(isLocale, 'Unsupported locale').optional(),
  introSeen: z.boolean().optional(),
  mcpEnabled: z.boolean().optional(),
  disabledBundledActionPlugins: z
    .array(z.string().min(1))
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate plugin id')
    .optional(),
  canvasTabOrder: z
    .array(z.string().min(1))
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate tab id')
    .optional(),
  activeVocabId: z.string(),
  activeRendererId: z.string(),
  activeThemeId: z.string().default(''),
  panels: z.strictObject({
    explorerWidth: z.number().min(panelLimits.explorerWidth.min).max(panelLimits.explorerWidth.max),
    inspectorWidth: z.number().min(panelLimits.inspectorWidth.min),
  }),
  inspectorTab: z.enum(['details', 'chat']).optional(),
  appearance: z.enum(appearances).optional(),
  relationGroups: z.boolean().optional(),
  collapsedSections: z
    .array(z.enum(sectionIds))
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate section id')
    .optional(),
}) satisfies z.ZodType<Preferences>

export const parseWorkspace = (value: unknown): WorkspaceState =>
  parseSettings(workspaceSchema, value, 'workspace')
export const parsePreferences = (value: unknown): Preferences =>
  parseSettings(preferencesSchema, value, 'preferences')
