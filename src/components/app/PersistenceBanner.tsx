import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Dialog, DialogActions, DialogPopup } from '@nesso-how/ui'
import { ChevronRight } from 'lucide-react'
import { useNessoStore, type startAutosave } from '@/store'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'
import { persistenceSections, type PersistenceSection } from '../../../shared/persistence'

const labels = { document: 'persistenceDocument', preferences: 'persistencePreferences', conversation: 'persistenceConversation', 'plugin-storage': 'persistencePluginStorage' } as const
const failureLabels = { document: 'persistenceFailureDocument', preferences: 'persistenceFailurePreferences', conversation: 'persistenceFailureConversation', 'plugin-storage': 'persistenceFailurePluginStorage' } as const
const replaceTitles = { document: 'persistenceReplaceTitleDocument', preferences: 'persistenceReplaceTitlePreferences', conversation: 'persistenceReplaceTitleConversation', 'plugin-storage': 'persistenceReplaceTitlePluginStorage' } as const

export function PersistenceBanner({ persistence }: { persistence: ReturnType<typeof startAutosave> }) {
  const t = useTranslation()
  const issues = useNessoStore((state) => state.persistenceIssues)
  const [dialog, setDialog] = useState<PersistenceSection | 'close'>()
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  const close = useRef<(approved: boolean) => void>(undefined)
  const affected = persistenceSections.filter((section) => issues.some((issue) => issue.section === section))
  const problems = affected.flatMap((section) => (['read', 'write'] as const)
    .filter((operation) => issues.some((issue) => issue.section === section && issue.operation === operation))
    .map((operation) => t(operation === 'read' ? 'readFailure' : 'saveFailure', { data: t(failureLabels[section]) })))

  useEffect(() => {
    const stop = window.nessoPersistence?.beforeClose(persistence.save, () => new Promise<boolean>((resolve) => {
      close.current = resolve
      setFailed(false)
      setDialog('close')
    }))
    return () => { stop?.(); close.current?.(false); close.current = undefined }
  }, [persistence])

  const finish = (approved = false) => {
    close.current?.(approved)
    close.current = undefined
    setDialog(undefined)
    setFailed(false)
  }
  const recover = async (section: PersistenceSection) => {
    setWorking(true)
    setFailed(false)
    try {
      if (await persistence.recover(section)) {
        finish()
        notifications.api.notify({ tone: 'info', title: t('persistenceRecovered', { data: t(labels[section]) }) })
      } else setFailed(true)
    } catch { setFailed(true) } finally { setWorking(false) }
  }

  return <>
    {issues.length > 0 && <Banner tone="warning" className="shrink-0 rounded-none border-x-0 border-b-0 p-0">
      <details className="group">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-sm px-3 py-2 leading-4 hover:bg-accent active:bg-pressed [&::-webkit-details-marker]:hidden [@media(pointer:coarse)]:min-h-11">
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-(--duration-state) group-open:rotate-90" />
          <span>{problems.join(' ')}</span>
        </summary>
        <div className="px-3 pb-3">
          <p className="font-mono text-[10px] text-muted-foreground">{t('technicalDetails')}</p>
          <ul className="mt-1 list-inside list-disc break-words text-muted-foreground">
            {issues.map(({ path, message, operation }, index) => <li key={index}>{t(operation === 'read' ? 'persistenceRead' : 'persistenceWrite')} · {path}: {message}</li>)}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] leading-4">
            <a href="https://github.com/nesso-how/nesso/discussions" target="_blank" rel="noreferrer" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">{t('getHelp')}</a>
            {affected.map((section) => {
              const unreadable = issues.some((issue) => issue.section === section && issue.operation === 'read')
              return <button key={section} type="button" disabled={working} onClick={() => {
                setFailed(false)
                if (unreadable) setDialog(section)
                else void recover(section)
              }} className="text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-50">{unreadable ? t('persistenceReplace') : t('persistenceRetry')}</button>
            })}
          </div>
          {failed && <p role="alert" className="mt-2 text-xs">{t('persistenceRecoveryFailed')}</p>}
        </div>
      </details>
    </Banner>}
    <Dialog.Root open={!!dialog} onOpenChange={(open) => { if (!open && !working) finish() }}>
      <DialogPopup initialFocus={cancel}>
        <Dialog.Title className="text-sm font-medium">{dialog === 'close' ? t('persistenceCloseTitle') : dialog ? t(replaceTitles[dialog]) : ''}</Dialog.Title>
        <Dialog.Description className="mt-2 text-xs leading-[18px] text-muted-foreground">{t(dialog === 'close' ? 'persistenceCloseDescription' : 'persistenceReplaceDescription')}</Dialog.Description>
        {dialog === 'document' && <p className="mt-3 text-xs leading-[18px] text-muted-foreground">{t('persistenceReplaceDocumentWarning')}</p>}
        {failed && <p role="alert" className="mt-3 text-xs">{t('persistenceRecoveryFailed')}</p>}
        <DialogActions>
          <Button ref={cancel} variant="outline" disabled={working} onClick={() => finish()}>{t(dialog === 'close' ? 'persistenceKeepOpen' : 'cancel')}</Button>
          <Button disabled={working} onClick={() => {
            if (dialog === 'close') finish(true)
            else if (dialog) void recover(dialog)
          }}>{t(dialog === 'close' ? 'persistenceCloseWithoutSaving' : 'persistenceReplaceConfirm')}</Button>
        </DialogActions>
      </DialogPopup>
    </Dialog.Root>
  </>
}
