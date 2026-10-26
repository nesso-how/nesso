import type { Locale } from '@nesso/i18n'
import type { NpmPlugin, PluginBridge, PluginResult, InstalledPlugin } from '../../shared/plugins.ts'

type Target = { readonly package: NpmPlugin; readonly replacing?: string }
type Outcome = { readonly target: Target; readonly result: PluginResult<InstalledPlugin | null> }

export function createPluginInstaller(bridge: Pick<PluginBridge, 'installNpm' | 'cancel'>, locale: () => Locale, notify: (outcome: Outcome) => void) {
  let state: { readonly running: boolean; readonly attempt?: { readonly id: string; readonly name: string; readonly version: string; readonly replacing?: string; readonly installing: boolean }; readonly updated?: string; readonly skipped?: readonly string[] } = { running: false }
  let cancelled = false
  const listeners = new Set<() => void>()
  const publish = (next: typeof state) => { state = next; for (const listener of listeners) listener() }
  const cancel = () => { cancelled = true; if (state.attempt) bridge.cancel(state.attempt.id) }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    cancel,
    receive: (event: Parameters<Parameters<PluginBridge['subscribe']>[0]>[0]) => {
      if (event.type === 'install' && state.attempt?.id === event.id) publish({ ...state, attempt: { ...state.attempt, installing: true } })
    },
    start: async (targets: readonly Target[]) => {
      if (state.running || !targets.length) return
      cancelled = false
      const queue = targets.map((target) => ({ ...target, package: { ...target.package } }))
      let skipped: readonly string[] = []
      let updated: string | undefined
      publish({ running: true })
      for (const [index, target] of queue.entries()) {
        if (cancelled) {
          skipped = [...skipped, ...queue.slice(index).filter((target) => target.replacing).map(({ package: { name, version } }) => `${name}@${version}`)]
          break
        }
        const id = crypto.randomUUID()
        publish({ running: true, skipped, ...(updated ? { updated } : {}), attempt: { id, name: target.package.name, version: target.package.version, replacing: target.replacing, installing: false } })
        let result: Outcome['result']
        try { result = await bridge.installNpm(id, { name: target.package.name, version: target.package.version }, locale(), target.replacing) }
        catch { result = { issues: [{ path: 'plugins', message: 'Could not install the package. The previous installation is unchanged.' }] } }
        notify({ target, result })
        if ('value' in result && !result.value && target.replacing) skipped = [...skipped, `${target.package.name}@${target.package.version}`]
        if ('value' in result && result.value) updated = `${result.value.name}@${result.value.version}`
        publish({ running: true, skipped, ...(updated ? { updated } : {}) })
      }
      publish({ running: false, updated, skipped })
    },
  }
}
