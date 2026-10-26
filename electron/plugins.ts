import { app, ipcMain } from 'electron'
import path from 'node:path'
import { preparePluginPackage, type PluginPackageInput } from '../packages/plugin/src/package.ts'
import { PluginError } from '../packages/plugin/src/errors.ts'
import { resolvePluginText } from '../packages/plugin/src/i18n.ts'
import type { InstalledPlugin, PluginResult } from '../shared/plugins.ts'
import type { TrustedRequest } from './ipc.ts'
import { createPluginStorage } from './plugin-storage.ts'
import { acquireNpmPlugin, latestNpmPlugin, searchNpmPlugins } from './plugin-npm.ts'
import { createPluginApproval } from './plugin-approval.ts'
import { ElectronError } from './errors.ts'

export function connectPlugins(trusted: TrustedRequest, acquire: typeof acquireNpmPlugin = acquireNpmPlugin) {
  const storage = createPluginStorage(path.join(app.getPath('userData'), 'plugins'))
  const safeMode = process.argv.includes('--safe-plugins')
  const ready = new Map<number, () => void>()
  let pending: { id: string; owner: number; package?: InstalledPlugin; replacing?: string; approval?: ReturnType<typeof createPluginApproval>; discovering: boolean; committing: boolean; controller: AbortController; cancel: () => void; discover: () => Promise<void>; finish: (result: PluginResult<InstalledPlugin | null>, cancel: boolean) => void } | undefined
  const metadata = new Map<number, AbortController>()
  const failure = (): PluginResult<never> => ({ issues: [{ path: 'plugins', message: 'Plugin installation or storage operation failed; no existing package was replaced' }] })
  ipcMain.on('plugins:ready', (event) => {
    if (!trusted(event) || ready.has(event.sender.id)) return
    const disconnect = () => {
      ready.delete(event.sender.id)
      event.sender.removeListener('destroyed', disconnect)
      event.sender.removeListener('did-start-navigation', navigating)
      if (pending?.owner === event.sender.id) pending.cancel()
    }
    const navigating = (details: { isMainFrame: boolean }) => { if (details.isMainFrame) disconnect() }
    ready.set(event.sender.id, disconnect)
    event.sender.once('destroyed', disconnect)
    event.sender.on('did-start-navigation', navigating)
  })
  ipcMain.on('plugins:disconnect', (event) => {
    if (!trusted(event)) return
    ready.get(event.sender.id)?.()
  })
  ipcMain.handle('plugins:list', async (event) => {
    if (!trusted(event)) return failure()
    try { return { value: { safeMode, ...(safeMode ? { packages: [], issues: [] } : await storage.list()) } } } catch { return failure() }
  })
  for (const operation of ['search', 'latest'] as const) ipcMain.handle(`plugins:${operation}`, async (event, input: unknown, offset: unknown) => {
    if (!trusted(event) || safeMode) return failure()
    metadata.get(event.sender.id)?.abort()
    const controller = new AbortController()
    metadata.set(event.sender.id, controller)
    const cancel = () => controller.abort()
    event.sender.once('destroyed', cancel)
    event.sender.once('did-start-navigation', cancel)
    try {
      const value = operation === 'search' ? await searchNpmPlugins({ query: input, offset }, controller.signal) : await latestNpmPlugin(input, controller.signal)
      if (controller.signal.aborted || !trusted(event)) return failure()
      return { value }
    } catch { return { issues: [{ path: 'npm', message: 'Could not load compatible npm packages. Check the connection and package compatibility, then try again. Installed plugins remain available offline.' }] } }
    finally {
      if (metadata.get(event.sender.id) === controller) metadata.delete(event.sender.id)
      event.sender.removeListener('destroyed', cancel)
      event.sender.removeListener('did-start-navigation', cancel)
    }
  })
  for (const source of ['development', 'npm'] as const) ipcMain.handle(source === 'npm' ? 'plugins:npm' : 'plugins:propose', async (event, id: unknown, input: unknown, locale: unknown, replacing: unknown): Promise<PluginResult<InstalledPlugin | null>> => {
    if (!trusted(event) || safeMode || !ready.has(event.sender.id) || pending || typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || (replacing !== undefined && (typeof replacing !== 'string' || !/^[a-f0-9]{64}$/.test(replacing)))) return failure()
    return new Promise((resolve) => {
      const controller = new AbortController()
      const cancel = (): void => {
        if (pending !== attempt) return
        if (!attempt.committing) { attempt.finish({ value: null }, true); return }
        controller.abort()
        if (!event.sender.isDestroyed()) event.sender.send('plugins:event', { type: 'cancel', id })
      }
      const timer = setTimeout(cancel, 300_000)
      const attempt = {
        id, owner: event.sender.id, replacing, discovering: false, committing: false, controller, cancel, package: undefined as InstalledPlugin | undefined,
        approval: undefined as ReturnType<typeof createPluginApproval> | undefined,
        discover: async () => {
          if (pending !== attempt || !attempt.package || !attempt.approval || attempt.discovering || !trusted(event)) return
          const record = await storage.check(attempt.package, replacing)
          const previous = (await storage.list()).packages.find((entry) => entry.name === record.name)
          if (pending !== attempt || !trusted(event)) return
          if (!attempt.approval.authorized(record, previous)) throw new PluginError('denied', [{ path: 'plugins', message: 'Package authorization or installed content changed' }])
          attempt.discovering = true
          event.sender.send('plugins:event', { type: 'install', id, package: record, replacing })
        },
        finish: (result: PluginResult<InstalledPlugin | null>, cancelled: boolean) => {
          if (pending !== attempt) return
          pending = undefined
          attempt.approval?.revoke()
          clearTimeout(timer)
          event.sender.removeListener('destroyed', cancel)
          event.sender.removeListener('did-start-navigation', navigating)
          if (cancelled) {
            controller.abort()
            if (!event.sender.isDestroyed()) event.sender.send('plugins:event', { type: 'cancel', id })
          }
          resolve(result)
        },
      }
      const navigating = (details: { isMainFrame: boolean }) => { if (details.isMainFrame) cancel() }
      pending = attempt
      event.sender.once('destroyed', cancel)
      event.sender.on('did-start-navigation', navigating)
      void (async () => {
        const prepared = source === 'npm' ? await acquire(input, controller.signal) : await preparePluginPackage(input as PluginPackageInput)
        if (pending !== attempt || !trusted(event)) return
        const record = await storage.check(prepared, replacing)
        if (pending !== attempt || !trusted(event)) return
        attempt.package = record
        const language = locale === 'it' || locale === 'zh-CN' ? locale : 'en'
        const previous = (await storage.list()).packages.find((entry) => entry.name === record.name)
        if (pending !== attempt || !trusted(event)) return
        const approval = createPluginApproval(record, previous, source === 'npm')
        attempt.approval = approval
        if (approval.challenge) event.sender.send('plugins:event', { type: 'approval', approval: { id, challenge: approval.challenge, name: record.name, version: record.version, description: resolvePluginText(prepared.i18n.metadata.description, language), access: approval.access, additional: approval.additional, updating: replacing !== undefined } })
        else await attempt.discover()
      })().catch((error: unknown) => attempt.finish(error instanceof PluginError || error instanceof ElectronError ? { issues: error.issues } : failure(), true))
    })
  })
  ipcMain.handle('plugins:approve', async (event, challenge: unknown, allow: unknown): Promise<PluginResult<null>> => {
    const attempt = pending
    if (!trusted(event) || !attempt || attempt.owner !== event.sender.id || !attempt.approval?.respond(challenge, allow)) return failure()
    if (allow === false) { attempt.cancel(); return { value: null } }
    try { await attempt.discover(); return { value: null } }
    catch { attempt.finish(failure(), true); return failure() }
  })
  ipcMain.on('plugins:cancel', (event, id: unknown) => { if (trusted(event) && pending?.owner === event.sender.id && pending.id === id) pending.cancel() })
  ipcMain.handle('plugins:settle', async (event, id: unknown, contentId: unknown, valid: unknown): Promise<PluginResult<null>> => {
    const attempt = pending
    if (!trusted(event) || !attempt || attempt.owner !== event.sender.id || attempt.id !== id || !attempt.discovering || attempt.committing || !attempt.package || attempt.package.contentId !== contentId) return failure()
    if (valid !== true) { attempt.finish(failure(), true); return failure() }
    attempt.committing = true
    try {
      const previous = (await storage.list()).packages.find((entry) => entry.name === attempt.package!.name)
      if (!attempt.approval?.authorized(attempt.package, previous)) throw new PluginError('denied', [{ path: 'plugins', message: 'Package authorization changed' }])
      const record = await storage.install(attempt.package, () => pending === attempt && !attempt.controller.signal.aborted && trusted(event), attempt.replacing)
      attempt.finish({ value: record }, false)
      return { value: null }
    } catch { attempt.finish(attempt.controller.signal.aborted ? { value: null } : failure(), true); return failure() }
  })
  ipcMain.handle('plugins:remove', async (event, contentId: unknown): Promise<PluginResult<null>> => {
    if (!trusted(event) || safeMode || typeof contentId !== 'string' || !/^[a-f0-9]{64}$/.test(contentId)) return failure()
    if (pending?.replacing === contentId) pending.cancel()
    try { await storage.remove(contentId); return { value: null } } catch { return failure() }
  })
  ipcMain.handle('plugins:enabled', async (event, contentId: unknown, enabled: unknown): Promise<PluginResult<InstalledPlugin>> => {
    if (!trusted(event) || safeMode || typeof contentId !== 'string' || !/^[a-f0-9]{64}$/.test(contentId) || typeof enabled !== 'boolean') return failure()
    if (pending?.replacing === contentId) pending.cancel()
    try { return { value: await storage.setEnabled(contentId, enabled) } } catch { return failure() }
  })
}
