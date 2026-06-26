// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { StateCreator } from 'zustand'
import type { ConceptNodeData, GraphDisplaySettings } from '@/types/graph'
import { defaultGraphDisplay, mergeGraphDisplay } from '@/types/graph'
import { SEEDS, getSeedsForLanguage } from '@/data/seedGraph'
import { isGraphId, newGraphId } from '@/lib/graphId'
import { isDesktop } from '@/lib/isDesktop'
import {
  graphPersistEquals,
  graphContentFingerprint,
  graphContentPayload,
  reviewStateFingerprint,
} from '@/lib/graphPersist'
import { mergeReviewIntoNode } from '@/lib/graphContent'
import { persistReviewStatesFromNodes } from '@/lib/graphMapping'
import {
  beginSuppressWatch,
  createProjectFolder,
  endSuppressWatch,
  getDefaultWorkspacePath,
  grantFsScope,
  loadProjectFromDisk,
  normalizePath,
  persistWorkspaceSync,
  pickWorkspaceFolder,
  removeGraphFromWorkspace,
  resolveWorkspace,
  uniqueGraphNameAmong,
  writeGraphRecordToWorkspace,
} from '@/lib/workspace'
import type { GraphRecord } from '../db'
import {
  dbSaveGraph,
  dbLoadGraph,
  dbListGraphs,
  dbDeleteGraph,
  dbClearGraphs,
  dbDeleteReviewForGraph,
  dbGetReviewStatesForGraph,
} from '../db'
import { _draggingNodeIds } from './graph-editing'
import type { GraphMeta } from '../types'
import type { GraphState } from '../state'
import type { Language } from '@/types/graph'

function detectBrowserLanguage(): Language {
  const lang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en'
  return lang === 'it' ? 'it' : 'en'
}

// Guards the clear+reload window during project switches:
// _switchingProject blocks saveCurrentGraph from writing to the wrong folder;
// _switchProjectInflight serialises concurrent switchProject invocations.
let _switchingProject = false
let _switchProjectInflight: Promise<GraphMeta[]> | null = null
// Set while abandoning a project whose folder was deleted externally — any
// save in that window would silently recreate the folder from the IDB cache.
let _suppressOutgoingSave = false

/** Register `path` as the most-recent known project, then switch to it. */
function registerAndSwitch(
  path: string,
  set: (fn: (s: GraphState) => Partial<GraphState>) => void,
  get: () => GraphState,
): Promise<GraphMeta[]> {
  const norm = normalizePath(path)
  set((s) => ({
    settings: {
      ...s.settings,
      knownProjects: [norm, ...s.settings.knownProjects.filter((p) => normalizePath(p) !== norm)],
    },
  }))
  return get().switchProject(norm)
}

type SaveDirtyFlags = {
  contentFp: string
  reviewFp: string
  contentDirty: boolean
  reviewDirty: boolean
}

function saveDirtyFlags(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  graphDisplay: GraphDisplaySettings,
  savedFingerprint: string,
  savedReviewFingerprint: string,
): SaveDirtyFlags {
  const contentFp = graphContentFingerprint(nodes, edges, graphDisplay)
  const reviewFp = reviewStateFingerprint(nodes)
  return {
    contentFp,
    reviewFp,
    contentDirty: contentFp !== savedFingerprint,
    reviewDirty: reviewFp !== savedReviewFingerprint,
  }
}

async function persistContentGraphRecord(
  currentGraphId: string,
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  graphDisplay: GraphDisplaySettings,
  graphList: GraphMeta[],
  settings: GraphState['settings'],
): Promise<GraphRecord | null> {
  const meta = graphList.find((g) => g.id === currentGraphId)
  const existing = await dbLoadGraph(currentGraphId)
  const contentMatchesIdb =
    existing &&
    graphPersistEquals(
      { nodes, edges, display: graphDisplay },
      {
        nodes: existing.nodes,
        edges: existing.edges,
        display: mergeGraphDisplay(existing.display, settings),
      },
    )
  if (contentMatchesIdb) return null

  const {
    nodes: persistNodes,
    edges: persistEdges,
    display,
  } = graphContentPayload(nodes, edges, graphDisplay)
  const now = Date.now()
  const record: GraphRecord = {
    id: currentGraphId,
    name: meta?.name ?? (settings.language === 'it' ? 'Senza titolo' : 'Untitled'),
    createdAt: existing?.createdAt ?? meta?.updatedAt ?? now,
    updatedAt: now,
    nodes: persistNodes,
    edges: persistEdges,
    display,
  }
  // Disk-first: the folder is the source of truth, so the write there is the
  // commit point. Only on success do we mirror the persisted record (its name
  // may have been de-duplicated on disk) into IDB.
  const persisted = isDesktop() ? await writeGraphRecordToWorkspace(settings, record) : record
  await dbSaveGraph(persisted)
  return persisted
}

function patchAfterSaveCurrentGraph(
  persisted: GraphRecord | null,
  currentGraphId: string,
  stillCurrent: boolean,
  flags: SaveDirtyFlags,
): (s: GraphState) => Partial<GraphState> {
  return (s) => ({
    ...(persisted
      ? {
          graphList: s.graphList.map((g) =>
            g.id === currentGraphId
              ? { ...g, name: persisted.name, updatedAt: persisted.updatedAt }
              : g,
          ),
        }
      : {}),
    ...(stillCurrent
      ? {
          ...(flags.contentDirty
            ? { savedFingerprint: flags.contentFp, externalFileConflict: false }
            : {}),
          ...(flags.reviewDirty ? { savedReviewFingerprint: flags.reviewFp } : {}),
        }
      : {}),
  })
}

export interface GraphManagementSlice {
  currentGraphId: string
  graphList: GraphMeta[]
  loadedToken: number
  loadGraphList: () => Promise<GraphMeta[]>
  createProject: () => Promise<GraphMeta[]>
  openProject: () => Promise<GraphMeta[]>
  switchProject: (path: string) => Promise<GraphMeta[]>
  removeProject: (path: string) => Promise<GraphMeta[]>
  /** Normalized paths of known projects whose folder is currently missing from disk. */
  missingProjects: string[]
  /** Flag a project whose folder vanished as missing (kept in the list); switches away if it was active. */
  markProjectMissing: (path: string) => Promise<GraphMeta[]>
  loadGraph: (id: string) => Promise<void>
  saveCurrentGraph: () => Promise<void>
  createGraph: (name: string) => Promise<string>
  importGraph: (
    name: string,
    nodes: Node<ConceptNodeData>[],
    edges: Edge[],
    display?: Partial<GraphDisplaySettings>,
    id?: string,
  ) => Promise<string>
  renameGraph: (id: string, name: string) => Promise<void>
  deleteGraph: (id: string) => Promise<void>
}

export const createGraphManagementSlice: StateCreator<GraphState, [], [], GraphManagementSlice> = (
  set,
  get,
) => ({
  currentGraphId: SEEDS[0].id,
  graphList: SEEDS.map((s) => ({ id: s.id, name: s.name, updatedAt: Date.now() })),
  loadedToken: 0,
  missingProjects: [],

  loadGraphList: async () => {
    let records = await dbListGraphs()

    if (records.length === 0) {
      // First run: seed the locale demo graphs so the app always has a current
      // graph and a populated sidebar. The tour has the user create their own
      // graph on top — there is no auto-created Tutorial. Seed ids are stable,
      // so React StrictMode's double init overwrites rather than duplicating.
      const lang = detectBrowserLanguage()
      const now = Date.now()
      const seeds = getSeedsForLanguage(lang)
      const seedRecords: GraphRecord[] = []
      for (const seed of seeds) {
        const display = seed.display ?? defaultGraphDisplay(get().settings)
        const payload = graphContentPayload(seed.nodes, seed.edges, display)
        const record: GraphRecord = {
          id: seed.id,
          name: seed.name,
          createdAt: now,
          updatedAt: now,
          nodes: payload.nodes,
          edges: payload.edges,
          display: payload.display,
        }
        await persistReviewStatesFromNodes(seed.id, seed.nodes)
        await dbSaveGraph(record)
        seedRecords.push(record)
      }
      records = seedRecords
      set((s) => ({
        currentGraphId: seeds[0]?.id ?? s.currentGraphId,
        settings: { ...s.settings, language: lang },
      }))
    }

    if (isDesktop()) {
      try {
        // Resolve the active project to a concrete path (the bundled default
        // folder on first launch) and ensure it's registered as a known project.
        let { knownProjects, activeProjectPath } = get().settings
        if (!activeProjectPath) {
          activeProjectPath = await getDefaultWorkspacePath()
        }
        const activeNorm = normalizePath(activeProjectPath)
        if (!knownProjects.some((p) => normalizePath(p) === activeNorm)) {
          knownProjects = [activeProjectPath, ...knownProjects]
        }
        for (const p of knownProjects) await grantFsScope(p)

        // Folders can vanish while the app is closed (deleted, moved, renamed).
        // Keep the entry and flag it missing rather than pruning it — removing a
        // project from the list is only ever an explicit user action. The bundled
        // default is exempt (auto-created); exists() failures are treated as present.
        const defaultNorm = normalizePath(await getDefaultWorkspacePath())
        const { exists } = await import('@tauri-apps/plugin-fs')
        const missing: string[] = []
        for (const p of knownProjects) {
          const norm = normalizePath(p)
          if (norm === defaultNorm) continue
          if (!(await exists(p).catch(() => true))) missing.push(norm)
        }
        set((s) => ({
          settings: { ...s.settings, knownProjects, activeProjectPath },
          missingProjects: missing,
        }))

        if (activeNorm !== defaultNorm && missing.includes(activeNorm)) {
          // The active project's folder vanished while the app was closed — move
          // to a present project, keeping the missing one flagged in the list.
          return await get().markProjectMissing(activeProjectPath)
        }

        records = await persistWorkspaceSync(get().settings, records)
      } catch (err) {
        console.error('[nesso] workspace sync failed:', err)
      }
    }

    const list = records.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
    set({ graphList: list })
    return list
  },

  createProject: async () => {
    if (!isDesktop()) return get().graphList
    const created = await createProjectFolder()
    if (!created) return get().graphList
    return registerAndSwitch(created, set, get)
  },

  openProject: async () => {
    if (!isDesktop()) return get().graphList
    const picked = await pickWorkspaceFolder()
    if (!picked) return get().graphList
    return registerAndSwitch(picked, set, get)
  },

  switchProject: async (path) => {
    if (!isDesktop()) return get().graphList

    // Serialise concurrent calls — wait for any ongoing switch to finish first.
    // _switchProjectInflight is assigned synchronously below (no await between the
    // while-exit and the assignment), so no two callers can both pass the guard.
    while (_switchProjectInflight) {
      await _switchProjectInflight.catch(() => {})
    }

    const norm = normalizePath(path)
    const current = get().settings.activeProjectPath
    if (current && normalizePath(current) === norm) return get().graphList

    const run = async (): Promise<GraphMeta[]> => {
      // Save onto the OUTGOING project before _switchingProject = true so the
      // guard inside saveCurrentGraph doesn't block it.
      await get().saveCurrentGraph()
      _switchingProject = true
      try {
        await grantFsScope(norm)

        // Clicking a project whose folder vanished externally: keep it in the
        // list but flag it missing rather than loading or pruning it (the default
        // workspace is exempt — it gets created on demand). If the folder is
        // present, clear any stale missing flag — it may have returned (e.g. the
        // user renamed it back).
        if (norm !== normalizePath(await getDefaultWorkspacePath())) {
          const { exists } = await import('@tauri-apps/plugin-fs')
          if (!(await exists(norm).catch(() => true))) {
            set((s) => ({
              missingProjects: s.missingProjects.includes(norm)
                ? s.missingProjects
                : [...s.missingProjects, norm],
            }))
            get().pushToast({
              id: `project-missing:${norm}`,
              variant: 'info',
              message:
                get().settings.language === 'it'
                  ? 'Cartella del progetto non trovata: potrebbe essere stata spostata o rinominata. Resta nella lista finché non la rimuovi.'
                  : 'Project folder not found: it may have been moved or renamed. It stays in the list until you remove it.',
            })
            return get().graphList
          }
          if (get().missingProjects.includes(norm)) {
            set((s) => ({ missingProjects: s.missingProjects.filter((p) => p !== norm) }))
          }
        }

        // Resolve the target workspace before touching IDB so we can roll back on failure.
        const ws = await resolveWorkspace({ activeProjectPath: norm })
        const prevPath = get().settings.activeProjectPath

        let records: GraphRecord[]
        beginSuppressWatch()
        try {
          await dbClearGraphs()
          records = await loadProjectFromDisk(ws)
        } catch (err) {
          // Load failed — IDB is now empty. Best-effort: reload from the outgoing
          // project so the app stays in a usable state. activeProjectPath is NOT
          // updated, so the file watcher and next save still target the old folder.
          console.error('[nesso] project load failed, rolling back to previous workspace', err)
          const prevWs = await resolveWorkspace({ activeProjectPath: prevPath }).catch(() => null)
          if (prevWs) await loadProjectFromDisk(prevWs).catch(() => {})
          throw err
        } finally {
          endSuppressWatch()
        }

        // Commit the path change only after the load succeeded.
        set((s) => ({ settings: { ...s.settings, activeProjectPath: norm } }))

        if (records.length === 0) {
          const now = Date.now()
          const untitled = get().settings.language === 'it' ? 'Senza titolo' : 'Untitled'
          const seed: GraphRecord = {
            id: newGraphId(),
            name: untitled,
            createdAt: now,
            updatedAt: now,
            nodes: [],
            edges: [],
            display: defaultGraphDisplay(get().settings),
          }
          // settings now has activeProjectPath = norm (committed above)
          const persisted = await writeGraphRecordToWorkspace(get().settings, seed)
          await dbSaveGraph(persisted)
          records = [persisted]
        }

        const list = records.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
        set({ graphList: list })

        const next = [...records].sort((a, b) => b.updatedAt - a.updatedAt)[0]
        await get().loadGraph(next.id)
        return list
      } finally {
        _switchingProject = false
      }
    }

    _switchProjectInflight = run()
    try {
      return await _switchProjectInflight
    } finally {
      _switchProjectInflight = null
    }
  },

  removeProject: async (path) => {
    if (!isDesktop()) return get().graphList
    const norm = normalizePath(path)

    const { knownProjects, activeProjectPath } = get().settings
    const remaining = knownProjects.filter((p) => normalizePath(p) !== norm)
    if (remaining.length === knownProjects.length) return get().graphList // path not in list
    if (remaining.length === 0) return get().graphList // can't remove the last project

    if (activeProjectPath && normalizePath(activeProjectPath) === norm) {
      // Switch first — if it throws, the list stays intact. Prefer a present
      // project so we don't load into another missing folder.
      const missing = new Set(get().missingProjects)
      const target = remaining.find((p) => !missing.has(normalizePath(p))) ?? remaining[0]
      await get().switchProject(target)
    }
    set((s) => ({
      settings: { ...s.settings, knownProjects: remaining },
      missingProjects: s.missingProjects.filter((p) => p !== norm),
    }))
    return get().graphList
  },

  markProjectMissing: async (path) => {
    if (!isDesktop()) return get().graphList
    const norm = normalizePath(path)
    // The bundled default workspace is auto-recreated, never flagged.
    if (norm === normalizePath(await getDefaultWorkspacePath())) return get().graphList

    // Flag it as missing (idempotent) while keeping it in the list — removing a
    // project is only ever an explicit user action.
    set((s) => ({
      missingProjects: s.missingProjects.includes(norm)
        ? s.missingProjects
        : [...s.missingProjects, norm],
    }))

    const { knownProjects, activeProjectPath } = get().settings
    if (!activeProjectPath || normalizePath(activeProjectPath) !== norm) return get().graphList

    // The active project's folder is gone: switch to a present project (or the
    // bundled default) through the regular machinery — clears the stale IDB
    // cache and seeds an empty project if needed — while suppressing saves,
    // which would otherwise recreate the abandoned folder. The missing entry
    // stays in the list, flagged.
    _suppressOutgoingSave = true
    try {
      const missing = new Set(get().missingProjects)
      const target =
        knownProjects.find((p) => normalizePath(p) !== norm && !missing.has(normalizePath(p))) ??
        (await getDefaultWorkspacePath())
      return await registerAndSwitch(target, set, get)
    } finally {
      _suppressOutgoingSave = false
    }
  },

  loadGraph: async (id) => {
    const s = get()
    // Flush the outgoing graph's debounced autosave so edits made within the
    // debounce window of a switch aren't lost. Skipped when: nothing loaded yet
    // (startup — would persist the empty initial state), same-graph reload (the
    // watcher path intentionally replaces stale memory), a conflict is pending,
    // or the outgoing graph was just deleted from the list.
    if (
      s.loadedToken > 0 &&
      id !== s.currentGraphId &&
      !s.externalFileConflict &&
      s.graphList.some((g) => g.id === s.currentGraphId) &&
      (graphContentFingerprint(s.nodes, s.edges, s.graphDisplay) !== s.savedFingerprint ||
        reviewStateFingerprint(s.nodes) !== s.savedReviewFingerprint)
    ) {
      await s.saveCurrentGraph()
    }
    const record = await dbLoadGraph(id)
    if (!record) return
    _draggingNodeIds.clear()
    const reviews = await dbGetReviewStatesForGraph(id)
    const nodes = record!.nodes.map((n) => mergeReviewIntoNode(n, reviews.get(n.id)))
    const graphDisplay = mergeGraphDisplay(record!.display, get().settings)
    const fp = graphContentFingerprint(nodes, record!.edges, graphDisplay)
    set((s) => ({
      currentGraphId: record!.id,
      nodes,
      edges: record!.edges,
      graphDisplay,
      selected: null,
      loadedToken: s.loadedToken + 1,
      savedFingerprint: fp,
      savedReviewFingerprint: reviewStateFingerprint(nodes),
      externalFileConflict: false,
      _history: [],
      _future: [],
    }))
  },

  saveCurrentGraph: async () => {
    if (get().externalFileConflict || _switchingProject || _suppressOutgoingSave) return
    const { currentGraphId, nodes, edges, graphList, graphDisplay, settings, loadedToken } = get()
    const flags = saveDirtyFlags(
      nodes,
      edges,
      graphDisplay,
      get().savedFingerprint,
      get().savedReviewFingerprint,
    )
    // Nothing persistable changed since the last save/load.
    if (!flags.contentDirty && !flags.reviewDirty) return

    // Personal review (FSRS) state is its own sink: persist it to the review
    // store without rewriting the shared content file, so a review-only change
    // never churns disk (and stays private when a folder is shared).
    if (flags.reviewDirty) await persistReviewStatesFromNodes(currentGraphId, nodes)

    const persisted = flags.contentDirty
      ? await persistContentGraphRecord(
          currentGraphId,
          nodes,
          edges,
          graphDisplay,
          graphList,
          settings,
        )
      : null

    // The current graph may have changed while awaiting the disk/IDB writes —
    // the graphList bump for the saved graph is still valid, but the
    // per-current-graph fingerprints must not leak onto the newly loaded graph.
    const stillCurrent =
      get().currentGraphId === currentGraphId && get().loadedToken === loadedToken
    set(patchAfterSaveCurrentGraph(persisted, currentGraphId, stillCurrent, flags))
  },

  createGraph: async (name) => {
    const id = newGraphId()
    const now = Date.now()
    const display = defaultGraphDisplay(get().settings)
    const record: GraphRecord = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      nodes: [],
      edges: [],
      display,
    }
    const persisted = isDesktop()
      ? await writeGraphRecordToWorkspace(get().settings, record)
      : record
    await dbSaveGraph(persisted)
    _draggingNodeIds.clear()
    set((s) => ({
      graphList: [
        ...s.graphList,
        { id: persisted.id, name: persisted.name, updatedAt: persisted.updatedAt },
      ],
      currentGraphId: persisted.id,
      nodes: [],
      edges: [],
      graphDisplay: display,
      selected: null,
      savedFingerprint: graphContentFingerprint([], [], display),
      _history: [],
      _future: [],
    }))
    return persisted.id
  },

  importGraph: async (name, nodes, edges, display, id) => {
    const trimmed = id?.trim()
    const graphId = trimmed && isGraphId(trimmed) ? trimmed : newGraphId()
    const now = Date.now()
    const graphDisplay = mergeGraphDisplay(display, get().settings)
    const existing = await dbListGraphs()
    const peerNames = existing.filter((r) => r.id !== graphId).map((r) => r.name)
    const graphName = uniqueGraphNameAmong(name.trim() || 'Untitled', peerNames)
    const {
      nodes: persistNodes,
      edges: persistEdges,
      display: persistDisplay,
    } = graphContentPayload(nodes, edges, graphDisplay)
    const record: GraphRecord = {
      id: graphId,
      name: graphName,
      createdAt: now,
      updatedAt: now,
      nodes: persistNodes,
      edges: persistEdges,
      display: persistDisplay,
    }
    await persistReviewStatesFromNodes(graphId, nodes)
    const persisted = isDesktop()
      ? await writeGraphRecordToWorkspace(get().settings, record)
      : record
    await dbSaveGraph(persisted)
    _draggingNodeIds.clear()
    set((s) => {
      const meta = { id: graphId, name: persisted.name, updatedAt: persisted.updatedAt }
      const graphList = s.graphList.some((g) => g.id === graphId)
        ? s.graphList.map((g) => (g.id === graphId ? meta : g))
        : [...s.graphList, meta]
      return {
        graphList,
        currentGraphId: graphId,
        nodes,
        edges,
        graphDisplay,
        selected: null,
        savedFingerprint: graphContentFingerprint(nodes, edges, graphDisplay),
        _history: [],
        _future: [],
      }
    })
    return graphId
  },

  renameGraph: async (id, name) => {
    const record = await dbLoadGraph(id)
    if (!record) return
    const updated = { ...record, name }
    const persisted = isDesktop()
      ? await writeGraphRecordToWorkspace(get().settings, updated)
      : updated
    await dbSaveGraph(persisted)
    set((s) => ({
      graphList: s.graphList.map((g) => (g.id === id ? { ...g, name: persisted.name } : g)),
    }))
  },

  deleteGraph: async (id) => {
    await dbDeleteGraph(id)
    await dbDeleteReviewForGraph(id)
    if (isDesktop()) {
      await removeGraphFromWorkspace(get().settings, id)
    }
    const { graphList, currentGraphId, loadGraph } = get()
    const next = graphList.find((g) => g.id !== id)
    set((s) => {
      // Drop the saved viewport too — it's persisted and never cleaned otherwise.
      const { [id]: _removed, ...viewports } = s.viewports
      return { graphList: s.graphList.filter((g) => g.id !== id), viewports }
    })
    if (currentGraphId === id && next) await loadGraph(next.id)
  },
})
