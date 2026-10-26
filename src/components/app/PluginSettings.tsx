import { useEffect, useRef, useState, useSyncExternalStore, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { defaultLocale, type Locale } from '@nesso-how/i18n'
import { Button } from '@nesso-how/ui'
import { RefreshCw } from 'lucide-react'
import gt from 'semver/functions/gt.js'
import type { InstalledPlugin, NpmPlugin, PluginBridge, PluginResult } from '../../../shared/plugins.ts'
import { translate } from '@/i18n'
import { pluginMetadata, useExternalPluginsAvailable, usePlugins } from '@/plugins'
import type { PluginEntry } from '@/plugins/registry'
import { createPluginInstaller } from '@/plugins/installer'
import { checkPluginUpdates } from '@/plugins/updates'
import { notifications } from '@/notifications'
import { host, useNessoStore } from '@/store'
import { PluginRow } from './PluginRow'
import { PluginSearch } from './PluginSearch'
import { PluginDetails } from './PluginDetails'

const idle: ReturnType<ReturnType<typeof createPluginInstaller>['getSnapshot']> = { running: false }
const idleSnapshot = () => idle
const idleSubscribe = () => () => {}
const currentLocale = () => host.store.getState().preferences.locale ?? defaultLocale

function createInstallerNotify(setSelected: Dispatch<SetStateAction<NpmPlugin | undefined>>) {
  return ({ target, result }: { target: { readonly package: NpmPlugin; readonly replacing?: string }; result: PluginResult<InstalledPlugin | null> }) => {
    const t = translate(currentLocale())
    if ('issues' in result) notifications.api.notify({
      tone: 'warning',
      title: t(target.replacing ? 'pluginUpdateFailed' : 'pluginInstallFailed'),
      description: [t(target.replacing ? 'pluginUpdateFailedDescription' : 'pluginInstallFailedDescription', { package: `${target.package.name}@${target.package.version}` }), result.issues.map(({ message }) => message).join(' ').slice(0, 1024)].join('\n\n'),
    })
    if (target.replacing && ('issues' in result || !result.value)) setSelected((current) => current?.name === target.package.name ? undefined : current)
  }
}

function usePluginInstaller(bridge: Pick<PluginBridge, 'installNpm' | 'cancel' | 'subscribe'> | undefined, setSelected: Dispatch<SetStateAction<NpmPlugin | undefined>>) {
  const [installer] = useState(() => bridge ? createPluginInstaller(bridge, currentLocale, createInstallerNotify(setSelected)) : undefined)
  const installation = useSyncExternalStore(installer?.subscribe ?? idleSubscribe, installer?.getSnapshot ?? idleSnapshot)
  useEffect(() => {
    const stop = installer && bridge?.subscribe(installer.receive)
    return () => { installer?.cancel(); stop?.() }
  }, [bridge, installer])
  return { installer, installation }
}

function buildUpdateQueue(plugins: readonly PluginEntry[], targets: readonly NpmPlugin[]) {
  const expands = (target: NpmPlugin) => {
    const baseline = plugins.find((entry) => entry.id === target.name)?.access
    return !baseline || target.nesso.writes.some((value) => !baseline.writes.includes(value)) || target.nesso.capabilities.some((value) => !baseline.capabilities.includes(value))
  }
  const queue = targets.map((target) => ({ package: target, replacing: plugins.find((entry) => entry.id === target.name)?.contentId }))
  queue.sort((left, right) => Number(expands(left.package)) - Number(expands(right.package)))
  return queue
}

function usePluginUpdateCheck(bridge: Pick<PluginBridge, 'latest'> | undefined, externalAvailable: boolean, external: readonly PluginEntry[], plugins: readonly PluginEntry[], installation: { running: boolean }, setSelected: Dispatch<SetStateAction<NpmPlugin | undefined>>) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const [checked, setChecked] = useState<readonly NpmPlugin[]>([])
  const [checking, setChecking] = useState(false)
  const updates = checked.filter((target) => plugins.some((entry) => entry.id === target.name && entry.kind === target.nesso.kind && gt(target.version, entry.version)))
  const checkUpdates = async (name?: string) => {
    if (!bridge || !externalAvailable || checking || installation.running) return
    const entries = external.filter((entry) => !name || entry.id === name)
    if (!entries.length) return
    setChecking(true)
    let failed = false
    const targets = await checkPluginUpdates(bridge, entries, (failedName) => {
      failed = true
      if (alive.current) notifications.api.notify({ tone: 'warning', title: t('pluginCheckFailed'), description: t('pluginCheckFailedDescription', { package: failedName }) })
    })
    if (!alive.current) return
    setChecked((previous) => [...previous.filter((target) => !entries.some(({ id }) => id === target.name)), ...targets])
    setChecking(false)
    if (name) setSelected(targets[0])
    if (!targets.length && !failed) notifications.api.notify({ tone: 'info', title: t('pluginUpToDate'), description: name ? t('pluginUpToDateSingleDescription', { name: pluginMetadata(entries[0], locale).name }) : t('pluginUpToDateDescription') })
  }
  return { updates, checking, checkUpdates }
}

function InstalledGroups({ external, plugins, updates, showExternal, locale, onOpen }: { external: readonly PluginEntry[]; plugins: readonly PluginEntry[]; updates: readonly NpmPlugin[]; showExternal: boolean; locale: Locale; onOpen: (name: string, from: string, target?: NpmPlugin) => void }) {
  const t = translate(locale)
  return <section className="plugin-installed">
    {showExternal && <>
      <h3 className="settings-section-title mt-6 mb-2">{t('pluginExternalPackages')}</h3>
      {!external.length && <p className="plugin-empty">{t('pluginEmpty')}</p>}
      {external.map((entry) => { const update = updates.find(({ name }) => name === entry.id); return <PluginRow key={entry.id} entry={{ ...entry, name: entry.id }} locale={locale} status={t(entry.disabled ? 'pluginDisabled' : entry.error ? 'pluginUnavailable' : 'pluginEnabled')} update={update && t('pluginUpdateAvailable')} onClick={() => onOpen(entry.id, 'plugins', update)} /> })}
    </>}
    <h3 className="settings-section-title mt-6 mb-2">{t('pluginBuiltInPackages')}</h3>
    {plugins.filter((entry) => !entry.contentId).map((entry) => <PluginRow key={entry.id} entry={{ ...entry, name: entry.id }} locale={locale} status={t('pluginEnabled')} onClick={() => onOpen(entry.id, 'plugins')} />)}
  </section>
}

export function PluginSettings({ page, onPageChange, titleRef }: { page: string; onPageChange: (page: string) => void; titleRef: RefObject<HTMLHeadingElement | null> }) {
  const plugins = usePlugins()
  const externalAvailable = useExternalPluginsAvailable()
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const bridge = window.nessoPlugins
  const [searchKey, setSearchKey] = useState(0)
  const [selected, setSelected] = useState<NpmPlugin>()
  const [back, setBack] = useState('plugins')
  const { installer, installation } = usePluginInstaller(bridge, setSelected)
  const external = plugins.filter((entry) => entry.contentId)
  const { updates, checking, checkUpdates } = usePluginUpdateCheck(bridge, externalAvailable, external, plugins, installation, setSelected)
  const start = (targets: readonly NpmPlugin[]) => {
    if (!externalAvailable) return
    void installer?.start(buildUpdateQueue(plugins, targets))
  }
  const open = (name: string, from: string, target?: NpmPlugin) => { setSelected(target); setBack(from); onPageChange(`plugin:${name}`) }
  const name = page.startsWith('plugin:') ? page.slice(7) : undefined
  const installed = plugins.find((entry) => entry.id === name)
  const target = selected && selected.name === name && (!installed || gt(selected.version, installed.version)) ? selected : undefined
  const detail = !!installed || !!target
  if (page !== 'plugins' && page !== 'plugin-find' && !name) return null
  return <div className="plugin-settings">
    <div className="plugin-scroll" hidden={detail}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 ref={detail ? undefined : titleRef} tabIndex={-1} className="settings-page-title outline-none">{t('plugins')}</h2>
        {bridge && externalAvailable && <>
          {page === 'plugins' && <Button variant="ghost" size="sm" disabled={checking || installation.running || !external.length} onClick={() => updates.length ? start(updates) : void checkUpdates()}><RefreshCw />{t(installation.running ? 'pluginUpdating' : checking ? 'pluginChecking' : updates.length ? 'pluginUpdateAll' : 'pluginCheckUpdates')}</Button>}
          {page === 'plugin-find' && <Button variant="ghost" size="sm" disabled={checking} onClick={() => setSearchKey((key) => key + 1)}><RefreshCw />{t('pluginBrowseAll')}</Button>}
        </>}
      </div>
      <p className="settings-page-description">{t(page === 'plugin-find' ? 'pluginFindDescription' : bridge ? 'pluginManageDescription' : 'pluginManageWebDescription')}</p>
      {bridge && <nav className="plugin-tabs" aria-label={t('plugins')}><Button variant="ghost" aria-current={page === 'plugins' ? 'page' : undefined} onClick={() => onPageChange('plugins')}>{t('pluginInstalled')}<span className="font-mono text-[10px] text-muted-foreground">{plugins.length}</span></Button>{externalAvailable && <Button variant="ghost" aria-current={page === 'plugin-find' ? 'page' : undefined} onClick={() => onPageChange('plugin-find')}>{t('pluginFind')}</Button>}</nav>}
      {bridge && !externalAvailable && <p className="mt-5 rounded border p-3 text-xs leading-5" role="status">{t('pluginSessionSkipped')}</p>}
      {page === 'plugins' && !!installation.skipped?.length && <div className="mt-5 rounded border p-3 text-xs leading-5" role="status"><p>{t('pluginUpdatesSkipped')}</p><ul className="mt-1 list-inside list-disc">{installation.skipped.map((name) => <li key={name}>{name}</li>)}</ul></div>}
      {bridge && externalAvailable && <PluginSearch key={searchKey} bridge={bridge} visible={page === 'plugin-find'} disabled={checking} onOpen={(target) => open(target.name, 'plugin-find', target)} />}
      <div hidden={page === 'plugin-find'}><InstalledGroups external={external} plugins={plugins} updates={updates} showExternal={!!bridge} locale={locale} onOpen={open} /></div>
    </div>
    {page === 'plugin-find' && <footer className="plugin-search-footer">{t('pluginUnreviewed')}</footer>}
    {detail && <PluginDetails key={name} installed={installed} target={target} titleRef={titleRef} back={back} checking={checking} installation={installation} onBack={() => onPageChange(back)} onStart={(target) => start([target])} onCheck={() => void checkUpdates(name)} onCancel={() => installer?.cancel()} onLifecycle={(action) => { if (action === 'disable' || action === 'remove') setSelected(undefined); if (action === 'remove') onPageChange('plugins') }} />}
  </div>
}
