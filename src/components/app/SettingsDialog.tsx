import { useEffect, useRef, useState } from 'react'
import { defaultLocale, isLocale, localeNames, locales } from '@nesso/i18n'
import { Button, Dialog, DialogPopup, PreferenceSelect } from '@nesso/ui'
import { ArrowUpRight, Check, Info, Keyboard, MessageCircle, Settings2, X, Palette, Shapes, Zap } from 'lucide-react'
import { pluginMetadata, removeExternalPlugin, setExternalPluginEnabled, stopExternalActions, usePlugins } from '@/plugins'
import { host, useNessoStore } from '@/store'
import { translate } from '@/i18n'
import { AiSettings } from './AiSettings'
import { McpSettings } from './McpSettings'
import { About } from './About'
import { ShortcutSettings } from './ShortcutSettings'
import { LocalDataSettings } from './LocalDataSettings'
import type { AiBridge } from '../../../electron/ai-bridge'
import type { McpBridge } from '../../../electron/mcp-bridge'

function AiPage({ ai, mcp }: { ai: AiBridge; mcp: McpBridge | undefined }) {
  const [editing, setEditing] = useState(false)
  return <>
    <AiSettings bridge={ai} onEditorChange={setEditing} />
    {mcp && !editing && <McpSettings bridge={mcp} />}
  </>
}

const providers = [
  { kind: 'theme', key: 'activeThemeId', change: host.store.setActiveTheme },
  { kind: 'vocab', key: 'activeVocabId', change: host.store.setActiveVocab },
] as const
const pluginIcons = { theme: Palette, vocab: Shapes, actions: Zap }

export function SettingsDialog({ page, onPageChange: setPage, onDiscover, onBeforeReload }: { page: string; onPageChange: (page: string) => void; onDiscover: () => void; onBeforeReload: () => Promise<boolean> }) {
  const preferences = useNessoStore((state) => state.preferences)
  const plugins = usePlugins()
  const locale = preferences.locale ?? defaultLocale
  const t = translate(locale)
  const [reloading, setReloading] = useState(false)
  const [reloadFailed, setReloadFailed] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  const pageTitle = useRef<HTMLHeadingElement>(null)
  const navigation = useRef<HTMLElement>(null)
  const previousPage = useRef(page)
  const plugin = plugins.find((entry) => entry.id === page)
  const metadata = plugin ? pluginMetadata(plugin, locale) : undefined
  const PluginIcon = plugin ? pluginIcons[plugin.kind] : Info
  const inUse = (entry: typeof plugins[number]) => entry.kind !== 'actions' &&
    providers.some(({ kind, key }) => entry.kind === kind && entry.contribution?.id === preferences[key])

  useEffect(() => {
    navigation.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (previousPage.current !== page) pageTitle.current?.focus()
    previousPage.current = page
  }, [page])

  const reloadWithoutPlugins = async () => {
    if (reloading) return
    setReloading(true)
    setReloadFailed(false)
    try {
      if (!await onBeforeReload()) { setReloadFailed(true); return }
      sessionStorage.setItem('nesso:skip-external-plugins', 'true')
      location.reload()
    } catch { setReloadFailed(true) }
    finally { setReloading(false) }
  }

  return (
    <DialogPopup className="settings-popup" initialFocus={title} finalFocus={() => {
      const trigger = document.querySelector<HTMLButtonElement>('[data-settings-trigger]')
      return trigger?.getClientRects().length ? trigger : null
    }}>
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b px-5">
        <Dialog.Title ref={title} tabIndex={-1} className="text-sm font-medium outline-none">{t('settings')}</Dialog.Title>
        <Dialog.Description className="sr-only">{t('generalDescription')}</Dialog.Description>
        <Dialog.Close render={<Button variant="ghost" size="icon-sm" className="-mr-1 text-muted-foreground" aria-label={t('close')} />}><X /></Dialog.Close>
      </header>
      <div className="settings-body">
        <nav ref={navigation} className="settings-sidebar" aria-label={t('settings')}>
          <p className="settings-nav-heading">Nesso</p>
          <Button variant="ghost" className="settings-nav w-full justify-start" aria-current={page === 'general' ? 'page' : undefined} onClick={() => setPage('general')}><Settings2 />{t('general')}</Button>
          {window.nessoAi && <Button variant="ghost" className="settings-nav w-full justify-start" aria-current={page === 'ai' ? 'page' : undefined} onClick={() => setPage('ai')}><MessageCircle />{t('ai')}</Button>}
          <p className="settings-nav-heading mt-6">{t('plugins')}<span className="ml-auto font-mono text-[10px]">{plugins.length}</span></p>
          {plugins.map((entry) => {
            const Icon = pluginIcons[entry.kind]
            return <Button key={entry.id} variant="ghost" className="settings-nav w-full justify-start" aria-current={page === entry.id ? 'page' : undefined} onClick={() => setPage(entry.id)}>
              <Icon /><span className="min-w-0 flex-1 truncate text-left">{pluginMetadata(entry, locale).name}</span>
            </Button>
          })}
          <div className="settings-footer">
            <Button variant="ghost" className="settings-nav w-full justify-start" aria-current={page === 'shortcuts' ? 'page' : undefined} aria-keyshortcuts="?" title={`${t('shortcuts')} (?)`} onClick={() => setPage('shortcuts')}><Keyboard />{t('shortcuts')}</Button>
            <Button variant="ghost" className="settings-nav w-full justify-start" aria-current={page === 'about' ? 'page' : undefined} onClick={() => setPage('about')}><Info />{t('about')}</Button>
          </div>
        </nav>
        <div className="settings-content">
          {page === 'shortcuts' && <ShortcutSettings titleRef={pageTitle} />}
          {page === 'about' && <About titleRef={pageTitle} onDiscover={onDiscover} />}
          {page === 'ai' && window.nessoAi && <AiPage ai={window.nessoAi} mcp={window.nessoMcp} />}
          {page === 'general' && <>
            <h2 ref={pageTitle} tabIndex={-1} className="settings-page-title outline-none">{t('general')}</h2>
            <p className="settings-page-description">{t('generalDescription')}</p>
            <section className="settings-section settings-section-first" aria-labelledby="settings-interface">
              <h3 id="settings-interface" className="settings-section-title">{t('interface')}</h3>
              <div className="mt-3"><PreferenceSelect label={t('language')} items={locales.map((value) => ({ value, label: localeNames[value] }))} value={locale} onChange={(value) => { if (isLocale(value)) host.store.setLocale(value) }} /></div>
            </section>
            {window.nessoDataLocation && <LocalDataSettings bridge={window.nessoDataLocation} />}
            <section className="settings-section" aria-labelledby="settings-providers">
              <h3 id="settings-providers" className="settings-section-title">{t('providers')}</h3>
              <div className="mt-3 space-y-3">{providers.map(({ kind, key, change }) => {
                const items = plugins.flatMap((entry) => entry.kind === kind && entry.contribution ? [{ value: entry.contribution.id, label: pluginMetadata(entry, locale).name }] : [])
                return <PreferenceSelect key={kind} label={t(kind)} items={items} value={preferences[key]} onChange={change} disabled={items.length < 2} />
              })}</div>
            </section>
            <section className="settings-section" aria-labelledby="settings-actions">
              <h3 id="settings-actions" className="settings-section-title">{t('actionPlugins')}</h3>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{t('actionsHint')}</p>
              <div className="mt-2">{plugins.filter((entry) => entry.kind === 'actions').map((entry) => <Button key={entry.id} variant="ghost" className="-mx-2.5 min-h-11 w-full justify-start" onClick={() => setPage(entry.id)}>
                <Zap /><span className="flex-1 text-left"><span className="block">{pluginMetadata(entry, locale).name}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{t('commandCount', { count: entry.contribution.length })}</span></span><ArrowUpRight className="text-muted-foreground" />
              </Button>)}</div>
            </section>
            {window.nessoPlugins && <div>
              <Button variant="ghost" disabled={reloading} onClick={() => { void reloadWithoutPlugins() }}>{t('pluginSafeReload')}</Button>
              {reloadFailed && <p role="alert" className="mt-2 text-xs">{t('pluginReloadFailed')}</p>}
            </div>}
          </>}
          {plugin && metadata && <>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-canvas"><PluginIcon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3"><h2 ref={pageTitle} tabIndex={-1} className="settings-page-title outline-none">{metadata.name}</h2><span className="settings-badge">{t(plugin.disabled ? 'pluginDisabled' : plugin.error ? 'pluginUnavailable' : inUse(plugin) ? 'inUse' : 'available')}</span></div>
                <p className="mt-1.5 text-xs leading-[18px] text-muted-foreground">{metadata.description}</p>
                <div className="mt-2 flex items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">v{plugin.version}</span><span className="settings-badge">{t(plugin.kind)}</span></div>
              </div>
            </div>
            {plugin.kind === 'actions' ? <section className="mt-6" aria-labelledby="settings-commands">
              <h3 id="settings-commands" className="text-xs font-medium">{t('commands')}</h3>
              <ul className="mt-3 space-y-2">{plugin.contribution.map((action) => <li key={action.id} className="flex items-center gap-2 text-xs"><Check className="size-3.5 text-muted-foreground" aria-hidden="true" />{action.label[locale] ?? action.label.en}</li>)}</ul>
            </section> : plugin.kind === 'vocab' && <section className="mt-6" aria-labelledby="settings-contribution">
              <h3 id="settings-contribution" className="text-xs font-medium">{t(plugin.kind)}</h3>
              <div className="mt-3 flex flex-wrap gap-2">{plugin.contribution?.relationTypes.map((type) => <span key={type.id} className="settings-badge">{type.label}</span>)}</div>
            </section>}
            <section className="settings-section" aria-labelledby="settings-details">
              <h3 id="settings-details" className="mb-3 text-xs font-medium">{t('details')}</h3>
              <dl className="settings-metadata text-xs">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('package')}</dt><dd className="break-all">{plugin.id}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('version')}</dt><dd>{plugin.version}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('origin')}</dt><dd>{plugin.npmIntegrity ? 'npm (registry.npmjs.org)' : t(plugin.contentId ? 'pluginExternal' : 'builtIn')}</dd></div>
                {plugin.contentId && <div><dt className="text-muted-foreground">SHA-256</dt><dd className="mt-1 break-all font-mono text-[10px]">{plugin.contentId}</dd></div>}
              </dl>
              <h4 className="mt-4 text-xs font-medium">{t('documentation')}</h4>
              <p className="mt-2 text-xs leading-[18px] text-muted-foreground">{metadata.documentation}</p>
            </section>
            {plugin.contentId && <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => { void setExternalPluginEnabled(plugin.contentId!, !!plugin.disabled) }}>{t(plugin.disabled ? 'pluginEnable' : 'pluginDisable')}</Button>
              {plugin.kind === 'actions' && !plugin.disabled && <Button variant="ghost" onClick={() => stopExternalActions(plugin.id)}>{t('pluginStop')}</Button>}
              <Button variant="ghost" onClick={() => { void removeExternalPlugin(plugin.contentId!) }}>{t('pluginRemove')}</Button>
            </div>}
          </>}
        </div>
      </div>
    </DialogPopup>
  )
}
