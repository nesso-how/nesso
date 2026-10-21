import { useSyncExternalStore } from 'react'
import { host, nessoStore, registerTheme, registerVocab } from '@/store'
import type { ThemeDefinition, VocabDefinition } from '@nesso/plugin'
import { parseContribution, parsePluginI18n, parsePluginManifest, PluginError, resolvePluginText } from '@nesso/plugin/runtime'
import { defaultLocale, type Locale } from '@nesso/i18n'
import kernelPackage from '../../plugins/kernel/package.json'
import baseVocabPackage from '../../plugins/base-vocab/package.json'
import exportPackage from '../../plugins/export/package.json'
import importPackage from '../../plugins/import/package.json'
import { notifications } from '../notifications/index.ts'
import { prepareTheme, type ThemePresentation } from '../theme/prepare.ts'
import { createPluginRegistry, type PluginEntry } from './registry.ts'
import { loadActions, type ActionPackage } from './actions.ts'
import { translate } from '../i18n/index.ts'
import { packageFonts, verifyPluginPackage } from '@nesso/plugin/package'
import type { InstalledPlugin, PluginResult } from '../../shared/plugins.ts'

const themes = new Map<string, ThemePresentation>()
const actions = new Map<string, ActionPackage>()
const active = new Map<AbortController, string>()
const installations = new Map<string, AbortController>()
const changing = new Set<string>()
const registry = createPluginRegistry()
const getTranslation = () => translate(nessoStore.getState().preferences.locale ?? defaultLocale)
export const getThemePresentation = (id: string) => themes.get(id)
export const usePlugins = () => useSyncExternalStore(registry.subscribe, registry.getSnapshot)
export const useViewActions = () => usePlugins().flatMap((plugin) => plugin.kind === 'actions' ? plugin.contribution.filter(({ supportsViews }) => supportsViews) : [])
export const pluginMetadata = (plugin: PluginEntry, locale: Locale) => ({ name: resolvePluginText(plugin.i18n.metadata.name, locale), description: resolvePluginText(plugin.i18n.metadata.description, locale), documentation: resolvePluginText(plugin.i18n.metadata.documentation, locale) })
export const stopPluginActions = () => {
  for (const controller of active.keys()) controller.abort()
  for (const [id, controller] of installations) { controller.abort(); window.nessoPlugins?.cancel(id) }
}
export const stopExternalActions = (name: string) => { for (const [controller, source] of active) if (source === name) controller.abort() }
const result = <T>(reply: PluginResult<T>): T => {
  if ('issues' in reply) throw new PluginError('failed', [...reply.issues])
  return reply.value
}
const preparePresentation = async (definition: ThemeDefinition, assets: ReadonlyMap<string, Uint8Array>) => {
  for (const [path, bytes] of assets) {
    try { await new FontFace('nesso-validation', new Uint8Array(bytes)).load() }
    catch { throw new PluginError('invalid-input', [{ path, message: 'Could not decode theme font' }]) }
  }
  return prepareTheme(definition, assets)
}
const parseDefinitionCode = (kind: 'theme' | 'vocab', code: string, path: string) => {
  let raw: unknown
  try { raw = JSON.parse(code) }
  catch { throw new PluginError('invalid-input', [{ path, message: 'Expected a JSON definition' }]) }
  return parseContribution(kind, raw)
}
const externalEntry = (prepared: InstalledPlugin, error?: string): PluginEntry => {
  const entry = { id: prepared.name, version: prepared.version, i18n: prepared.i18n, contentId: prepared.contentId, npmIntegrity: prepared.npmIntegrity, disabled: !prepared.enabled, ...(error ? { error } : {}) }
  return prepared.nesso.kind === 'actions' ? { ...entry, kind: 'actions', contribution: [] } : { ...entry, kind: prepared.nesso.kind }
}
type DiscoveredPlugin = { entry: PluginEntry; source?: ActionPackage; presentation?: ThemePresentation }
const discoverExternal = async (prepared: InstalledPlugin, signal: AbortSignal, restoring: readonly PluginEntry[] = [], replacing?: string): Promise<DiscoveredPlugin> => {
  const verified = await verifyPluginPackage(prepared)
  const bytes = new TextEncoder().encode(verified.code)
  let discovered: DiscoveredPlugin
  if (verified.nesso.kind === 'actions') {
    const source: ActionPackage = { name: verified.name, entry: bytes, manifest: verified.nesso, i18n: verified.i18n }
    const contribution = await loadActions(nessoStore, source, notifications.api, getTranslation, undefined, undefined, signal)
    discovered = { source, entry: { ...externalEntry(prepared), kind: 'actions', contribution } }
  } else {
    const contribution = parseDefinitionCode(verified.nesso.kind, verified.code, verified.nesso.entry)
    if ('relationTypes' in contribution) discovered = { entry: { ...externalEntry(prepared), kind: 'vocab', contribution } }
    else {
      const assets = packageFonts(verified)
      const referenced = new Set([...contribution.fonts.sans.faces, ...contribution.fonts.mono.faces].map(({ path }) => path))
      if (assets.size !== referenced.size || [...assets.keys()].some((path) => !referenced.has(path))) throw new PluginError('invalid-input', [{ path: 'fonts', message: 'Theme must reference exactly its admitted font assets' }])
      const presentation = await preparePresentation(contribution, assets)
      discovered = { entry: { ...externalEntry(prepared), kind: 'theme', contribution }, presentation }
    }
  }
  registry.check([...registry.getSnapshot().filter((entry) => !replacing || entry.contentId !== replacing), ...restoring, discovered.entry])
  return prepared.enabled ? discovered : { entry: externalEntry(prepared) }
}
const publish = (next: readonly PluginEntry[], staged: readonly DiscoveredPlugin[] = [], restoring = false) => {
  registry.check(next)
  for (const { entry, source, presentation } of staged) {
    if (source) actions.set(entry.id, source)
    if (presentation && entry.kind === 'theme' && entry.contribution) themes.set(entry.contribution.id, presentation)
  }
  const definitions = next.filter((entry) => entry.kind !== 'actions')
  const previous = registry.getSnapshot().filter((entry) => entry.kind !== 'actions')
  if (restoring || definitions.length !== previous.length || definitions.some((entry, index) => entry !== previous[index])) {
    host.replacePluginDefinitions(definitions.flatMap<ThemeDefinition | VocabDefinition>((entry) => entry.contribution ? [entry.contribution] : []), restoring)
  }
  for (const name of actions.keys()) if (!next.some((entry) => entry.id === name && entry.kind === 'actions' && !entry.disabled && !entry.error)) actions.delete(name)
  for (const id of themes.keys()) if (!next.some((entry) => entry.kind === 'theme' && entry.contribution?.id === id)) themes.delete(id)
  registry.replace(next)
}

export async function initializeExternalPlugins(signal: AbortSignal) {
  const bridge = window.nessoPlugins
  if (!bridge || signal.aborted) return () => {}
  const t = getTranslation()
  try {
    const stored = result(await bridge.list())
    if (stored.safeMode) return () => {}
    const entries: PluginEntry[] = []
    const staged: DiscoveredPlugin[] = []
    for (const prepared of stored.packages) {
      if (signal.aborted) return () => {}
      if (!prepared.enabled) { entries.push(externalEntry(prepared)); continue }
      try {
        const discovered = await discoverExternal(prepared, signal, entries)
        entries.push(discovered.entry)
        staged.push(discovered)
      } catch { entries.push(externalEntry(prepared, t('pluginUnavailable'))) }
    }
    if (signal.aborted) return () => {}
    publish([...registry.getSnapshot(), ...entries], staged, true)
    if (entries.some((entry) => entry.error)) notifications.api.notify({ tone: 'warning', title: t('pluginExternalFailed') })
  } catch { notifications.api.notify({ tone: 'warning', title: t('pluginExternalFailed') }) }
  if (signal.aborted) return () => {}
  return bridge.subscribe((event) => {
    if (event.type === 'cancel') { installations.get(event.id)?.abort(); return }
    const controller = new AbortController()
    installations.set(event.id, controller)
    void (async () => {
      let locked = false
      try {
        if (signal.aborted) throw new PluginError('cancelled', [{ path: 'plugins', message: t('pluginUnavailable') }])
        if (event.replacing && !registry.getSnapshot().some((entry) => entry.id === event.package.name && entry.contentId === event.replacing)) throw new PluginError('stale-state', [{ path: 'plugins', message: 'Installed package changed' }])
        const discovered = await discoverExternal(event.package, controller.signal, [], event.replacing)
        const { entry } = discovered
        if (controller.signal.aborted || signal.aborted || changing.size) throw new PluginError('cancelled', [{ path: 'plugins', message: 'Installation cancelled' }])
        changing.add(entry.id)
        locked = true
        stopExternalActions(entry.id)
        result(await bridge.settle(event.id, event.package.contentId, true))
        publish([...registry.getSnapshot().filter((previous) => previous.id !== entry.id), entry], [discovered])
      } catch {
        await bridge.settle(event.id, event.package.contentId, false).catch(() => {})
        notifications.api.notify({ tone: 'warning', title: t('pluginActionFailed') })
      } finally { if (locked) changing.delete(event.package.name); controller.abort(); installations.delete(event.id) }
    })()
  })
}

export async function setExternalPluginEnabled(contentId: string, enabled: boolean) {
  const entry = registry.getSnapshot().find((plugin) => plugin.contentId === contentId)
  const bridge = window.nessoPlugins
  if (!entry || !bridge || changing.size) return
  changing.add(entry.id)
  stopExternalActions(entry.id)
  const controller = new AbortController()
  try {
    const prepared = result(await bridge.list()).packages.find((record) => record.contentId === contentId)
    if (!prepared) throw new PluginError('stale-state', [{ path: 'plugins', message: 'Installed package changed' }])
    const discovered = enabled ? await discoverExternal({ ...prepared, enabled }, controller.signal, [], contentId) : undefined
    const record = result(await bridge.setEnabled(contentId, enabled))
    publish(registry.getSnapshot().map((previous) => previous.id === entry.id ? discovered?.entry ?? externalEntry(record) : previous), discovered ? [discovered] : [])
  } catch { notifications.api.notify({ tone: 'warning', title: getTranslation()('pluginActionFailed') }) }
  finally { controller.abort(); changing.delete(entry.id) }
}

export async function removeExternalPlugin(contentId: string) {
  const entry = registry.getSnapshot().find((plugin) => plugin.contentId === contentId)
  if (!entry || !window.nessoPlugins || changing.size) return
  changing.add(entry.id)
  stopExternalActions(entry.id)
  try {
    result(await window.nessoPlugins.remove(contentId))
    publish(registry.getSnapshot().filter((plugin) => plugin.contentId !== contentId))
  } catch { notifications.api.notify({ tone: 'warning', title: getTranslation()('pluginActionFailed') }) }
  finally { changing.delete(entry.id) }
}

export async function initializeBundledPlugins() {
  const entries = await Promise.all([{ package: kernelPackage, id: 'kernel' }, { package: baseVocabPackage, id: 'base-vocab' }].map(async ({ package: source, id }): Promise<PluginEntry> => {
    const manifest = parsePluginManifest(source.nesso)
    if (manifest.kind !== 'theme' && manifest.kind !== 'vocab') throw new PluginError('invalid-input', [{ path: 'manifest.kind', message: 'Expected a definition package' }])
    const response = await fetch(new URL(`preinstalled/${id}/definition.json`, document.baseURI))
    if (!response.ok) throw new PluginError('failed', [{ path: 'definition', message: 'Could not load bundled definition' }])
    const contribution = parseDefinitionCode(manifest.kind, await response.text(), `preinstalled/${id}/definition.json`)
    if (contribution.id !== id) throw new PluginError('denied', [{ path: 'contribution.id', message: 'Unexpected definition identity' }])
    const entry = { id: source.name, version: source.version, i18n: parsePluginI18n(source.i18n) }
    if ('relationTypes' in contribution) return { ...entry, kind: 'vocab', contribution }
    const paths = [...new Set([...contribution.fonts.sans.faces, ...contribution.fonts.mono.faces].map(({ path }) => path))]
    const assets = new Map(await Promise.all(paths.map(async (path): Promise<[string, Uint8Array]> => {
      const response = await fetch(new URL(`preinstalled/${id}/${path}`, document.baseURI))
      if (!response.ok) throw new PluginError('failed', [{ path: 'fonts', message: 'Could not load bundled font' }])
      return [path, new Uint8Array(await response.arrayBuffer())]
    })))
    themes.set(contribution.id, await preparePresentation(contribution, assets))
    return { ...entry, kind: 'theme', contribution }
  }))
  for (const entry of entries) {
    if (entry.kind === 'theme' && entry.contribution) registerTheme(entry.contribution)
    if (entry.kind === 'vocab' && entry.contribution) registerVocab(entry.contribution)
  }
  const commands = await Promise.all([{ source: exportPackage, id: 'export' }, { source: importPackage, id: 'import' }].map(async ({ source, id }): Promise<PluginEntry> => {
    const manifest = parsePluginManifest(source.nesso)
    if (manifest.kind !== 'actions') throw new PluginError('invalid-input', [{ path: 'manifest.kind', message: 'Expected an action package' }])
    const i18n = parsePluginI18n(source.i18n)
    const packageEntry = { name: source.name, entry: `preinstalled/${id}/index.js`, manifest, i18n }
    const descriptors = await loadActions(nessoStore, packageEntry, notifications.api, getTranslation)
    actions.set(source.name, packageEntry)
    return { id: source.name, version: source.version, kind: 'actions', i18n, contribution: descriptors }
  }))
  registry.replace([...entries, ...commands])
}

export async function invokeAction(actionId: string, viewId = nessoStore.getState().workspace.activeViewId) {
  const plugin = registry.getSnapshot().find((entry) => entry.kind === 'actions' && entry.contribution.some(({ id }) => id === actionId))
  const source = plugin && actions.get(plugin.id)
  if (!source || plugin?.kind !== 'actions' || changing.has(plugin.id)) return
  const controller = new AbortController()
  active.set(controller, source.name)
  try { await loadActions(nessoStore, source, notifications.api, getTranslation, window.nessoFiles, { actionId, viewId, descriptors: plugin.contribution }, controller.signal) }
  catch (error) {
    if (error instanceof PluginError && error.code === 'cancelled') return
    const t = getTranslation()
    const locale = nessoStore.getState().preferences.locale ?? defaultLocale
    notifications.api.notify({ tone: 'warning', title: `${pluginMetadata(plugin, locale).name}: ${t('pluginActionFailed')}`, description: error instanceof PluginError ? error.displayMessage ? resolvePluginText(error.displayMessage, locale) : error.message : undefined })
  }
  finally { active.delete(controller) }
}
