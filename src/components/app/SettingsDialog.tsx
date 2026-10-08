import { useEffect, useId, useRef, useState } from 'react'
import { defaultLocale, isLocale, localeNames, locales } from '@nesso/i18n'
import { Button, Combobox, ComboboxItem, ComboboxPopup, Dialog, DialogPopup, Label } from '@nesso/ui'
import { ArrowUpRight, Check, ChevronDown, Settings2, X } from 'lucide-react'
import { plugins } from '@/plugins'
import { host, useNessoStore } from '@/store'
import { translate } from '@/i18n'
import { PersistenceBanner } from './PersistenceBanner'
import appPackage from '../../../package.json'

const providers = [
  { kind: 'renderer', key: 'activeRendererId', change: host.store.setActiveRenderer },
  { kind: 'theme', key: 'activeThemeId', change: host.store.setActiveTheme },
  { kind: 'vocab', key: 'activeVocabId', change: host.store.setActiveVocab },
] as const

function PreferenceSelect({ label, items, value, onChange, disabled }: {
  label: string
  items: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="settings-preference">
      <Label id={`${id}-label`} htmlFor={id} className="w-fit">{label}</Label>
      <Combobox.Root items={items} value={items.find((item) => item.value === value)} onValueChange={(item) => { if (item) onChange(item.value) }} filter={null} disabled={disabled}>
        <Combobox.Trigger id={id} aria-labelledby={`${id}-label`} render={<Button variant="outline" className="w-full justify-between" />}>
          <Combobox.Value /><ChevronDown className="text-muted-foreground" />
        </Combobox.Trigger>
        <ComboboxPopup>
          <Combobox.List>
            {(item: typeof items[number]) => <ComboboxItem key={item.value} value={item} className="flex items-center justify-between">
              {item.label}<Combobox.ItemIndicator><Check className="size-3.5" /></Combobox.ItemIndicator>
            </ComboboxItem>}
          </Combobox.List>
        </ComboboxPopup>
      </Combobox.Root>
    </div>
  )
}

export function SettingsDialog() {
  const preferences = useNessoStore((state) => state.preferences)
  const locale = preferences.locale ?? defaultLocale
  const t = translate(locale)
  const [page, setPage] = useState('general')
  const title = useRef<HTMLHeadingElement>(null)
  const pageTitle = useRef<HTMLHeadingElement>(null)
  const navigation = useRef<HTMLElement>(null)
  const previousPage = useRef(page)
  const plugin = plugins.find((entry) => entry.id === page)
  const metadata = plugin?.metadata(locale)
  const inUse = (entry: typeof plugins[number]) => entry.kind !== 'actions' &&
    providers.some(({ kind, key }) => entry.kind === kind && entry.contribution.id === preferences[key])

  useEffect(() => {
    navigation.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (previousPage.current !== page) pageTitle.current?.focus()
    previousPage.current = page
  }, [page])

  return (
    <DialogPopup className="settings-popup" initialFocus={title} finalFocus={() => {
      const trigger = document.querySelector<HTMLButtonElement>('[data-settings-trigger]')
      return trigger?.getClientRects().length ? trigger : document.querySelector<HTMLButtonElement>('[data-graph-menu-trigger]')
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
          <p className="settings-nav-heading mt-6">{t('plugins')}<span className="ml-auto font-mono text-[10px]">{plugins.length}</span></p>
          {plugins.map((entry) => <Button key={entry.id} variant="ghost" className="settings-nav w-full justify-start" aria-current={page === entry.id ? 'page' : undefined} onClick={() => setPage(entry.id)}>
            <entry.icon /><span className="min-w-0 flex-1 truncate text-left">{entry.metadata(locale).name}</span>
          </Button>)}
          <div className="settings-version">
            <a href="https://github.com/nesso-how/nesso/releases/latest" target="_blank" rel="noopener noreferrer" aria-label={t('latest')}>
              <span className="font-mono">v{appPackage.version}</span><ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          </div>
        </nav>
        <div className="settings-content">
          {page === 'general' && <>
            <h2 ref={pageTitle} tabIndex={-1} className="text-base font-medium outline-none">{t('general')}</h2>
            <p className="mt-1.5 text-xs leading-[18px] text-muted-foreground">{t('generalDescription')}</p>
            <section className="mt-4" aria-labelledby="settings-interface">
              <h3 id="settings-interface" className="text-xs font-medium">{t('interface')}</h3>
              <div className="mt-3"><PreferenceSelect label={t('language')} items={locales.map((value) => ({ value, label: localeNames[value] }))} value={locale} onChange={(value) => { if (isLocale(value)) host.store.setLocale(value) }} /></div>
            </section>
            <section className="settings-section" aria-labelledby="settings-providers">
              <h3 id="settings-providers" className="text-xs font-medium">{t('providers')}</h3>
              <div className="mt-3 space-y-3">{providers.map(({ kind, key, change }) => {
                const items = plugins.flatMap((entry) => entry.kind === kind ? [{ value: entry.contribution.id, label: entry.contribution.label }] : [])
                return <PreferenceSelect key={kind} label={t(kind)} items={items} value={preferences[key]} onChange={change} disabled={items.length < 2} />
              })}</div>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{t('providerHint')}</p>
            </section>
            <section className="settings-section" aria-labelledby="settings-actions">
              <h3 id="settings-actions" className="text-xs font-medium">{t('actionPlugins')}</h3>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{t('actionsHint')}</p>
              <div className="mt-2">{plugins.filter((entry) => entry.kind === 'actions').map((entry) => <Button key={entry.id} variant="ghost" className="-mx-2.5 min-h-11 w-full justify-start" onClick={() => setPage(entry.id)}>
                <entry.icon /><span className="flex-1 text-left"><span className="block">{entry.metadata(locale).name}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{t('commandCount', { count: entry.contribution.length })}</span></span><ArrowUpRight className="text-muted-foreground" />
              </Button>)}</div>
            </section>
          </>}
          {plugin && metadata && <>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-canvas"><plugin.icon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3"><h2 ref={pageTitle} tabIndex={-1} className="text-base font-medium outline-none">{metadata.name}</h2><span className="settings-badge">{t(inUse(plugin) ? 'inUse' : 'available')}</span></div>
                <p className="mt-1.5 text-xs leading-[18px] text-muted-foreground">{metadata.description}</p>
                <div className="mt-2 flex items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">v{plugin.version}</span><span className="settings-badge">{t(plugin.kind)}</span></div>
              </div>
            </div>
            {plugin.kind === 'actions' ? <section className="mt-6" aria-labelledby="settings-commands">
              <h3 id="settings-commands" className="text-xs font-medium">{t('commands')}</h3>
              <ul className="mt-3 space-y-2">{plugin.contribution.map((action) => <li key={action.id} className="flex items-center gap-2 text-xs"><Check className="size-3.5 text-muted-foreground" aria-hidden="true" />{action.label(locale)}</li>)}</ul>
            </section> : <section className="mt-6" aria-labelledby="settings-contribution">
              <h3 id="settings-contribution" className="text-xs font-medium">{t(plugin.kind)}</h3>
              <p className="mt-3 text-xs">{plugin.contribution.label}</p>
              {plugin.kind === 'vocab' && <div className="mt-3 flex flex-wrap gap-2">{plugin.contribution.relationTypes.map((type) => <span key={type.id} className="settings-badge">{type.label}</span>)}</div>}
            </section>}
            <section className="settings-section" aria-labelledby="settings-details">
              <h3 id="settings-details" className="mb-3 text-xs font-medium">{t('details')}</h3>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('package')}</dt><dd className="break-all">{plugin.id}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('version')}</dt><dd>{plugin.version}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('origin')}</dt><dd>{t('builtIn')}</dd></div>
              </dl>
              <h4 className="mt-4 text-xs font-medium">{t('documentation')}</h4>
              <p className="mt-2 text-xs leading-[18px] text-muted-foreground">{metadata.documentation}</p>
            </section>
          </>}
        </div>
      </div>
      <PersistenceBanner />
    </DialogPopup>
  )
}
