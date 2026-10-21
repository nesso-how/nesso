import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { preparePluginPackage, type PluginPackageInput } from '../packages/plugin/src/package.ts'
import { PluginError } from '../packages/plugin/src/errors.ts'
import { resolvePluginText } from '../packages/plugin/src/i18n.ts'
import type { InstalledPlugin, PluginResult } from '../shared/plugins.ts'
import type { TrustedRequest } from './ipc.ts'
import { createPluginStorage } from './plugin-storage.ts'
import { acquireNpmPlugin } from './plugin-npm.ts'
import en from '../src/i18n/en.json' with { type: 'json' }
import it from '../src/i18n/it.json' with { type: 'json' }
import zhCN from '../src/i18n/zh-CN.json' with { type: 'json' }

export function connectPlugins(trusted: TrustedRequest) {
  const storage = createPluginStorage(path.join(app.getPath('userData'), 'plugins'))
  const safeMode = process.argv.includes('--safe-plugins')
  const ready = new Set<number>()
  let pending: { id: string; owner: number; package?: InstalledPlugin; replacing?: string; approved: boolean; committing: boolean; controller: AbortController; cancel: () => void; finish: (result: PluginResult<InstalledPlugin | null>, cancel: boolean) => void } | undefined
  const failure = (): PluginResult<never> => ({ issues: [{ path: 'plugins', message: 'Plugin installation or storage operation failed; no existing package was replaced' }] })
  ipcMain.on('plugins:ready', (event) => {
    if (!trusted(event) || ready.has(event.sender.id)) return
    ready.add(event.sender.id)
    event.sender.once('destroyed', () => ready.delete(event.sender.id))
  })
  ipcMain.on('plugins:disconnect', (event) => {
    if (!trusted(event)) return
    ready.delete(event.sender.id)
    if (pending?.owner === event.sender.id) pending.cancel()
  })
  ipcMain.handle('plugins:list', async (event) => {
    if (!trusted(event)) return failure()
    try { return { value: { safeMode, packages: safeMode ? [] : await storage.list() } } } catch { return failure() }
  })
  for (const source of ['development', 'npm'] as const) ipcMain.handle(source === 'npm' ? 'plugins:npm' : 'plugins:propose', async (event, id: unknown, input: unknown, locale: unknown, replacing: unknown): Promise<PluginResult<InstalledPlugin | null>> => {
    if (!trusted(event) || safeMode || !ready.has(event.sender.id) || pending || typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || (replacing !== undefined && (typeof replacing !== 'string' || !/^[a-f0-9]{64}$/.test(replacing)))) return failure()
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return failure()
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
        id, owner: event.sender.id, replacing, approved: false, committing: false, controller, cancel, package: undefined as InstalledPlugin | undefined,
        finish: (result: PluginResult<InstalledPlugin | null>, cancelled: boolean) => {
          if (pending !== attempt) return
          pending = undefined
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
      const navigating = (details: { isMainFrame: boolean }) => { if (details.isMainFrame) { ready.delete(event.sender.id); cancel() } }
      pending = attempt
      event.sender.once('destroyed', cancel)
      event.sender.on('did-start-navigation', navigating)
      void (async () => {
        const prepared = source === 'npm' ? await acquireNpmPlugin(input, controller.signal) : await preparePluginPackage(input as PluginPackageInput)
        if (pending !== attempt || !trusted(event)) return
        const record = await storage.check(prepared, replacing)
        if (pending !== attempt || !trusted(event)) return
        attempt.package = record
        const language = locale === 'it' || locale === 'zh-CN' ? locale : 'en'
        const t = language === 'it' ? it : language === 'zh-CN' ? zhCN : en
        const metadata = { name: resolvePluginText(prepared.i18n.metadata.name, language), description: resolvePluginText(prepared.i18n.metadata.description, language), documentation: resolvePluginText(prepared.i18n.metadata.documentation, language) }
        const detail = [metadata.description, metadata.documentation, source === 'npm' ? t.pluginNpmSource : t.pluginDevelopmentSource, t[prepared.nesso.kind], ...(prepared.nesso.kind === 'actions' ? [t.pluginWriteScope] : []), `${t.pluginWrites}: ${prepared.nesso.writes.join(', ') || '—'}`, `${t.pluginCapabilities}: ${prepared.nesso.capabilities.join(', ') || '—'}`, ...(prepared.fonts.length ? [`WOFF2: ${prepared.fonts.map(({ path }) => path).join(', ')}`] : []), `SHA-256: ${prepared.contentId}`, t.pluginInstallWarning].join('\n\n')
        const dialogController = new AbortController()
        const closeDialog = () => dialogController.abort()
        controller.signal.addEventListener('abort', closeDialog, { once: true })
        let choice: { response: number }
        try {
          choice = await dialog.showMessageBox(window, { type: 'warning', title: 'Nesso', message: `${replacing ? t.pluginUpdateTitle : t.pluginInstallTitle}\n${metadata.name}\n${prepared.name}@${prepared.version}`, detail, buttons: [t.cancel, replacing ? t.pluginUpdate : t.pluginInstall], defaultId: 0, cancelId: 0, noLink: true, signal: dialogController.signal })
        } finally { controller.signal.removeEventListener('abort', closeDialog) }
        if (pending !== attempt || !trusted(event)) return
        if (choice.response !== 1) { cancel(); return }
        attempt.approved = true
        event.sender.send('plugins:event', { type: 'install', id, package: record, replacing })
      })().catch((error: unknown) => attempt.finish(error instanceof PluginError ? { issues: error.issues } : failure(), true))
    })
  })
  ipcMain.on('plugins:cancel', (event, id: unknown) => { if (trusted(event) && pending?.owner === event.sender.id && pending.id === id) pending.cancel() })
  ipcMain.handle('plugins:settle', async (event, id: unknown, contentId: unknown, valid: unknown): Promise<PluginResult<null>> => {
    const attempt = pending
    if (!trusted(event) || !attempt || attempt.owner !== event.sender.id || attempt.id !== id || !attempt.approved || !attempt.package || attempt.package.contentId !== contentId) return failure()
    if (valid !== true) { attempt.finish(failure(), true); return failure() }
    attempt.approved = false
    attempt.committing = true
    try {
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
