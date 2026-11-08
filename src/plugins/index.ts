import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { host, nessoStore, registerTheme, registerVocab, useNessoStore } from '@/store'
import type { VocabDefinition } from '@nesso-how/core'
import type { ThemeDefinition } from '@nesso-how/plugin'
import {
  parseContribution,
  parsePluginI18n,
  parsePluginManifest,
  PluginError,
  resolvePluginText,
} from '@nesso-how/plugin/runtime'
import { defaultLocale, type Locale } from '@nesso-how/i18n'
import kernelPackage from '../../plugins/kernel-theme/package.json'
import paperPackage from '../../plugins/paper-theme/package.json'
import mistPackage from '../../plugins/mist-theme/package.json'
import baseVocabPackage from '../../plugins/base-vocab/package.json'
import exportPackage from '../../plugins/export/package.json'
import importPackage from '../../plugins/import/package.json'
import reviewPackage from '../../plugins/review/package.json'
import notesPackage from '../../plugins/notes/package.json'
import { notifications } from '../notifications/index.ts'
import { prepareTheme, type ThemePresentation } from '../theme/prepare.ts'
import {
  createPluginRegistry,
  isLocalPlugin,
  pluginMenuActions,
  type PluginEntry,
} from './registry.ts'
import { loadActions, type ActionPackage } from './actions.ts'
import { withInitializationTimeout } from './initialization.ts'
import { translate } from '../i18n/index.ts'
import {
  parsePackageIdentity,
  verifyPluginPackage,
  type PluginPackageInput,
} from '@nesso-how/plugin/package'
import { NessoError } from '@nesso-how/errors'
import type { InstalledPlugin, PluginResult } from '../../shared/plugins.ts'
import { createPluginPanel } from './panel.ts'
import { createActionBadges } from './badges.ts'
import { executeActionBadge } from './badge-execution.ts'
import { createPluginEntry } from './entry.ts'
import { canvasTabs } from './canvas-tabs.ts'

export const pluginPanel = createPluginPanel(nessoStore, notifications.api, window.nessoFiles)
export const usePluginPanel = () =>
  useSyncExternalStore(pluginPanel.subscribe, pluginPanel.getSnapshot)

const themes = new Map<string, ThemePresentation>()
const actions = new Map<string, ActionPackage>()
const active = new Map<AbortController, string>()
const actionListeners = new Set<() => void>()
const subscribeActions = (listener: () => void) => {
  actionListeners.add(listener)
  return () => {
    actionListeners.delete(listener)
  }
}
const publishActions = () => {
  for (const listener of actionListeners) listener()
}
const installations = new Map<string, AbortController>()
const changing = new Set<string>()
const localErrors = new Map<string, string>()
const reportedIssues = (error: unknown) =>
  error instanceof NessoError
    ? error.issues
        .slice(0, 16)
        .map(({ path, message }) => ({ path: path.slice(0, 256), message: message.slice(0, 1024) }))
    : undefined
const recordLocalError = (
  entry: Pick<PluginEntry, 'id' | 'contentId' | 'npmIntegrity'>,
  error: unknown,
) => {
  if (isLocalPlugin(entry))
    localErrors.set(
      entry.id,
      error instanceof Error ? error.message.slice(0, 2048) : 'Plugin failed',
    )
}
const registry = createPluginRegistry()
registry.subscribe(() => {
  const order = nessoStore.getState().preferences.canvasTabOrder ?? []
  const ids = canvasTabs(registry.getSnapshot()).map(({ key }) => key)
  if (!ids.some((id) => !order.includes(id))) return
  try {
    nessoStore.applyOperations([{ kind: 'preferences.canvasTabOrder.append', ids }])
  } catch {}
})
const bundledActions = [
  { source: exportPackage, id: 'export' },
  { source: importPackage, id: 'import' },
  { source: reviewPackage, id: 'review' },
  { source: notesPackage, id: 'notes' },
]
const actionBadges = createActionBadges(nessoStore, registry, (plugin, actionId, input, signal) => {
  const source = actions.get(plugin.id)
  if (!source || changing.has(plugin.id))
    return Promise.reject(
      new PluginError('unavailable', [{ path: 'badge', message: 'Plugin unavailable' }]),
    )
  return executeActionBadge(source, plugin.contribution, actionId, input, signal)
})
const refreshBadges = () => actionBadges.setForeground(document.visibilityState === 'visible')
document.addEventListener('visibilitychange', refreshBadges)
window.addEventListener('focus', refreshBadges)
window.addEventListener('pageshow', refreshBadges)
refreshBadges()
import.meta.hot?.dispose(() => {
  document.removeEventListener('visibilitychange', refreshBadges)
  window.removeEventListener('focus', refreshBadges)
  window.removeEventListener('pageshow', refreshBadges)
  actionBadges.dispose()
})
export const useViewActionBadge = (actionId: string, viewId: string | null, visible: boolean) =>
  useSyncExternalStore(
    useCallback(
      (listener: () => void) =>
        visible ? actionBadges.watch(actionId, viewId, listener) : () => {},
      [actionId, viewId, visible],
    ),
    () => (visible ? actionBadges.getValue(actionId, viewId) : null),
  )
const getTranslation = () => translate(nessoStore.getState().preferences.locale ?? defaultLocale)
export const getThemePresentation = (id: string) => themes.get(id)
export const usePlugins = () => useSyncExternalStore(registry.subscribe, registry.getSnapshot)
export const useExternalPluginsAvailable = () =>
  useSyncExternalStore(registry.subscribe, registry.getExternalAvailable)
export const usePluginActionsRunning = (name: string) =>
  useSyncExternalStore(subscribeActions, () =>
    [...active].some(([controller, source]) => source === name && !controller.signal.aborted),
  )
export const useViewActions = () => usePlugins().flatMap(pluginMenuActions)
export const useCanvasTabs = () => {
  const plugins = usePlugins()
  const order = useNessoStore((state) => state.preferences.canvasTabOrder)
  return useMemo(() => canvasTabs(plugins, order), [plugins, order])
}
export const openCanvasTab = (actionId: string | null) => {
  if (actionId === null) pluginPanel.close()
  else if (pluginPanel.getSnapshot()?.actionId !== actionId) void invokeAction(actionId)
}
export const openCanvasTabAt = (index: number) => {
  if (index === 0) return openCanvasTab(null)
  const tab = canvasTabs(registry.getSnapshot(), nessoStore.getState().preferences.canvasTabOrder)[
    index - 1
  ]
  if (tab) openCanvasTab(tab.id)
}
export const pluginMetadata = (plugin: Pick<PluginEntry, 'i18n'>, locale: Locale) => ({
  name: resolvePluginText(plugin.i18n.metadata.name, locale),
  description: resolvePluginText(plugin.i18n.metadata.description, locale),
  documentation: resolvePluginText(plugin.i18n.metadata.documentation, locale),
})
export const stopPluginActions = () => {
  pluginPanel.invalidate()
  actionBadges.setForeground(false)
  for (const controller of active.keys()) controller.abort()
  for (const [id, controller] of installations) {
    controller.abort()
    window.nessoPlugins?.cancel(id)
  }
}
export const stopActionsForPlugin = (name: string) => {
  pluginPanel.invalidate(name)
  actionBadges.invalidatePlugin(name)
  let stopped = 0
  for (const [controller, source] of active)
    if (source === name && !controller.signal.aborted) {
      controller.abort()
      stopped++
    }
  return stopped
}
const result = <T>(reply: PluginResult<T>): T => {
  if ('issues' in reply) throw new PluginError('failed', [...reply.issues])
  return reply.value
}
const parseDefinitionCode = (kind: 'theme' | 'vocab', code: string, path: string) => {
  let raw: unknown
  try {
    raw = JSON.parse(code)
  } catch {
    throw new PluginError('invalid-input', [{ path, message: 'Expected a JSON definition' }])
  }
  return parseContribution(kind, raw)
}
const externalEntry = (prepared: InstalledPlugin, error?: string): PluginEntry => {
  const entry = {
    id: prepared.name,
    version: prepared.version,
    author: prepared.author,
    repository: prepared.repository,
    i18n: prepared.i18n,
    access: { writes: prepared.nesso.writes, capabilities: prepared.nesso.capabilities },
    contentId: prepared.contentId,
    npmIntegrity: prepared.npmIntegrity,
    disabled: !prepared.enabled,
    ...(error ? { error } : {}),
  }
  return prepared.nesso.kind === 'actions'
    ? { ...entry, kind: 'actions', contribution: [] }
    : { ...entry, kind: prepared.nesso.kind }
}
type DiscoveredPlugin = {
  entry: PluginEntry
  source?: ActionPackage
  presentation?: ThemePresentation
}
const discoverExternal = async (
  prepared: InstalledPlugin,
  signal: AbortSignal,
  restoring: readonly PluginEntry[] = [],
  replacing?: string,
): Promise<DiscoveredPlugin> => {
  const verified = await verifyPluginPackage(prepared)
  signal.throwIfAborted()
  const bytes = new TextEncoder().encode(verified.code)
  let discovered: DiscoveredPlugin
  if (verified.nesso.kind === 'actions') {
    const source: ActionPackage = {
      name: verified.name,
      local: isLocalPlugin(prepared),
      entry: createPluginEntry(bytes),
      manifest: verified.nesso,
      i18n: verified.i18n,
    }
    const contribution = await loadActions(
      nessoStore,
      source,
      notifications.api,
      undefined,
      undefined,
      signal,
    )
    discovered = { source, entry: { ...externalEntry(prepared), kind: 'actions', contribution } }
  } else {
    const contribution = parseDefinitionCode(
      verified.nesso.kind,
      verified.code,
      verified.nesso.entry,
    )
    if ('relationTypes' in contribution)
      discovered = { entry: { ...externalEntry(prepared), kind: 'vocab', contribution } }
    else {
      const presentation = prepareTheme(contribution)
      discovered = {
        entry: { ...externalEntry(prepared), kind: 'theme', contribution },
        presentation,
      }
    }
  }
  signal.throwIfAborted()
  registry.check([
    ...registry.getSnapshot().filter((entry) => !replacing || entry.contentId !== replacing),
    ...restoring,
    discovered.entry,
  ])
  return prepared.enabled ? discovered : { entry: externalEntry(prepared) }
}
const publish = (
  next: readonly PluginEntry[],
  staged: readonly DiscoveredPlugin[] = [],
  restoring = false,
) => {
  registry.check(next)
  for (const { entry, source, presentation } of staged) {
    if (source) actions.set(entry.id, source)
    if (presentation && entry.kind === 'theme' && entry.contribution)
      themes.set(entry.contribution.id, presentation)
  }
  const definitions = next.filter((entry) => entry.kind !== 'actions')
  const previous = registry.getSnapshot().filter((entry) => entry.kind !== 'actions')
  if (
    restoring ||
    definitions.length !== previous.length ||
    definitions.some((entry, index) => entry !== previous[index])
  ) {
    host.replacePluginDefinitions(
      definitions.flatMap<ThemeDefinition | VocabDefinition>((entry) =>
        entry.contribution ? [entry.contribution] : [],
      ),
      restoring,
    )
  }
  for (const name of actions.keys())
    if (
      !next.some(
        (entry) => entry.id === name && entry.kind === 'actions' && !entry.disabled && !entry.error,
      )
    )
      actions.delete(name)
  for (const id of themes.keys())
    if (!next.some((entry) => entry.kind === 'theme' && entry.contribution?.id === id))
      themes.delete(id)
  registry.replace(next)
}

export async function initializeExternalPlugins(signal: AbortSignal) {
  const bridge = window.nessoPlugins
  if (!bridge || signal.aborted) return () => {}
  const t = getTranslation()
  try {
    const stored = result(await withInitializationTimeout(() => bridge.list(), signal))
    if (stored.safeMode) return () => {}
    const entries: PluginEntry[] = []
    const staged: DiscoveredPlugin[] = []
    for (const prepared of stored.packages) {
      if (signal.aborted) return () => {}
      if (!prepared.enabled) {
        entries.push(externalEntry(prepared))
        continue
      }
      try {
        const discovered = await withInitializationTimeout(
          (loading) => discoverExternal(prepared, loading, entries),
          signal,
        )
        entries.push(discovered.entry)
        staged.push(discovered)
      } catch (error) {
        const entry = externalEntry(prepared, t('pluginUnavailable'))
        recordLocalError(entry, error)
        entries.push(entry)
      }
    }
    if (signal.aborted) return () => {}
    publish([...registry.getSnapshot(), ...entries], staged, true)
    const failed = entries
      .filter((entry) => entry.error)
      .map(
        (entry) =>
          pluginMetadata(entry, nessoStore.getState().preferences.locale ?? defaultLocale).name,
      )
    if (failed.length || stored.issues.length)
      notifications.api.notify({
        tone: 'warning',
        title: t('pluginExternalFailed'),
        description: `${t('pluginExternalFailedDescription')}${
          failed.length ? `\n\n${failed.join(', ')}` : ''
        }${stored.issues.length ? `\n\n${t('pluginExternalFailedStaleHint')}` : ''}`,
      })
  } catch {
    notifications.api.notify({
      tone: 'warning',
      title: t('pluginExternalFailed'),
      description: t('pluginExternalFailedDescription'),
    })
  }
  if (signal.aborted) return () => {}
  const stop = bridge.subscribe((event) => {
    if (event.type === 'cancel') {
      installations.get(event.id)?.abort()
      return
    }
    if (event.type === 'approval') return
    const controller = new AbortController()
    installations.set(event.id, controller)
    void (async () => {
      let locked = false
      try {
        if (signal.aborted)
          throw new PluginError('cancelled', [{ path: 'plugins', message: t('pluginUnavailable') }])
        if (
          event.replacing &&
          !registry
            .getSnapshot()
            .some((entry) => entry.id === event.package.name && entry.contentId === event.replacing)
        )
          throw new PluginError('stale-state', [
            { path: 'plugins', message: 'Installed package changed' },
          ])
        const discovered = await discoverExternal(
          event.package,
          controller.signal,
          [],
          event.replacing,
        )
        const { entry } = discovered
        if (controller.signal.aborted || signal.aborted || changing.size)
          throw new PluginError('cancelled', [
            { path: 'plugins', message: 'Installation cancelled' },
          ])
        changing.add(entry.id)
        locked = true
        stopActionsForPlugin(entry.id)
        result(await bridge.settle(event.id, event.package.contentId, true))
        localErrors.delete(entry.id)
        publish(
          [...registry.getSnapshot().filter((previous) => previous.id !== entry.id), entry],
          [discovered],
        )
      } catch (error) {
        await bridge
          .settle(event.id, event.package.contentId, false, reportedIssues(error))
          .catch(() => {})
      } finally {
        if (locked) changing.delete(event.package.name)
        controller.abort()
        installations.delete(event.id)
      }
    })()
  }, true)
  registry.setExternalAvailable(true)
  return () => {
    registry.setExternalAvailable(false)
    stop()
  }
}

export async function setPluginEnabled(target: PluginEntry, enabled: boolean) {
  const entry = registry
    .getSnapshot()
    .find((plugin) => plugin.id === target.id && plugin.contentId === target.contentId)
  const bridge = window.nessoPlugins
  const bundled = bundledActions.find(({ source }) => source.name === target.id)
  if (!entry || changing.size || (entry.contentId ? !bridge : !bundled)) return
  changing.add(entry.id)
  stopActionsForPlugin(entry.id)
  const controller = new AbortController()
  try {
    let discovered: DiscoveredPlugin
    if (entry.contentId && bridge) {
      const prepared = result(await bridge.list()).packages.find(
        (record) => record.contentId === entry.contentId,
      )
      if (!prepared)
        throw new PluginError('stale-state', [
          { path: 'plugins', message: 'Installed package changed' },
        ])
      const loaded = enabled
        ? await discoverExternal({ ...prepared, enabled }, controller.signal, [], entry.contentId)
        : undefined
      const record = result(await bridge.setEnabled(entry.contentId, enabled))
      discovered = loaded ?? { entry: externalEntry(record) }
    } else {
      discovered = await discoverBundledActions(bundled!, enabled)
      registry.check(
        registry
          .getSnapshot()
          .map((previous) => (previous.id === entry.id ? discovered.entry : previous)),
      )
      const disabled = nessoStore.getState().preferences.disabledBundledActionPlugins ?? []
      nessoStore.applyOperations([
        {
          kind: 'preferences.disabledBundledActionPlugins',
          value: [...disabled.filter((id) => id !== entry.id), ...(enabled ? [] : [entry.id])],
        },
      ])
    }
    publish(
      registry
        .getSnapshot()
        .map((previous) => (previous.id === entry.id ? discovered.entry : previous)),
      [discovered],
    )
    return true
  } catch {
    const t = getTranslation()
    notifications.api.notify({
      tone: 'warning',
      title: t(enabled ? 'pluginEnableFailed' : 'pluginDisableFailed'),
      description: t(enabled ? 'pluginEnableFailedDescription' : 'pluginDisableFailedDescription', {
        name: pluginMetadata(entry, nessoStore.getState().preferences.locale ?? defaultLocale).name,
      }),
    })
    return false
  } finally {
    controller.abort()
    changing.delete(entry.id)
  }
}

export async function removeExternalPlugin(contentId: string) {
  const entry = registry.getSnapshot().find((plugin) => plugin.contentId === contentId)
  if (!entry || !window.nessoPlugins || changing.size) return
  changing.add(entry.id)
  stopActionsForPlugin(entry.id)
  try {
    result(await window.nessoPlugins.remove(contentId))
    localErrors.delete(entry.id)
    publish(registry.getSnapshot().filter((plugin) => plugin.contentId !== contentId))
    return true
  } catch {
    const t = getTranslation()
    notifications.api.notify({
      tone: 'warning',
      title: t('pluginRemoveFailed'),
      description: t('pluginRemoveFailedDescription', {
        name: pluginMetadata(entry, nessoStore.getState().preferences.locale ?? defaultLocale).name,
      }),
    })
    return false
  } finally {
    changing.delete(entry.id)
  }
}

export const describePlugins = () =>
  registry.getSnapshot().map((entry) => {
    const local = isLocalPlugin(entry)
    const lastError = local ? localErrors.get(entry.id) : undefined
    return {
      name: entry.id,
      version: entry.version,
      kind: entry.kind,
      local,
      enabled: !entry.disabled,
      loaded: !entry.disabled && !entry.error,
      ...(entry.contentId ? { contentId: entry.contentId } : {}),
      ...(lastError ? { lastError } : {}),
    }
  })

export async function proposeLocalPlugin(
  input: PluginPackageInput,
  replacing: string | undefined,
  signal: AbortSignal,
) {
  const bridge = window.nessoPlugins
  if (!bridge || !registry.getExternalAvailable())
    throw new PluginError('unavailable', [
      { path: 'plugins', message: 'Plugin installation is unavailable in this session' },
    ])
  if (
    replacing &&
    !registry.getSnapshot().some((entry) => entry.contentId === replacing && isLocalPlugin(entry))
  )
    throw new PluginError('denied', [
      { path: 'replacing', message: 'Only an installed local plugin can be replaced' },
    ])
  signal.throwIfAborted()
  const id = crypto.randomUUID()
  const cancel = () => bridge.cancel(id)
  signal.addEventListener('abort', cancel, { once: true })
  try {
    return result(
      await bridge.propose(
        id,
        input,
        nessoStore.getState().preferences.locale ?? defaultLocale,
        replacing,
      ),
    )
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}

async function discoverBundledActions(
  { source, id }: (typeof bundledActions)[number],
  enabled: boolean,
): Promise<DiscoveredPlugin> {
  const manifest = parsePluginManifest(source.nesso)
  if (manifest.kind !== 'actions')
    throw new PluginError('invalid-input', [
      { path: 'manifest.kind', message: 'Expected an action package' },
    ])
  const i18n = parsePluginI18n(source.i18n)
  const packageEntry: ActionPackage = {
    name: source.name,
    local: false,
    entry: createPluginEntry(`preinstalled/${id}/index.js`),
    manifest,
    i18n,
  }
  const contribution = enabled ? await loadActions(nessoStore, packageEntry, notifications.api) : []
  const { author, repository } = parsePackageIdentity(source)
  return {
    entry: {
      id: source.name,
      version: source.version,
      author,
      repository,
      kind: 'actions',
      i18n,
      access: { writes: manifest.writes, capabilities: manifest.capabilities },
      disabled: !enabled,
      contribution,
    },
    source: enabled ? packageEntry : undefined,
  }
}

export async function initializeBundledPlugins() {
  const entries = await Promise.all(
    [
      { package: kernelPackage, id: 'kernel-theme' },
      { package: paperPackage, id: 'paper-theme' },
      { package: mistPackage, id: 'mist-theme' },
      { package: baseVocabPackage, id: 'base-vocab' },
    ].map(async ({ package: source, id }): Promise<PluginEntry> => {
      const manifest = parsePluginManifest(source.nesso)
      if (manifest.kind !== 'theme' && manifest.kind !== 'vocab')
        throw new PluginError('invalid-input', [
          { path: 'manifest.kind', message: 'Expected a definition package' },
        ])
      const response = await fetch(new URL(`preinstalled/${id}/definition.json`, document.baseURI))
      if (!response.ok)
        throw new PluginError('failed', [
          { path: 'definition', message: 'Could not load bundled definition' },
        ])
      const contribution = parseDefinitionCode(
        manifest.kind,
        await response.text(),
        `preinstalled/${id}/definition.json`,
      )
      if (contribution.id !== id)
        throw new PluginError('denied', [
          { path: 'contribution.id', message: 'Unexpected definition identity' },
        ])
      const { author, repository } = parsePackageIdentity(source)
      const entry = {
        id: source.name,
        version: source.version,
        author,
        repository,
        i18n: parsePluginI18n(source.i18n),
      }
      if ('relationTypes' in contribution) return { ...entry, kind: 'vocab', contribution }
      themes.set(contribution.id, prepareTheme(contribution))
      return { ...entry, kind: 'theme', contribution }
    }),
  )
  for (const entry of entries) {
    if (entry.kind === 'theme' && entry.contribution) registerTheme(entry.contribution)
    if (entry.kind === 'vocab' && entry.contribution) registerVocab(entry.contribution)
  }
  const disabled = nessoStore.getState().preferences.disabledBundledActionPlugins ?? []
  const commands = await Promise.all(
    bundledActions.map((bundled) =>
      discoverBundledActions(bundled, !disabled.includes(bundled.source.name)),
    ),
  )
  for (const { entry, source } of commands) if (source) actions.set(entry.id, source)
  registry.replace([...entries, ...commands.map(({ entry }) => entry)])
}

export const preloadPluginPanels = () => pluginPanel.preload([...actions.values()])

export async function invokeAction(
  actionId: string,
  viewId = nessoStore.getState().workspace.activeViewId,
) {
  const plugin = registry
    .getSnapshot()
    .find(
      (entry) => entry.kind === 'actions' && entry.contribution.some(({ id }) => id === actionId),
    )
  const source = plugin && actions.get(plugin.id)
  if (!source || plugin?.kind !== 'actions' || changing.has(plugin.id)) return
  const controller = new AbortController()
  active.set(controller, source.name)
  publishActions()
  try {
    const invocation = { actionId, viewId, descriptors: plugin.contribution }
    if (plugin.contribution.find(({ id }) => id === actionId)?.ui)
      await pluginPanel.open(source, invocation, controller.signal)
    else
      await loadActions(
        nessoStore,
        source,
        notifications.api,
        window.nessoFiles,
        invocation,
        controller.signal,
      )
  } catch (error) {
    if (error instanceof PluginError && error.code === 'cancelled') return
    recordLocalError(plugin, error)
    const t = getTranslation()
    const locale = nessoStore.getState().preferences.locale ?? defaultLocale
    notifications.api.notify({
      tone: 'warning',
      title: t('pluginActionFailed'),
      description:
        error instanceof PluginError && error.code === 'stale-state'
          ? t('pluginActionConflictDescription', { name: pluginMetadata(plugin, locale).name })
          : [
              t('pluginActionFailedDescription', { name: pluginMetadata(plugin, locale).name }),
              error instanceof PluginError
                ? error.displayMessage
                  ? resolvePluginText(error.displayMessage, locale)
                  : error.message
                : undefined,
            ]
              .filter(Boolean)
              .join('\n\n'),
    })
  } finally {
    active.delete(controller)
    publishActions()
  }
}
