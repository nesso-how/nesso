import { useEffect, useRef, useState } from 'react'
import { defaultLocale, isLocale, localeNames, locales } from '@nesso/i18n'
import { Button, Dialog, DialogPopup, PreferenceSelect } from '@nesso/ui'
import { Info, Keyboard, MessageCircle, Package, Settings2, X } from 'lucide-react'
import { pluginMetadata, usePlugins } from '@/plugins'
import { host, useNessoStore } from '@/store'
import { translate } from '@/i18n'
import { AiSettings } from './AiSettings'
import { McpSettings } from './McpSettings'
import { About } from './About'
import { ShortcutSettings } from './ShortcutSettings'
import { LocalDataSettings } from './LocalDataSettings'
import { PluginSettings } from './PluginSettings'
import { ToastsHost } from './Toasts'
import type { AiBridge } from '../../../electron/ai-bridge'
import type { McpBridge } from '../../../electron/mcp-bridge'

function AiPage({ ai, mcp }: { ai: AiBridge; mcp: McpBridge | undefined }) {
  const [editing, setEditing] = useState(false)
  return <>
    <AiSettings bridge={ai} onEditorChange={setEditing} />
    {mcp && !editing && <McpSettings bridge={mcp} />}
  </>
}

function PluginPreference({ kind }: { kind: 'theme' | 'vocab' }) {
  const preferences = useNessoStore((state) => state.preferences)
  const locale = preferences.locale ?? defaultLocale
  const items = usePlugins().flatMap((entry) => entry.kind === kind && entry.contribution ? [{ value: entry.contribution.id, label: pluginMetadata(entry, locale).name }] : [])
  const key = kind === 'theme' ? 'activeThemeId' : 'activeVocabId'
  const change = kind === 'theme' ? host.store.setActiveTheme : host.store.setActiveVocab
  return <PreferenceSelect label={translate(locale)(kind === 'theme' ? 'theme' : 'activeVocabulary')} items={items} value={preferences[key]} onChange={change} disabled={items.length < 2} />
}

export function SettingsDialog({ page, onPageChange: setPage, onDiscover }: { page: string; onPageChange: (page: string) => void; onDiscover: () => void }) {
  const preferences = useNessoStore((state) => state.preferences)
  const locale = preferences.locale ?? defaultLocale
  const t = translate(locale)
  const title = useRef<HTMLHeadingElement>(null)
  const pageTitle = useRef<HTMLHeadingElement>(null)
  const navigation = useRef<HTMLElement>(null)
  const previousPage = useRef(page)
  const pluginPage = page === 'plugins' || page === 'plugin-find' || page.startsWith('plugin:')

  useEffect(() => {
    navigation.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (previousPage.current !== page) pageTitle.current?.focus()
    previousPage.current = page
  }, [page])

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
          <Button variant="ghost" className="settings-nav w-full justify-start" aria-current={pluginPage ? 'page' : undefined} onClick={() => setPage('plugins')}><Package />{t('plugins')}</Button>
          {window.nessoAi && <Button variant="ghost" className="settings-nav w-full justify-start" aria-current={page === 'ai' ? 'page' : undefined} onClick={() => setPage('ai')}><MessageCircle />{t('ai')}</Button>}
          <div className="settings-footer">
            <Button variant="ghost" className="settings-nav w-full justify-start" aria-current={page === 'shortcuts' ? 'page' : undefined} aria-keyshortcuts="?" title={`${t('shortcuts')} (?)`} onClick={() => setPage('shortcuts')}><Keyboard />{t('shortcuts')}</Button>
            <Button variant="ghost" className="settings-nav w-full justify-start" aria-current={page === 'about' ? 'page' : undefined} onClick={() => setPage('about')}><Info />{t('about')}</Button>
          </div>
        </nav>
        <div className={`settings-content${pluginPage ? ' settings-plugin-content' : ''}`}>
          <PluginSettings page={page} onPageChange={setPage} titleRef={pageTitle} />
          {page === 'shortcuts' && <ShortcutSettings titleRef={pageTitle} />}
          {page === 'about' && <About titleRef={pageTitle} onDiscover={onDiscover} />}
          {page === 'ai' && window.nessoAi && <AiPage ai={window.nessoAi} mcp={window.nessoMcp} />}
          {page === 'general' && <>
            <h2 ref={pageTitle} tabIndex={-1} className="settings-page-title outline-none">{t('general')}</h2>
            <p className="settings-page-description">{t('generalDescription')}</p>
            <section className="settings-section settings-section-first" aria-labelledby="settings-interface">
              <h3 id="settings-interface" className="settings-section-title">{t('interface')}</h3>
              <div className="mt-3 space-y-3">
                <PreferenceSelect label={t('language')} items={locales.map((value) => ({ value, label: localeNames[value] }))} value={locale} onChange={(value) => { if (isLocale(value)) host.store.setLocale(value) }} />
                <PluginPreference kind="theme" />
              </div>
            </section>
            <section className="settings-section" aria-labelledby="settings-vocabulary">
              <h3 id="settings-vocabulary" className="settings-section-title">{t('vocab')}</h3>
              <div className="mt-3"><PluginPreference kind="vocab" /></div>
            </section>
            {window.nessoDataLocation && <LocalDataSettings bridge={window.nessoDataLocation} />}
          </>}
        </div>
      </div>
      <ToastsHost />
    </DialogPopup>
  )
}
