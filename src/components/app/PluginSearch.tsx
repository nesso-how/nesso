import { useEffect, useState } from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import { Button, IconButton, Input } from '@nesso-how/ui'
import { LoaderCircle, Search } from 'lucide-react'
import type { NpmPlugin, PluginBridge } from '../../../shared/plugins.ts'
import { usePlugins } from '@/plugins'
import { translate } from '@/i18n'
import { useNessoStore } from '@/store'
import { PluginRow } from './PluginRow'

export function PluginSearch({ bridge, visible, disabled, onOpen }: { bridge: PluginBridge; visible: boolean; disabled: boolean; onOpen: (entry: NpmPlugin) => void }) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const plugins = usePlugins()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly NpmPlugin[]>([])
  const [state, setState] = useState<'initial' | 'loading' | 'ready' | 'error'>('initial')
  const [next, setNext] = useState<number>()
  const [submitted, setSubmitted] = useState({ query: '', offset: 0 })
  useEffect(() => {
    if (!visible || disabled || (state !== 'initial' && state !== 'loading')) return
    let current = true
    void bridge.search(submitted.query, submitted.offset).then((result) => {
      if (!current) return
      if ('issues' in result) { setState('error'); return }
      setResults((previous) => submitted.offset ? [...previous, ...result.value.packages.filter((entry) => !previous.some(({ name }) => name === entry.name))] : result.value.packages)
      setNext(result.value.next)
      setState('ready')
    }).catch(() => { if (current) setState('error') })
    return () => { current = false }
  }, [bridge, visible, disabled, state, submitted])
  const search = (offset = 0) => { setSubmitted({ query: offset ? submitted.query : query, offset }); setState('loading') }
  const loading = state === 'initial' || state === 'loading'
  return <section className="plugin-search" hidden={!visible} aria-busy={loading}>
    <form className="mt-5" onSubmit={(event) => { event.preventDefault(); void search() }}>
      <label className="settings-section-title" htmlFor="plugin-search">{t('pluginPackageName')}</label>
      <div className="relative mt-2"><Input id="plugin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('pluginSearchPlaceholder')} className="pr-10" maxLength={128} autoComplete="off" spellCheck={false} /><IconButton type="submit" className="absolute top-1/2 right-1 -translate-y-1/2" disabled={disabled || loading} aria-label={t('pluginSearch')}><Search /></IconButton></div>
    </form>
    {state === 'error' ? <div className="plugin-empty" role="status"><p>{t('pluginSearchFailed')}</p><Button className="mt-3" variant="outline" onClick={() => void search()}>{t('pluginRetry')}</Button></div> : <>
      {loading && <div className="plugin-empty flex flex-1 items-center justify-center" role="status"><LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="sr-only">{t('pluginSearching')}</span></div>}
      {state === 'ready' && results.length === 0 && <p className="plugin-empty" role="status">{t('pluginNoResults')}</p>}
      <div hidden={loading}>
        <div className="mt-4">{results.map((entry) => <PluginRow key={entry.name} entry={{ ...entry, kind: entry.nesso.kind }} locale={locale} status={plugins.some(({ id }) => id === entry.name) ? t('pluginInstalled') : undefined} onClick={() => onOpen(entry)} />)}</div>
        {next !== undefined && <Button variant="ghost" disabled={disabled} onClick={() => search(next)}>{t('pluginLoadMore')}</Button>}
      </div>
    </>}
  </section>
}
