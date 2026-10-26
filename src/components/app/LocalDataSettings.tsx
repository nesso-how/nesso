import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogActions, DialogPopup, Input } from '@nesso-how/ui'
import { ArrowUpRight, Folder, RotateCcw } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'
import type { DataLocationBridge, DataLocationState } from '../../../shared/data-location'

const issueKeys = ['storageConfig', 'storageUnavailable', 'storageDestination', 'storageNested', 'storageOccupied',
  'storageReadonly', 'storageSource', 'storageSpace', 'storageVerification', 'storageMoveFailure', 'storageCleanup',
  'storageBusy', 'storageSaveFailure', 'storageOpenFailure'] as const

export function LocalDataSettings({ bridge }: { bridge: DataLocationBridge }) {
  const t = useTranslation()
  const [state, setState] = useState<DataLocationState>()
  const [destination, setDestination] = useState<string>()
  const [working, setWorking] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  const problem = (issues: { message: string }[]) => {
    notifications.api.notify({ tone: 'warning', title: t('localData'), description: issues.map(({ message }) => t(issueKeys.find((key) => key === message) ?? 'storageMoveFailure')).join(' ') })
  }
  const fail = useCallback((message: string) => {
    notifications.api.notify({ tone: 'warning', title: t('localData'), description: message })
  }, [t])
  const inform = (message: string) => {
    notifications.api.notify({ tone: 'info', title: t('localData'), description: message })
  }
  useEffect(() => {
    let mounted = true
    void bridge.getState().then((result) => {
      if (!mounted) return
      if ('value' in result) setState(result.value)
      else fail(t('storageUnavailable'))
    }).catch(() => { if (mounted) fail(t('storageUnavailable')) })
    const stop = bridge.subscribe(setState)
    return () => { mounted = false; stop() }
  }, [bridge, fail, t])
  const choose = async (restore: boolean) => {
    if (!state) return
    setWorking(true)
    try {
      const result = restore ? await bridge.validate(state.defaultDirectory) : await bridge.choose()
      if ('issues' in result) problem(result.issues)
      else if (result.value === state.directory) inform(t('storageSame'))
      else if (result.value) setDestination(result.value)
    } catch { fail(t('storageMoveFailure')) } finally { setWorking(false) }
  }
  const move = async () => {
    if (!destination || working) return
    setWorking(true)
    try {
      const result = await bridge.move(destination)
      if ('issues' in result) problem(result.issues)
      else { setState(result.value); if (!result.value.cleanupPending) inform(t('storageMoved')) }
      setDestination(undefined)
    } catch { fail(t('storageMoveFailure')) } finally { setWorking(false) }
  }
  const disabled = working || state?.moving
  const restoring = !!destination && destination === state?.defaultDirectory
  return <section className="settings-section" aria-labelledby="settings-storage">
    <div className="flex items-center justify-between gap-3">
      <h3 id="settings-storage" className="settings-section-title">{t('localData')}</h3>
      {state && <span className="settings-badge">{t(state.directory === state.defaultDirectory ? 'storageDefault' : 'storageCustom')}</span>}
    </div>
    <p className="mt-1 text-xs leading-[18px] text-muted-foreground">{t('storageDescription')}</p>
    <label htmlFor="data-directory" className="mt-4 block text-xs">{t('storageDirectory')}</label>
    <div className="mt-2 flex items-center gap-2">
      <div className="relative min-w-0 flex-1"><Folder className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="data-directory" className="pl-8 font-mono text-xs" readOnly value={state?.directory ?? ''} title={state?.directory} /></div>
      <Button variant="outline" disabled={disabled || !state || state.cleanupPending} onClick={() => { void choose(false) }}>{t('storageChange')}</Button>
    </div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" disabled={disabled || !state} onClick={() => { void bridge.open().then((result) => { if ('issues' in result) problem(result.issues) }).catch(() => fail(t('storageOpenFailure'))) }}><ArrowUpRight />{t('storageOpen')}</Button>
      {state && state.directory !== state.defaultDirectory && <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={disabled || state.cleanupPending} onClick={() => { void choose(true) }}><RotateCcw />{t('storageRestore')}</Button>}
    </div>
    {state?.cleanupPending && <div className="mt-3 text-xs leading-[18px] text-muted-foreground"><p>{t('storageCleanup')}</p><Button variant="outline" size="sm" className="mt-2" disabled={disabled} onClick={() => {
      setWorking(true)
      void bridge.retryCleanup().then((result) => {
        if ('issues' in result) problem(result.issues)
        else { setState(result.value); inform(t('storageCleanupDone')) }
      }).catch(() => fail(t('storageCleanup'))).finally(() => setWorking(false))
    }}>{t('storageRetryCleanup')}</Button></div>}
    <Dialog.Root open={!!destination && !state?.moving} onOpenChange={(open) => { if (!open && !working) setDestination(undefined) }}>
      <DialogPopup initialFocus={cancel}>
        <Dialog.Title className="text-sm font-medium">{t(restoring ? 'storageRestoreTitle' : 'storageMoveTitle')}</Dialog.Title>
        {(() => {
          const marker = '\0'
          const [before, after = ''] = t(restoring ? 'storageRestoreConfirm' : 'storageMoveConfirm', { path: marker }).split(marker)
          return <p className="mt-5 break-all text-xs leading-[18px] text-muted-foreground">{before}<code className="inline-code">{destination}</code>{after}</p>
        })()}
        {!restoring && <p className="mt-2 text-xs leading-[18px] text-muted-foreground">{t('storageCloud')}</p>}
        <DialogActions><Button ref={cancel} variant="outline" disabled={working} onClick={() => setDestination(undefined)}>{t('cancel')}</Button><Button disabled={working} onClick={() => { void move() }}>{t('storageMove')}</Button></DialogActions>
      </DialogPopup>
    </Dialog.Root>
  </section>
}

export function DataTransferDialog({ bridge }: { bridge: DataLocationBridge }) {
  const t = useTranslation()
  const [moving, setMoving] = useState(false)
  useEffect(() => bridge.subscribe((state) => setMoving(state.moving)), [bridge])
  return <Dialog.Root open={moving} onOpenChange={() => { }}>
    <DialogPopup data-data-transfer>
      <Dialog.Title className="text-sm font-medium">{t('storageMoving')}</Dialog.Title>
      <Dialog.Description className="mt-2 text-xs leading-[18px] text-muted-foreground">{t('storageMovingDescription')}</Dialog.Description>
      <p role="status" className="mt-5 text-xs text-muted-foreground">{t('storageVerifying')}</p>
    </DialogPopup>
  </Dialog.Root>
}
