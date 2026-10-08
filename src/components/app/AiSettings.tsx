import { useEffect, useId, useState } from 'react'
import { Button, Input, Label } from '@nesso/ui'
import { Check, Plus, Trash2 } from 'lucide-react'
import { aiProviders, type AiBridge, type AiConnectionInput, type AiConnections, type AiProvider, type AiResult } from '../../../electron/ai-contract'
import { useTranslation } from '@/i18n'
import { PreferenceSelect } from './PreferenceSelect'

const newConnection = (): AiConnectionInput => ({ name: 'OpenAI', provider: 'openai', endpoint: aiProviders.openai.endpoint, model: '', apiKey: '' })

export function AiSettings({ bridge }: { bridge: AiBridge }) {
  const t = useTranslation()
  const id = useId()
  const [state, setState] = useState<AiConnections>({ connections: [], activeId: null })
  const [draft, setDraft] = useState(newConnection)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [models, setModels] = useState<readonly string[] | null>(null)
  const saved = state.connections.find((entry) => entry.id === draft.id)
  const hasKey = saved?.hasKey && saved.provider === draft.provider && saved.endpoint === draft.endpoint.replace(/\/+$/, '')
  const failureMessage = t('aiFailure')

  useEffect(() => {
    let mounted = true
    void bridge.list().then((result) => {
      if (!mounted) return
      if ('issues' in result) setError(result.issues.map(({ message }) => message).join('\n'))
      else { setState(result.value); setLoaded(true) }
    }).catch(() => { if (mounted) setError(failureMessage) }).finally(() => { if (mounted) setBusy(false) })
    return () => { mounted = false }
  }, [bridge, failureMessage])

  const run = async <T,>(action: () => Promise<AiResult<T>>, complete: (value: T) => void) => {
    setBusy(true)
    setError('')
    setVerified(false)
    try {
      const result = await action()
      if ('issues' in result) setError(result.issues.map(({ message }) => message).join('\n'))
      else complete(result.value)
    } catch { setError(t('aiFailure')) } finally { setBusy(false) }
  }
  const change = (input: Partial<AiConnectionInput>) => {
    if (input.provider !== undefined || input.endpoint !== undefined || input.apiKey !== undefined) setModels(null)
    setDraft((current) => ({ ...current, ...input }))
    setVerified(false)
    setError('')
  }

  return (
    <>
      <p className="mt-1.5 text-xs leading-[18px] text-muted-foreground">{t('aiDescription')}</p>
      {error && <p role="alert" className="mt-3 whitespace-pre-line text-xs text-destructive">{error}</p>}
      <fieldset disabled={busy || !loaded} aria-busy={busy} className="mt-4 min-w-0 space-y-4">
        <section aria-label={t('aiConnections')} className="space-y-2">
          {state.connections.map((entry) => <div key={entry.id} className="flex items-center gap-1">
            <Button variant="outline" className="min-w-0 flex-1 justify-start" aria-pressed={draft.id === entry.id} onClick={() => { setDraft({ ...entry, apiKey: '' }); setModels(null); setVerified(false); setError('') }}>
              <span className="min-w-0 flex-1 truncate text-left">{entry.name}</span>
              {state.activeId === entry.id && <Check aria-label={t('aiActive')} />}
            </Button>
            {state.activeId !== entry.id && <Button variant="ghost" size="sm" onClick={() => void run(() => bridge.activate(entry.id), setState)}>{t('aiUse')}</Button>}
            <Button variant="ghost" size="icon-sm" aria-label={t('aiRemoveConnection', { name: entry.name })} onClick={() => void run(() => bridge.remove(entry.id), (value) => { setState(value); if (draft.id === entry.id) { setDraft(newConnection()); setModels(null) } })}><Trash2 /></Button>
          </div>)}
          <Button variant="ghost" className="justify-start" onClick={() => { setDraft(newConnection()); setModels(null); setVerified(false); setError('') }}><Plus />{t('aiNewConnection')}</Button>
        </section>
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault()
          void run(() => bridge.save(draft), (value) => {
            setState(value)
            const connection = value.connections.find((entry) => entry.id === draft.id || !state.connections.some(({ id }) => id === entry.id))
            setDraft(connection ? { ...connection, apiKey: '' } : newConnection())
          })
        }}>
          <div className="space-y-1.5"><Label htmlFor={`${id}-name`}>{t('name')}</Label><Input id={`${id}-name`} value={draft.name} maxLength={80} required onChange={(event) => change({ name: event.target.value })} /></div>
          <PreferenceSelect label={t('aiProvider')} items={Object.entries(aiProviders).map(([value, entry]) => ({ value, label: entry.name }))} value={draft.provider} disabled={busy} onChange={(value) => {
            const provider = value as AiProvider
            change({ provider, endpoint: aiProviders[provider].endpoint, model: '', apiKey: '', name: aiProviders[provider].name })
          }} />
          <div className="space-y-1.5"><Label htmlFor={`${id}-endpoint`}>{t('aiEndpoint')}</Label><Input id={`${id}-endpoint`} type="url" value={draft.endpoint} maxLength={2048} required onChange={(event) => change({ endpoint: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor={`${id}-key`}>{t('aiApiKey')}</Label><Input id={`${id}-key`} type="password" value={draft.apiKey ?? ''} maxLength={8192} autoComplete="off" placeholder={hasKey ? t('aiKeySaved') : draft.provider === 'custom' ? t('aiKeyOptional') : ''} required={draft.provider !== 'custom' && !hasKey} onChange={(event) => change({ apiKey: event.target.value })} /></div>
          <div className="space-y-1.5">
            {models ? <PreferenceSelect label={t('aiModel')} items={[...new Set([...models, ...(draft.model ? [draft.model] : [])])].map((value) => ({ value, label: value }))} value={draft.model} disabled={busy} onChange={(model) => change({ model })} />
              : <><Label htmlFor={`${id}-model`}>{t('aiModel')}</Label><Input id={`${id}-model`} value={draft.model} maxLength={256} required autoComplete="off" onChange={(event) => change({ model: event.target.value })} /></>}
            <Button type="button" variant="ghost" size="sm" onClick={() => {
              if (models) setModels(null)
              else void run(() => bridge.models(draft), (value) => { if (value.length) setModels(value); else setError(t('aiModelsUnavailable')) })
            }}>{t(models ? 'aiManualModel' : 'aiLoadModels')}</Button>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">{t('aiSaveConnection')}</Button>
            <Button type="button" variant="outline" onClick={() => void run(() => bridge.verify(draft), () => setVerified(true))}>{t('aiVerify')}</Button>
          </div>
        </form>
        {verified && <p role="status" className="text-xs text-muted-foreground">{t('aiVerified')}</p>}
      </fieldset>
    </>
  )
}
