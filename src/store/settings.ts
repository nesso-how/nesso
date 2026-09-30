import type { Viewport } from '@nesso/plugin'
import { NessoError } from './errors.ts'
import type { HostPreferences, HostWorkspace, PanelSizes } from './types.ts'

export const defaultPanels: PanelSizes = { explorerWidth: 256, inspectorWidth: 280 }

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
    explorerWidth: number(panels.explorerWidth, 'preferences.panels.explorerWidth', 200, 480),
    inspectorWidth: number(panels.inspectorWidth, 'preferences.panels.inspectorWidth', 200),
  }
}

export const parseTagFilter = (value: unknown): string[] => {
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string')) {
    fail('workspace.tagFilter', 'Expected tag strings')
  }
  return [...new Set((value as string[]).map((tag) => tag.trim()).filter(Boolean))]
}

export const parseWorkspace = (value: unknown): HostWorkspace => {
  const workspace = object(value, 'workspace', ['focusId', 'view', 'tagFilter', 'viewports'])
  if (workspace.view !== 'focus' && workspace.view !== 'whole') fail('workspace.view', 'Unknown view mode')
  const viewports = object(workspace.viewports, 'workspace.viewports')
  return {
    focusId: string(workspace.focusId, 'workspace.focusId'),
    view: workspace.view as HostWorkspace['view'],
    tagFilter: parseTagFilter(workspace.tagFilter),
    viewports: Object.fromEntries(Object.entries(viewports).map(([id, viewport]) => {
      if (!id) fail('workspace.viewports', 'Expected a renderer id')
      return [id, parseViewport(viewport, `workspace.viewports.${id}`)]
    })),
  }
}

export const parsePreferences = (value: unknown): HostPreferences => {
  const preferences = object(value, 'preferences', ['activeVocabId', 'activeRendererId', 'activeThemeId', 'panels'])
  return {
    activeVocabId: string(preferences.activeVocabId, 'preferences.activeVocabId'),
    activeRendererId: string(preferences.activeRendererId, 'preferences.activeRendererId'),
    activeThemeId: preferences.activeThemeId === undefined ? '' : string(preferences.activeThemeId, 'preferences.activeThemeId'),
    panels: parsePanels(preferences.panels),
  }
}
