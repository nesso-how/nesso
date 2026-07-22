// SPDX-License-Identifier: AGPL-3.0-only

import type { NessoSettings } from '@/types/settings'
import type { GraphMeta, Viewport } from './types'

export const ZUSTAND_PERSIST_VERSION = 1

export interface PersistedGraphState {
  settings: Partial<NessoSettings>
  mentorPanelExpanded: boolean
  sidebarCollapsed: boolean
  sidebarDisplayOpen: boolean
  inspectorCollapsed: boolean
  currentGraphId: string
  graphList: GraphMeta[]
  viewports: Record<string, Viewport>
  onboardingStep: number | null
  onboardingPhase: 'tour' | 'consent' | null
  onboardingTourGraphId: string | null
  onboardingReviewOpened: boolean
  onboardingDeleteNodeDone: boolean
  reviewReminderLastShownByGraph?: Record<string, string>
}

type PersistMigration = (state: unknown) => unknown

const PERSIST_MIGRATIONS: Partial<Record<number, PersistMigration>> = {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidPersistVersion(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v >= 1
}

function hasValidUiBooleans(state: Record<string, unknown>): boolean {
  return (
    typeof state.mentorPanelExpanded === 'boolean' &&
    typeof state.sidebarCollapsed === 'boolean' &&
    typeof state.sidebarDisplayOpen === 'boolean' &&
    typeof state.inspectorCollapsed === 'boolean'
  )
}

function hasValidGraphFields(state: Record<string, unknown>): boolean {
  const reminders = state.reviewReminderLastShownByGraph
  return (
    typeof state.currentGraphId === 'string' &&
    Array.isArray(state.graphList) &&
    state.graphList.every(isGraphMeta) &&
    isRecord(state.viewports) &&
    Object.values(state.viewports).every(isViewport) &&
    (reminders === undefined ||
      (isRecord(reminders) && Object.values(reminders).every((value) => typeof value === 'string')))
  )
}

function isValidOnboardingStep(v: unknown): boolean {
  return v === null || (typeof v === 'number' && Number.isFinite(v))
}

function isValidOnboardingPhase(v: unknown): boolean {
  return v === null || v === 'tour' || v === 'consent'
}

function isNullOrString(v: unknown): boolean {
  return v === null || typeof v === 'string'
}

function hasValidOnboarding(state: Record<string, unknown>): boolean {
  return (
    isValidOnboardingStep(state.onboardingStep) &&
    isValidOnboardingPhase(state.onboardingPhase) &&
    isNullOrString(state.onboardingTourGraphId) &&
    typeof state.onboardingReviewOpened === 'boolean' &&
    typeof state.onboardingDeleteNodeDone === 'boolean'
  )
}

// ── settings field-level validation ──

function isValidLanguage(v: unknown): boolean {
  return v === 'en' || v === 'it'
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string')
}

function isStringOrNull(v: unknown): boolean {
  return v === null || typeof v === 'string'
}

function isFiniteNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v)
}

function isBoolean(v: unknown): boolean {
  return typeof v === 'boolean'
}

function isString(v: unknown): boolean {
  return typeof v === 'string'
}

const CATEGORY_PALETTE_VALUES = new Set<string>(['default', 'vivid', 'muted', 'monoCat'])

function isCategoryPalette(v: unknown): boolean {
  return typeof v === 'string' && CATEGORY_PALETTE_VALUES.has(v)
}

const EDGE_ENCODING_VALUES = new Set<string>(['full', 'category', 'minimal'])

function isEdgeEncoding(v: unknown): boolean {
  return typeof v === 'string' && EDGE_ENCODING_VALUES.has(v)
}

const CURVE_STYLE_VALUES = new Set<string>(['arc', 'straight'])

function isCurveStyle(v: unknown): boolean {
  return typeof v === 'string' && CURVE_STYLE_VALUES.has(v)
}

type SettingsFieldValidator = (value: unknown) => boolean

const SETTINGS_FIELD_VALIDATORS: Record<string, SettingsFieldValidator> = {
  // booleans
  dark: isBoolean,
  showHeatmap: isBoolean,
  autoCurveFlip: isBoolean,
  mentorEnabled: isBoolean,
  reviewEnabled: isBoolean,
  inspectorMemoryOpen: isBoolean,
  inspectorRelationsOpen: isBoolean,
  telemetry: isBoolean,
  onboardingCompleted: isBoolean,
  telemetryPromptShown: isBoolean,
  // constrained strings (enum)
  categoryPalette: isCategoryPalette,
  edgeEncoding: isEdgeEncoding,
  curveStyle: isCurveStyle,
  // strings
  aiBaseUrl: isString,
  aiModel: isString,
  aiApiKey: isString,
  // constrained strings
  language: isValidLanguage,
  // finite numbers
  fsrsRetention: isFiniteNumber,
  maximumInterval: isFiniteNumber,
  // string arrays
  knownProjects: isStringArray,
  // nullable strings
  activeProjectPath: isStringOrNull,
}

/** Validates a single settings key-value pair. Unknown keys are permissive
 *  so future versions' settings fields don't block loading. */
function isValidSettingsEntry(key: string, value: unknown): boolean {
  const validator = SETTINGS_FIELD_VALIDATORS[key]
  return validator === undefined ? true : validator(value)
}

function isValidSettingsPartial(settings: unknown): settings is Partial<NessoSettings> {
  if (!isRecord(settings)) return false
  return Object.entries(settings).every(([key, value]) => isValidSettingsEntry(key, value))
}

function isValidPersistedState(state: unknown): state is PersistedGraphState {
  if (!isRecord(state)) return false

  return (
    isValidSettingsPartial(state.settings) &&
    hasValidUiBooleans(state) &&
    hasValidGraphFields(state) &&
    hasValidOnboarding(state)
  )
}

function isGraphMeta(v: unknown): v is GraphMeta {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.updatedAt === 'number' &&
    Number.isFinite(v.updatedAt)
  )
}

function isViewport(v: unknown): v is Viewport {
  return (
    isRecord(v) &&
    typeof v.x === 'number' &&
    Number.isFinite(v.x) &&
    typeof v.y === 'number' &&
    Number.isFinite(v.y) &&
    typeof v.zoom === 'number' &&
    Number.isFinite(v.zoom)
  )
}

export function migratePersistedState(
  persistedState: unknown,
  storedVersion: number,
): PersistedGraphState {
  if (!isValidPersistVersion(storedVersion)) {
    throw new Error('Invalid Nesso persisted-state version')
  }

  if (storedVersion > ZUSTAND_PERSIST_VERSION) {
    throw new Error('Persisted Nesso state is from a newer app version')
  }

  let state = persistedState
  let version = storedVersion

  while (version < ZUSTAND_PERSIST_VERSION) {
    const migrate = PERSIST_MIGRATIONS[version]

    if (migrate === undefined) {
      throw new Error(`Unsupported Nesso persisted-state version: ${version}`)
    }

    state = migrate(state)
    version += 1
  }

  if (!isValidPersistedState(state)) {
    throw new Error('Invalid Nesso persisted state')
  }

  return state
}

/**
 * Validates a same-version Zustand persist blob before merging into the store.
 * Zustand does not invoke {@link migratePersistedState} for current-version blobs,
 * so this function closes the gap: it deep-validates settings fields and all
 * known persisted state keys, returning `null` for any malformed payload so
 * the merge path can safely fall back to runtime defaults.
 */
export function validateMergePayload(payload: unknown): PersistedGraphState | null {
  if (!isValidPersistedState(payload)) return null
  return payload
}
