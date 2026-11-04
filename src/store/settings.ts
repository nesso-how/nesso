import { z } from 'zod'
import type { PanelSizes, Preferences, WorkspaceState } from '@nesso-how/core'
import { isLocale } from '@nesso-how/i18n'
import { aiConversation, aiTextLimits } from '@nesso-how/ai'
import { NessoError, validationIssues } from '@nesso-how/errors'
import { sectionIds } from './types.ts'

export const defaultPanels: PanelSizes = { explorerWidth: 180, inspectorWidth: 210 }
export const defaultCanvasTabOrder: readonly string[] = [
  '@nesso-how/notes:notes',
  '@nesso-how/review:review',
]
export const panelLimits = {
  explorerWidth: { min: 180, max: 480 },
  inspectorWidth: { min: 200 },
} as const
export const maxViewNameLength = aiTextLimits.viewName
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
const savedViewSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(maxViewNameLength),
  conceptIds: z
    .array(z.string())
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate concept id'),
  pinned: z.boolean(),
})
const workspaceSchema = z
  .strictObject({
    activeViewId: z.string().nullable(),
    savedViews: z.array(savedViewSchema),
    viewports: z.record(z.string().min(1), viewportSchema),
  })
  .superRefine((workspace, context) => {
    const ids = new Set<string>()
    for (const [index, view] of workspace.savedViews.entries()) {
      if (ids.has(view.id))
        context.addIssue({
          code: 'custom',
          path: ['savedViews', index, 'id'],
          message: 'Duplicate view id',
        })
      ids.add(view.id)
    }
    if (workspace.activeViewId !== null && !ids.has(workspace.activeViewId))
      context.addIssue({ code: 'custom', path: ['activeViewId'], message: 'Unknown view' })
  }) satisfies z.ZodType<WorkspaceState>

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
  collapsedSections: z
    .array(z.enum(sectionIds))
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate section id')
    .optional(),
}) satisfies z.ZodType<Preferences>

export const parseWorkspace = (value: unknown): WorkspaceState =>
  parseSettings(workspaceSchema, value, 'workspace')
export const parsePreferences = (value: unknown): Preferences =>
  parseSettings(preferencesSchema, value, 'preferences')
