// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import persistedV1 from './fixtures/persist/v1.json'
import { ZUSTAND_PERSIST_VERSION, migratePersistedState, validateMergePayload } from './persistence'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

describe('Zustand persisted-state compatibility', () => {
  it('replays the released persist-v1 fixture unchanged', () => {
    expect(migratePersistedState(persistedV1, ZUSTAND_PERSIST_VERSION)).toEqual(persistedV1)
  })

  it('rejects an unversioned alpha blob', () => {
    expect(() => migratePersistedState(persistedV1, 0)).toThrow(
      'Invalid Nesso persisted-state version',
    )
  })

  it('rejects a persisted blob from a newer app', () => {
    expect(() => migratePersistedState(persistedV1, ZUSTAND_PERSIST_VERSION + 1)).toThrow(
      'Persisted Nesso state is from a newer app version',
    )
  })

  // ── malformed stored versions ──

  it('rejects stored version undefined', () => {
    expect(() => migratePersistedState(persistedV1, undefined as unknown as number)).toThrow(
      'Invalid Nesso persisted-state version',
    )
  })

  it('rejects stored version NaN', () => {
    expect(() => migratePersistedState(persistedV1, NaN)).toThrow(
      'Invalid Nesso persisted-state version',
    )
  })

  it.each([-1, 1.5, Infinity, -Infinity])('rejects non-positive-integer stored version %s', (v) => {
    expect(() => migratePersistedState(persistedV1, v)).toThrow(
      'Invalid Nesso persisted-state version',
    )
  })

  it('rejects string stored version', () => {
    expect(() => migratePersistedState(persistedV1, '1' as unknown as number)).toThrow(
      'Invalid Nesso persisted-state version',
    )
  })

  it('rejects null stored version', () => {
    expect(() => migratePersistedState(persistedV1, null as unknown as number)).toThrow(
      'Invalid Nesso persisted-state version',
    )
  })

  // ── malformed state shapes ──

  it('rejects a non-object current-version payload', () => {
    expect(() => migratePersistedState(null, ZUSTAND_PERSIST_VERSION)).toThrow(
      'Invalid Nesso persisted state',
    )
  })

  it('rejects an array payload', () => {
    expect(() => migratePersistedState([], ZUSTAND_PERSIST_VERSION)).toThrow(
      'Invalid Nesso persisted state',
    )
  })

  it('rejects a payload missing required fields', () => {
    const missing = { settings: { dark: true } }
    expect(() => migratePersistedState(missing, ZUSTAND_PERSIST_VERSION)).toThrow(
      'Invalid Nesso persisted state',
    )
  })

  it('rejects a payload with wrong-type mentorPanelExpanded', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).mentorPanelExpanded = 'yes'
    expect(() => migratePersistedState(bad, ZUSTAND_PERSIST_VERSION)).toThrow(
      'Invalid Nesso persisted state',
    )
  })

  it('rejects a payload with wrong-type currentGraphId', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).currentGraphId = 42
    expect(() => migratePersistedState(bad, ZUSTAND_PERSIST_VERSION)).toThrow(
      'Invalid Nesso persisted state',
    )
  })

  it('rejects a payload with non-string graphList entry id', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).graphList = [{ id: 1, name: 'x', updatedAt: 1 }]
    expect(() => migratePersistedState(bad, ZUSTAND_PERSIST_VERSION)).toThrow(
      'Invalid Nesso persisted state',
    )
  })

  it('rejects a payload with non-number viewport zoom', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).viewports = { 'graph-1': { x: 0, y: 0, zoom: '1.25' } }
    expect(() => migratePersistedState(bad, ZUSTAND_PERSIST_VERSION)).toThrow(
      'Invalid Nesso persisted state',
    )
  })

  it('rejects a payload with wrong-type onboardingStep', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).onboardingStep = 'step-1'
    expect(() => migratePersistedState(bad, ZUSTAND_PERSIST_VERSION)).toThrow(
      'Invalid Nesso persisted state',
    )
  })

  it('rejects a payload with wrong-type onboardingPhase', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).onboardingPhase = true
    expect(() => migratePersistedState(bad, ZUSTAND_PERSIST_VERSION)).toThrow(
      'Invalid Nesso persisted state',
    )
  })

  it('accepts a minimal valid v1 shape (partial settings)', () => {
    const minimal = {
      settings: { dark: false },
      mentorPanelExpanded: false,
      sidebarCollapsed: false,
      sidebarDisplayOpen: false,
      inspectorCollapsed: false,
      currentGraphId: 'g',
      graphList: [],
      viewports: {},
      onboardingStep: null,
      onboardingPhase: null,
      onboardingTourGraphId: null,
      onboardingReviewOpened: false,
      onboardingDeleteNodeDone: false,
    }
    expect(migratePersistedState(minimal, ZUSTAND_PERSIST_VERSION)).toEqual(minimal)
  })
})

// ── merge-path validation (same-version blobs) ──

describe('validateMergePayload', () => {
  it('accepts the release v1 fixture', () => {
    expect(validateMergePayload(persistedV1)).toEqual(persistedV1)
  })

  it('accepts a minimal valid payload with partial settings', () => {
    const minimal = {
      settings: { dark: false },
      mentorPanelExpanded: false,
      sidebarCollapsed: false,
      sidebarDisplayOpen: false,
      inspectorCollapsed: false,
      currentGraphId: 'g',
      graphList: [],
      viewports: {},
      onboardingStep: null,
      onboardingPhase: null,
      onboardingTourGraphId: null,
      onboardingReviewOpened: false,
      onboardingDeleteNodeDone: false,
    }
    expect(validateMergePayload(minimal)).toEqual(minimal)
  })

  it('returns null for non-object payload', () => {
    expect(validateMergePayload(null)).toBeNull()
  })

  it('returns null for array payload', () => {
    expect(validateMergePayload([])).toBeNull()
  })

  it('returns null for payload missing required fields', () => {
    const missing = { settings: { dark: true } }
    expect(validateMergePayload(missing)).toBeNull()
  })

  it('returns null for payload with wrong-type mentorPanelExpanded', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).mentorPanelExpanded = 'yes'
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('returns null for payload with wrong-type currentGraphId', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).currentGraphId = 42
    expect(validateMergePayload(bad)).toBeNull()
  })

  // ── settings deep validation ──

  it('returns null when settings is not a record', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = 'invalid'
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('returns null when settings is an array', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = []
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('returns null when settings is null', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = null
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('returns null when knownProjects is not an array', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      knownProjects: '/some/path',
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('returns null when knownProjects contains non-string entries', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      knownProjects: ['/valid', 42, '/also-valid'],
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('accepts valid knownProjects string array', () => {
    const good = clone(persistedV1)
    ;(good as Record<string, unknown>).settings = {
      ...((good as Record<string, unknown>).settings as Record<string, unknown>),
      knownProjects: ['/project-a', '/project-b'],
    }
    expect(validateMergePayload(good)).not.toBeNull()
  })

  it('returns null when activeProjectPath is a number', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      activeProjectPath: 123,
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('accepts activeProjectPath as null', () => {
    const good = clone(persistedV1)
    ;(good as Record<string, unknown>).settings = {
      ...((good as Record<string, unknown>).settings as Record<string, unknown>),
      activeProjectPath: null,
    }
    expect(validateMergePayload(good)).not.toBeNull()
  })

  it('accepts activeProjectPath as string', () => {
    const good = clone(persistedV1)
    ;(good as Record<string, unknown>).settings = {
      ...((good as Record<string, unknown>).settings as Record<string, unknown>),
      activeProjectPath: '/valid/path',
    }
    expect(validateMergePayload(good)).not.toBeNull()
  })

  it('returns null when aiBaseUrl is not a string', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      aiBaseUrl: 8080,
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('returns null when fsrsRetention is not a finite number', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      fsrsRetention: NaN,
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('returns null when dark is not a boolean', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      dark: 'yes',
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('returns null when telemetry is not a boolean', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      telemetry: 'yes',
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('returns null when language is not en or it', () => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      language: 'fr',
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it('accepts language en', () => {
    const good = clone(persistedV1)
    ;(good as Record<string, unknown>).settings = {
      ...((good as Record<string, unknown>).settings as Record<string, unknown>),
      language: 'en',
    }
    expect(validateMergePayload(good)).not.toBeNull()
  })

  it('accepts language it', () => {
    const good = clone(persistedV1)
    ;(good as Record<string, unknown>).settings = {
      ...((good as Record<string, unknown>).settings as Record<string, unknown>),
      language: 'it',
    }
    expect(validateMergePayload(good)).not.toBeNull()
  })

  it('accepts settings with known optional fields', () => {
    const good = clone(persistedV1)
    ;(good as Record<string, unknown>).settings = {
      dark: true,
      language: 'en',
      categoryPalette: 'default',
      telemetry: false,
      knownProjects: ['/p1'],
      activeProjectPath: '/p1',
      aiBaseUrl: 'http://localhost:11434',
      aiModel: 'llama3',
      aiApiKey: '',
      edgeEncoding: 'full',
      showHeatmap: true,
      curveStyle: 'arc',
      autoCurveFlip: false,
      mentorEnabled: true,
      reviewEnabled: false,
      fsrsRetention: 0.9,
      maximumInterval: 365,
      inspectorMemoryOpen: true,
      inspectorRelationsOpen: false,
      onboardingCompleted: false,
      telemetryPromptShown: true,
    }
    expect(validateMergePayload(good)).not.toBeNull()
  })

  // ── settings enum/domain validation ──

  it.each(['invalid', 'defaultX', '', 'none'])('returns null when categoryPalette is %s', (val) => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      categoryPalette: val,
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it.each(['default', 'vivid', 'muted', 'monoCat'])('accepts categoryPalette %s', (val) => {
    const good = clone(persistedV1)
    ;(good as Record<string, unknown>).settings = {
      ...((good as Record<string, unknown>).settings as Record<string, unknown>),
      categoryPalette: val,
    }
    expect(validateMergePayload(good)).not.toBeNull()
  })

  it.each(['invalid', 'compact', '', 'none'])('returns null when edgeEncoding is %s', (val) => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      edgeEncoding: val,
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it.each(['full', 'category', 'minimal'])('accepts edgeEncoding %s', (val) => {
    const good = clone(persistedV1)
    ;(good as Record<string, unknown>).settings = {
      ...((good as Record<string, unknown>).settings as Record<string, unknown>),
      edgeEncoding: val,
    }
    expect(validateMergePayload(good)).not.toBeNull()
  })

  it.each(['invalid', 'bezier', '', 'none'])('returns null when curveStyle is %s', (val) => {
    const bad = clone(persistedV1)
    ;(bad as Record<string, unknown>).settings = {
      ...((bad as Record<string, unknown>).settings as Record<string, unknown>),
      curveStyle: val,
    }
    expect(validateMergePayload(bad)).toBeNull()
  })

  it.each(['arc', 'straight'])('accepts curveStyle %s', (val) => {
    const good = clone(persistedV1)
    ;(good as Record<string, unknown>).settings = {
      ...((good as Record<string, unknown>).settings as Record<string, unknown>),
      curveStyle: val,
    }
    expect(validateMergePayload(good)).not.toBeNull()
  })

  // ── E2E persisted-state helper contract ──

  it('accepts the minimal E2E-ready payload with onboarding completed and telemetry shown', () => {
    const e2eReady = {
      settings: {
        onboardingCompleted: true,
        telemetryPromptShown: true,
      },
      mentorPanelExpanded: false,
      sidebarCollapsed: false,
      sidebarDisplayOpen: true,
      inspectorCollapsed: false,
      currentGraphId: '',
      graphList: [],
      viewports: {},
      onboardingStep: null,
      onboardingPhase: null,
      onboardingTourGraphId: null,
      onboardingReviewOpened: false,
      onboardingDeleteNodeDone: false,
    }
    expect(validateMergePayload(e2eReady)).toEqual(e2eReady)
  })

  it('rejects a settings-only partial payload (the broken gotoApp shape)', () => {
    const partial = { settings: { onboardingCompleted: true, telemetryPromptShown: true } }
    expect(validateMergePayload(partial)).toBeNull()
  })
})
