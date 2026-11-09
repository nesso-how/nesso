import { useEffect, useRef, useState } from 'react'
import { Button, ConfirmDialog, DirectoryField } from '@nesso-how/ui'
import { Download, RotateCcw } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useNessoStore } from '@/store'
import { notifications } from '@/notifications'
import type { AutomaticBackupState, BackupBridge, BackupCandidate } from '../../../shared/backup'

const issueKeys = [
  'backupInvalid',
  'backupUnsupported',
  'backupTooLarge',
  'backupFailed',
  'backupRestoreFailed',
  'backupRecoveryRequired',
  'backupDestination',
  'storageBusy',
  'storageSaveFailure',
] as const

export function BackupSettings({ bridge, disabled }: { bridge: BackupBridge; disabled: boolean }) {
  const t = useTranslation()
  const locale = useNessoStore((state) => state.preferences.locale)
  const [candidate, setCandidate] = useState<BackupCandidate>()
  const [automatic, setAutomatic] = useState<AutomaticBackupState>()
  const [working, setWorking] = useState(false)
  const active = useRef(false)
  const mounted = useRef(true)
  const format = (date: string, dateStyle: 'medium' | 'long') =>
    new Intl.DateTimeFormat(locale, { dateStyle, timeStyle: 'short' }).format(new Date(date))
  useEffect(() => {
    mounted.current = true
    void bridge
      .automaticState()
      .then((result) => {
        if (mounted.current && 'value' in result) setAutomatic(result.value)
      })
      .catch(() => {})
    return () => {
      mounted.current = false
      bridge.cancel()
    }
  }, [bridge])
  const problem = (issues: { message: string }[]) => {
    notifications.api.notify({
      tone: 'warning',
      title: t('backup'),
      description: issues
        .map(({ message }) => t(issueKeys.find((key) => key === message) ?? 'backupFailed'))
        .join(' '),
    })
  }
  const run = async (
    operation:
      | 'create'
      | 'choose'
      | 'restore'
      | 'chooseDirectory'
      | 'useDefaultDirectory'
      | 'openDirectory',
  ) => {
    if (active.current || disabled || (operation === 'restore' && !candidate)) return
    active.current = true
    setWorking(true)
    try {
      const result = await (operation === 'restore'
        ? bridge.restore(candidate!.id)
        : bridge[operation]())
      if (!mounted.current) {
        bridge.cancel()
        return
      }
      if ('issues' in result) problem(result.issues)
      else if (result.value === true)
        notifications.api.notify({ tone: 'info', title: t('backupCreated') })
      else if (result.value) {
        if ('directory' in result.value) setAutomatic(result.value)
        else setCandidate(result.value)
      }
      if (operation === 'restore') setCandidate(undefined)
    } catch {
      problem([{ message: operation === 'restore' ? 'backupRestoreFailed' : 'backupFailed' }])
      setCandidate(undefined)
    } finally {
      active.current = false
      if (mounted.current) setWorking(false)
    }
  }
  const dismiss = () => {
    if (!active.current) {
      bridge.cancel()
      setCandidate(undefined)
    }
  }
  const backupError = automatic?.configurationFailed
    ? 'automaticBackupConfig'
    : automatic?.failed
      ? 'automaticBackupFailed'
      : undefined
  return (
    <div className="mt-5 border-t border-border pt-5">
      <h4 className="text-xs font-medium">{t('backup')}</h4>
      <p className="mt-1 text-xs leading-[18px] text-muted-foreground">{t('backupDescription')}</p>
      {automatic && (
        <>
          <DirectoryField
            label={t('automaticBackupDirectory')}
            value={automatic.directory}
            labels={{
              open: t('storageOpen'),
              change: t('storageChange'),
              restore: t('storageRestore'),
            }}
            disabled={disabled || working}
            onOpen={() => {
              void run('openDirectory')
            }}
            onChange={() => {
              void run('chooseDirectory')
            }}
            onRestore={
              automatic.directory !== automatic.defaultDirectory || automatic.configurationFailed
                ? () => {
                    void run('useDefaultDirectory')
                  }
                : undefined
            }
          />
          <p
            role={backupError ? 'alert' : 'status'}
            className={`mt-2 text-xs leading-[18px] ${backupError ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {backupError
              ? t(backupError)
              : automatic.lastBackup &&
                t('automaticBackupLast', {
                  date: format(automatic.lastBackup, 'medium'),
                })}
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={disabled || working}
          onClick={() => {
            void run('create')
          }}
        >
          <Download />
          {t('backupCreate')}
        </Button>
        <Button
          variant="outline"
          disabled={disabled || working}
          onClick={() => {
            void run('choose')
          }}
        >
          <RotateCcw />
          {t('backupRestore')}
        </Button>
      </div>
      <ConfirmDialog
        open={!!candidate}
        onOpenChange={(open) => {
          if (!open) dismiss()
        }}
        title={t('backupRestoreTitle')}
        description={t('backupRestoreConfirm')}
        cancelLabel={t('cancel')}
        confirmLabel={t(working ? 'backupRestoring' : 'backupRestoreAction')}
        disabled={disabled || working}
        onConfirm={() => {
          void run('restore')
        }}
      >
        {candidate && (
          <p className="mt-2 text-xs text-muted-foreground">
            {format(candidate.createdAt, 'long')}
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}
