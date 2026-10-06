import type { Viewport } from '@nesso/plugin'
import { NessoError } from './errors.ts'
import { sectionIds, type HostPreferences, type HostWorkspace, type PanelSizes, type SectionId } from './types.ts'

export const defaultPanels: PanelSizes = { explorerWidth: 180, inspectorWidth: 210 }
export const panelLimits = {
  explorerWidth: { min: 180, max: 480 },
  inspectorWidth: { min: 200 },
} as const
export const maxViewNameLength = 70

export const fail = (path: string, message: string): never => {
  throw new NessoError([{ path, message }])
}

export const object = (value: unknown, path: string, keys?: readonly string[]): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'Expected an object')
  const result = value as Record<string, unknown>
  if (keys && Object.keys(result).some((key) => !keys.includes(key))) fail(path, 'Unsupported property')
  return result
}

const string = (value: unknown, path: string): string => {
  if (typeof value !== 'string') fail(path, 'Expected a string')
  return value as string
}

const number = (value: unknown, path: string, minimum?: number, maximum?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'Expected a finite number')
  const result = value as number
  if (minimum !== undefined && result < minimum) fail(path, `Expected at least ${minimum}`)
  if (maximum !== undefined && result > maximum) fail(path, `Expected at most ${maximum}`)
  return result
}

export const parseViewport = (value: unknown, path: string): Viewport => {
  const viewport = object(value, path, ['x', 'y', 'zoom'])
  const zoom = number(viewport.zoom, `${path}.zoom`)
  if (zoom <= 0) fail(`${path}.zoom`, 'Expected a positive zoom')
  return { x: number(viewport.x, `${path}.x`), y: number(viewport.y, `${path}.y`), zoom }
}

export const parsePanels = (value: unknown): PanelSizes => {
  const panels = object(value, 'preferences.panels', ['explorerWidth', 'inspectorWidth'])
  return {
    explorerWidth: number(panels.explorerWidth, 'preferences.panels.explorerWidth', panelLimits.explorerWidth.min, panelLimits.explorerWidth.max),
    inspectorWidth: number(panels.inspectorWidth, 'preferences.panels.inspectorWidth', panelLimits.inspectorWidth.min),
  }
}

export const parseWorkspace = (value: unknown): HostWorkspace => {
  const workspace = object(value, 'workspace', ['activeViewId', 'savedViews', 'viewports'])
  if (!Array.isArray(workspace.savedViews)) fail('workspace.savedViews', 'Expected saved views')
  const ids = new Set<string>()
  const savedViews = (workspace.savedViews as unknown[]).map((value, index) => {
    const path = `workspace.savedViews[${index}]`
    const view = object(value, path, ['id', 'name', 'conceptIds', 'pinned'])
    const id = string(view.id, `${path}.id`)
    const name = string(view.name, `${path}.name`).trim()
    if (!id || ids.has(id)) fail(`${path}.id`, 'Duplicate or missing view id')
    ids.add(id)
    if (!name || name.length > maxViewNameLength) fail(`${path}.name`, `Expected a name of 1–${maxViewNameLength} characters`)
    if (!Array.isArray(view.conceptIds) || !view.conceptIds.every((id) => typeof id === 'string')) {
      fail(`${path}.conceptIds`, 'Expected concept ids')
    }
    const conceptIds = view.conceptIds as string[]
    if (new Set(conceptIds).size !== conceptIds.length) fail(`${path}.conceptIds`, 'Duplicate concept id')
    if (typeof view.pinned !== 'boolean') fail(`${path}.pinned`, 'Expected a boolean')
    return { id, name, conceptIds: [...conceptIds], pinned: view.pinned as boolean }
  })
  const activeViewId = workspace.activeViewId === null ? null : string(workspace.activeViewId, 'workspace.activeViewId')
  if (activeViewId !== null && !ids.has(activeViewId)) fail('workspace.activeViewId', 'Unknown view')
  const viewports = object(workspace.viewports, 'workspace.viewports')
  return {
    activeViewId,
    savedViews,
    viewports: Object.fromEntries(Object.entries(viewports).map(([id, viewport]) => {
      if (!id) fail('workspace.viewports', 'Expected a renderer id')
      return [id, parseViewport(viewport, `workspace.viewports.${id}`)]
    })),
  }
}

export const parsePreferences = (value: unknown): HostPreferences => {
  const preferences = object(value, 'preferences', ['activeVocabId', 'activeRendererId', 'activeThemeId', 'panels', 'collapsedSections'])
  let collapsedSections: SectionId[] | undefined
  if (preferences.collapsedSections !== undefined) {
    if (!Array.isArray(preferences.collapsedSections)) fail('preferences.collapsedSections', 'Expected section ids')
    collapsedSections = (preferences.collapsedSections as unknown[]).map((id, index) => {
      if (!(sectionIds as readonly unknown[]).includes(id)) fail(`preferences.collapsedSections[${index}]`, 'Unknown section')
      return id as SectionId
    })
    if (new Set(collapsedSections).size !== collapsedSections.length) fail('preferences.collapsedSections', 'Duplicate section id')
  }
  return {
    activeVocabId: string(preferences.activeVocabId, 'preferences.activeVocabId'),
    activeRendererId: string(preferences.activeRendererId, 'preferences.activeRendererId'),
    activeThemeId: preferences.activeThemeId === undefined ? '' : string(preferences.activeThemeId, 'preferences.activeThemeId'),
    panels: parsePanels(preferences.panels),
    ...(collapsedSections === undefined ? {} : { collapsedSections }),
  }
}
