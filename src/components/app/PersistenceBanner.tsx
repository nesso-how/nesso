import { useEffect, useRef, useState } from 'react'
import {
  Banner,
  BannerDetails,
  BannerRow,
  Button,
  Dialog,
  DialogActions,
  DialogPopup,
} from '@nesso-how/ui'
import { useNessoStore, type startAutosave } from '@/store'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'
import { persistenceSections, type PersistenceSection } from '../../../shared/persistence'

const labels = {
  document: 'persistenceDocument',
  preferences: 'persistencePreferences',
  conversation: 'persistenceConversation',
  'plugin-storage': 'persistencePluginStorage',
} as const
const failureLabels = {
  document: 'persistenceFailureDocument',
  preferences: 'persistenceFailurePreferences',
  conversation: 'persistenceFailureConversation',
  'plugin-storage': 'persistenceFailurePluginStorage',
} as const
const replaceTitles = {
  document: 'persistenceReplaceTitleDocument',
  preferences: 'persistenceReplaceTitlePreferences',
  conversation: 'persistenceReplaceTitleConversation',
  'plugin-storage': 'persistenceReplaceTitlePluginStorage',
} as const

export function PersistenceBanner({
  persistence,
}: {
  persistence: ReturnType<typeof startAutosave>
}) {
  const t = useTranslation()
  const issues = useNessoStore((state) => state.persistenceIssues)
  const [dialog, setDialog] = useState<PersistenceSection | 'close' | 'update'>()
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  const close = useRef<(approved: boolean) => void>(undefined)
  const affected = persistenceSections.filter((section) =>
    issues.some((issue) => issue.section === section),
  )
  const problems = affected.flatMap((section) =>
    (['read', 'write'] as const)
      .filter((operation) =>
        issues.some((issue) => issue.section === section && issue.operation === operation),
      )
      .map((operation) =>
        t(operation === 'read' ? 'readFailure' : 'saveFailure', {
          data: t(failureLabels[section]),
        }),
      ),
  )

  useEffect(() => {
    const confirm = (kind: 'close' | 'update') => () =>
      new Promise<boolean>((resolve) => {
        close.current?.(false)
        close.current = resolve
        setFailed(false)
        setDialog(kind)
      })
    const stop = window.nessoPersistence?.beforeClose(persistence.save, confirm('close'))
    const stopUpdate = window.nessoUpdater?.beforeInstall(persistence.save, confirm('update'))
    return () => {
      stop?.()
      stopUpdate?.()
      close.current?.(false)
      close.current = undefined
    }
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
        notifications.api.notify({
          tone: 'info',
          title: t('persistenceRecovered', { data: t(labels[section]) }),
        })
      } else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      {issues.length > 0 && (
        <Banner tone="warning" className="shrink-0 rounded-none border-x-0 border-b-0">
          <BannerRow
            message={problems.join(' ')}
            actions={affected.map((section) => {
              const unreadable = issues.some(
                (issue) => issue.section === section && issue.operation === 'read',
              )
              return (
                <Button
                  key={section}
                  variant="outline"
                  size="sm"
                  disabled={working}
                  onClick={() => {
                    setFailed(false)
                    if (unreadable) setDialog(section)
                    else void recover(section)
                  }}
                >
                  {unreadable ? t('persistenceReplace') : t('persistenceRetry')}
                </Button>
              )
            })}
          />
          <BannerDetails label={t('technicalDetails')}>
            <ul className="list-inside list-disc break-words font-mono text-[10px] text-muted-foreground">
              {issues.map(({ path, message, operation }, index) => (
                <li key={index}>
                  {t(operation === 'read' ? 'persistenceRead' : 'persistenceWrite')} · {path}:{' '}
                  {message}
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[11px] leading-4">
              <a
                href="https://github.com/nesso-how/nesso/discussions"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {t('getHelp')}
              </a>
            </div>
            {failed && (
              <p role="alert" className="mt-2 text-xs">
                {t('persistenceRecoveryFailed')}
              </p>
            )}
          </BannerDetails>
        </Banner>
      )}
      <Dialog.Root
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !working) finish()
        }}
      >
        <DialogPopup initialFocus={cancel}>
          <Dialog.Title className="text-sm font-medium">
            {dialog === 'close' || dialog === 'update'
              ? t('persistenceCloseTitle')
              : dialog
                ? t(replaceTitles[dialog])
                : ''}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-[18px] text-muted-foreground">
            {t(
              dialog === 'close'
                ? 'persistenceCloseDescription'
                : dialog === 'update'
                  ? 'persistenceUpdateDescription'
                  : 'persistenceReplaceDescription',
            )}
          </Dialog.Description>
          {dialog === 'document' && (
            <p className="mt-3 text-xs leading-[18px] text-muted-foreground">
              {t('persistenceReplaceDocumentWarning')}
            </p>
          )}
          {failed && (
            <p role="alert" className="mt-3 text-xs">
              {t('persistenceRecoveryFailed')}
            </p>
          )}
          <DialogActions>
            <Button ref={cancel} variant="outline" disabled={working} onClick={() => finish()}>
              {t(dialog === 'close' ? 'persistenceKeepOpen' : 'cancel')}
            </Button>
            <Button
              disabled={working}
              onClick={() => {
                if (dialog === 'close' || dialog === 'update') finish(true)
                else if (dialog) void recover(dialog)
              }}
            >
              {t(
                dialog === 'close'
                  ? 'persistenceCloseWithoutSaving'
                  : dialog === 'update'
                    ? 'persistenceUpdateAnyway'
                    : 'persistenceReplaceConfirm',
              )}
            </Button>
          </DialogActions>
        </DialogPopup>
      </Dialog.Root>
    </>
  )
}
