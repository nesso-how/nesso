import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Autocomplete, AutocompleteClear, AutocompleteItem, AutocompletePopup, Button, ConfirmDialog, Field, FieldHint, IconButton, Input, Label, ListRow, ListRowButton, ListRowDetail, ListRowTitle, PreferenceSelect, RevealActions } from '@nesso/ui'
import { ArrowLeft, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { aiProviders, type AiConnectionInput, type AiConnections, type AiProvider, type AiResult } from '@nesso/ai/providers'
import type { AiBridge } from '../../../electron/ai-bridge'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'

const newConnection = (): AiConnectionInput => ({ name: 'OpenAI', provider: 'openai', endpoint: aiProviders.openai.endpoint, model: '', apiKey: '' })

export function AiSettings({ bridge, onEditorChange }: { bridge: AiBridge; onEditorChange?: (open: boolean) => void }) {
  const t = useTranslation()
  const id = useId()
  const [state, setState] = useState<AiConnections>({ connections: [], activeId: null })
  const [draft, setDraft] = useState(newConnection)
  const [editorOpen, setEditorOpen] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [models, setModels] = useState<readonly string[] | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState('')
  const modelsRequest = useRef(0)
  const modelsPending = useRef(false)
  const modelInput = useRef<HTMLInputElement>(null)
  const [modelOpen, setModelOpen] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const modelQuery = draft.model.trim().toLowerCase()
  const modelOptions = (models ?? []).filter((model) => model.toLowerCase().includes(modelQuery) && model.toLowerCase() !== modelQuery)
  const saved = state.connections.find((entry) => entry.id === draft.id)
  const hasKey = saved?.hasKey && saved.provider === draft.provider && saved.endpoint === draft.endpoint.replace(/\/+$/, '')
  const loadFailedMessage = t('aiLoadFailed')
  const fail = useCallback((title: string, details: string) => {
    notifications.api.notify({ tone: 'warning', title, description: details && details !== title ? details : undefined })
  }, [])

  useEffect(() => {
    heading.current?.focus()
    heading.current?.closest('.settings-content')?.scrollTo({ top: 0 })
  }, [editorOpen])

  useEffect(() => { onEditorChange?.(editorOpen) }, [editorOpen, onEditorChange])

  useEffect(() => () => { modelsRequest.current += 1 }, [])

  useEffect(() => {
    let mounted = true
    void bridge.list().then((result) => {
      if (!mounted) return
      if ('issues' in result) fail(loadFailedMessage, result.issues.map(({ message }) => message).join('\n'))
      else { setState(result.value); setLoaded(true) }
    }).catch(() => { if (mounted) fail(loadFailedMessage, '') }).finally(() => { if (mounted) setBusy(false) })
    return () => { mounted = false }
  }, [bridge, fail, loadFailedMessage])

  const run = async <T,>(action: () => Promise<AiResult<T>>, complete: (value: T) => void, failureTitle: string) => {
    setBusy(true)
    try {
      const result = await action()
      if ('issues' in result) fail(failureTitle, result.issues.map(({ message }) => message).join('\n'))
      else complete(result.value)
    } catch { fail(failureTitle, '') } finally { setBusy(false) }
  }
  const clearModels = () => {
    modelsRequest.current += 1
    modelsPending.current = false
    setModels(null)
    setLoadingModels(false)
    setModelError('')
    setModelOpen(false)
  }
  const loadModels = async () => {
    if (busy || !loaded || modelsPending.current || models !== null || (draft.provider !== 'custom' && !draft.apiKey?.trim() && !hasKey)) return
    try {
      if (!['http:', 'https:'].includes(new URL(draft.endpoint).protocol)) return
    } catch { return }
    const request = ++modelsRequest.current
    modelsPending.current = true
    setLoadingModels(true)
    setModelError('')
    try {
      const result = await bridge.models(draft)
      if (request !== modelsRequest.current) return
      if ('issues' in result) setModelError(t('aiModelsLoadFailure'))
      else {
        setModels(result.value)
        if (!result.value.length) setModelError(t('aiModelsUnavailable'))
        if (document.activeElement === modelInput.current) setModelOpen(true)
      }
    } catch {
      if (request === modelsRequest.current) setModelError(t('aiModelsLoadFailure'))
    } finally {
      if (request === modelsRequest.current) {
        modelsPending.current = false
        setLoadingModels(false)
      }
    }
  }
  const change = (input: Partial<AiConnectionInput>) => {
    if (input.provider !== undefined || input.endpoint !== undefined || input.apiKey !== undefined) clearModels()
    if (input.provider !== undefined || input.endpoint !== undefined || input.apiKey === '') setShowKey(false)
    setDraft((current) => ({ ...current, ...input }))
  }
  const setEditor = (input: AiConnectionInput | null) => {
    setDraft(input ?? newConnection())
    clearModels()
    setShowKey(false)
    setEditorOpen(input !== null)
  }

  return (
    <>
      {editorOpen && <Button variant="ghost" size="sm" className="ai-back" disabled={busy} onClick={() => setEditor(null)}><ArrowLeft />{t('aiBackToConnections')}</Button>}
      <h2 ref={heading} tabIndex={-1} id={`${id}-editor`} className="settings-page-title ai-page-title outline-none">{editorOpen ? draft.id ? saved?.name ?? t('aiConnectionDetails') : t('aiNewConnection') : t('aiSettingsTitle')}</h2>
      <p className="settings-page-description">{t(editorOpen ? draft.id ? 'aiEditConnectionDescription' : 'aiNewConnectionDescription' : 'aiDescription')}</p>
      {!loaded && busy && <p role="status" className="ai-loading">{t('aiSettingsLoading')}</p>}
      <fieldset disabled={busy || !loaded} aria-busy={busy} className="ai-settings">
        {!editorOpen && <section aria-labelledby={`${id}-connections`} className="ai-connections">
          <div className="ai-section-heading">
            <h3 id={`${id}-connections`}>{t('aiConnections')}</h3>
            <Button variant="ghost" size="sm" className="ai-new-connection" onClick={() => setEditor(newConnection())}><Plus />{t('aiNewConnection')}</Button>
          </div>
          {loaded && state.connections.length === 0 && <p className="ai-connections-empty">{t('aiConnectionsEmpty')}</p>}
          {state.connections.length > 0 && <div role="radiogroup" aria-labelledby={`${id}-connections`} className="space-y-0.5">
          {state.connections.map((entry) => {
            const active = state.activeId === entry.id
            return <ListRow key={entry.id} className={active ? 'bg-accent' : ''}>
            <ListRowButton
              role="radio"
              aria-checked={active}
              aria-label={t(active ? 'aiActiveConnection' : 'aiUseConnection', { name: entry.name })}
              onClick={() => { if (!active) void run(() => bridge.activate(entry.id), setState, t('aiActivateFailed')) }}
              className="flex items-center gap-2.5"
            >
              <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-full border${active ? ' border-foreground' : ' border-muted-foreground'}`}>{active && <span className="size-1.5 rounded-full bg-foreground" />}</span>
              <span className="min-w-0">
                <ListRowTitle active={active}>{entry.name}</ListRowTitle>
                <ListRowDetail>{aiProviders[entry.provider].name} · {entry.model}</ListRowDetail>
              </span>
            </ListRowButton>
            <RevealActions className="mr-1">
              <IconButton aria-label={t('aiEditConnection', { name: entry.name })} title={t('aiEditConnection', { name: entry.name })} onClick={() => setEditor({ ...entry, apiKey: '' })}><Pencil /></IconButton>
              <IconButton aria-label={t('aiDeleteConnection', { name: entry.name })} title={t('aiDeleteConnection', { name: entry.name })} onClick={() => setPendingDelete({ id: entry.id, name: entry.name })}><Trash2 /></IconButton>
            </RevealActions>
          </ListRow>})}
          </div>}
        </section>}
        {editorOpen && <form className="ai-connection-form" aria-labelledby={`${id}-editor`} onSubmit={(event) => {
          event.preventDefault()
          void run(() => bridge.save(draft), (value) => {
            setState(value)
            setEditor(null)
          }, t('aiSaveFailed'))
        }}>
          <PreferenceSelect label={t('aiProvider')} items={Object.entries(aiProviders).map(([value, entry]) => ({ value, label: entry.name }))} value={draft.provider} disabled={busy} onChange={(value) => {
            const provider = value as AiProvider
            change({ provider, endpoint: aiProviders[provider].endpoint, model: '', apiKey: '', name: aiProviders[provider].name })
          }} />
          <Field><Label htmlFor={`${id}-name`}>{t('name')}</Label><Input id={`${id}-name`} value={draft.name} maxLength={80} required onChange={(event) => change({ name: event.target.value })} /></Field>
          <Field><Label htmlFor={`${id}-endpoint`}>{t('aiEndpoint')}</Label><Input id={`${id}-endpoint`} type="url" value={draft.endpoint} maxLength={2048} required onChange={(event) => change({ endpoint: event.target.value })} /></Field>
          <Field className="ai-key-field">
            <Label htmlFor={`${id}-key`}>{t('aiApiKey')}</Label>
            <div>
              <div className="relative">
                <Input id={`${id}-key`} type={showKey ? 'text' : 'password'} className="pr-7" value={draft.apiKey ?? ''} maxLength={8192} autoComplete="off" aria-describedby={hasKey ? `${id}-key-hint` : undefined} placeholder={hasKey ? '••••••••' : draft.provider === 'custom' ? t('aiKeyOptional') : ''} required={draft.provider !== 'custom' && !hasKey} onChange={(event) => change({ apiKey: event.target.value })} />
                <IconButton type="button" className="ai-key-visibility size-5" disabled={!draft.apiKey} aria-label={t(showKey ? 'aiHideKey' : 'aiShowKey')} aria-pressed={showKey} aria-controls={`${id}-key`} onClick={() => setShowKey((visible) => !visible)}>{showKey ? <EyeOff /> : <Eye />}</IconButton>
              </div>
              {hasKey && <FieldHint id={`${id}-key-hint`}>{t('aiKeySaved')}</FieldHint>}
            </div>
          </Field>
          <div className="ai-model-field">
            <Field>
              <Label id={`${id}-model-label`} htmlFor={`${id}-model`}>{t('aiModel')}</Label>
              <div>
                <Autocomplete.Root items={models ?? []} filteredItems={modelOptions} value={draft.model} onValueChange={(model, details) => {
                  change({ model })
                  if (details.reason === 'clear-press') {
                    setModelOpen(true)
                    void loadModels()
                  }
                }} open={modelOpen && modelOptions.length > 0} onOpenChange={setModelOpen} disabled={busy || !loaded} openOnInputClick>
                  <div className="relative">
                    <Autocomplete.Input ref={modelInput} id={`${id}-model`} aria-labelledby={`${id}-model-label`} aria-describedby={`${id}-model-status`} aria-busy={loadingModels} maxLength={256} required autoComplete="off" onFocus={() => void loadModels()} render={<Input className="pr-7" />} />
                    <AutocompleteClear aria-label={t('aiClearModel')} />
                  </div>
                  <AutocompletePopup className="nesso-field-popup">
                    <Autocomplete.List>{(model: string) => <AutocompleteItem key={model} value={model}>{model}</AutocompleteItem>}</Autocomplete.List>
                  </AutocompletePopup>
                </Autocomplete.Root>
                <FieldHint id={`${id}-model-status`} role="status">{loadingModels ? t('aiModelsLoading') : modelError || ' '}</FieldHint>
              </div>
            </Field>
          </div>
          <div className="ai-editor-actions">
            <Button type="submit">{t('aiSaveConnection')}</Button>
            <Button type="button" variant="outline" onClick={() => void run(() => bridge.verify(draft), () => notifications.api.notify({ tone: 'info', title: t('aiVerified') }), t('aiVerifyFailed'))}>{t('aiVerify')}</Button>
          </div>
        </form>}
        {!editorOpen && busy && loaded && <p role="status" className="ai-loading">{t('aiSettingsWorking')}</p>}
      </fieldset>
      <ConfirmDialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null) }} title={t('aiDeleteTitle', { name: pendingDelete?.name ?? '' })} description={t('aiDeleteDescription')} cancelLabel={t('cancel')} confirmLabel={t('aiDelete')} onConfirm={() => {
        const target = pendingDelete
        setPendingDelete(null)
        if (target) void run(() => bridge.remove(target.id), setState, t('aiRemoveFailed'))
      }} />
    </>
  )
}
