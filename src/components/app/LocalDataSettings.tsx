import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogActions, DialogPopup, DirectoryField } from '@nesso-how/ui'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'
import type { DataLocationBridge, DataLocationState } from '../../../shared/data-location'
import { BackupSettings } from './BackupSettings'

const issueKeys = [
  'storageConfig',
  'storageUnavailable',
  'storageDestination',
  'storageNested',
  'storageOccupied',
  'storageReadonly',
  'storageSource',
  'storageSpace',
  'storageVerification',
  'storageMoveFailure',
  'storageCleanup',
  'storageBusy',
  'storageSaveFailure',
  'storageOpenFailure',
] as const

export function LocalDataSettings({ bridge }: { bridge: DataLocationBridge }) {
  const t = useTranslation()
  const [state, setState] = useState<DataLocationState>()
  const [destination, setDestination] = useState<string>()
  const [working, setWorking] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  const problem = (issues: { message: string }[]) => {
    notifications.api.notify({
      tone: 'warning',
      title: t('localData'),
      description: issues
        .map(({ message }) => t(issueKeys.find((key) => key === message) ?? 'storageMoveFailure'))
        .join(' '),
    })
  }
  const fail = useCallback(
    (message: string) => {
      notifications.api.notify({ tone: 'warning', title: t('localData'), description: message })
    },
    [t],
  )
  const inform = (message: string) => {
    notifications.api.notify({ tone: 'info', title: t('localData'), description: message })
  }
  useEffect(() => {
    let mounted = true
    void bridge
      .getState()
      .then((result) => {
        if (!mounted) return
        if ('value' in result) setState(result.value)
        else fail(t('storageUnavailable'))
      })
      .catch(() => {
        if (mounted) fail(t('storageUnavailable'))
      })
    const stop = bridge.subscribe(setState)
    return () => {
      mounted = false
      stop()
    }
  }, [bridge, fail, t])
  const choose = async (restore: boolean) => {
    if (!state) return
    setWorking(true)
    try {
      const result = restore ? await bridge.validate(state.defaultDirectory) : await bridge.choose()
      if ('issues' in result) problem(result.issues)
      else if (result.value === state.directory) inform(t('storageSame'))
      else if (result.value) setDestination(result.value)
    } catch {
      fail(t('storageMoveFailure'))
    } finally {
      setWorking(false)
    }
  }
  const move = async () => {
    if (!destination || working) return
    setWorking(true)
    try {
      const result = await bridge.move(destination)
      if ('issues' in result) problem(result.issues)
      else {
        setState(result.value)
        if (!result.value.cleanupPending) inform(t('storageMoved'))
      }
      setDestination(undefined)
    } catch {
      fail(t('storageMoveFailure'))
    } finally {
      setWorking(false)
    }
  }
  const disabled = working || state?.moving || state?.recoveryRequired
  const restoring = !!destination && destination === state?.defaultDirectory
  return (
    <section className="settings-section" aria-labelledby="settings-storage">
      <h3 id="settings-storage" className="settings-section-title">
        {t('localData')}
      </h3>
      <p className="mt-1 text-xs leading-[18px] text-muted-foreground">{t('storageDescription')}</p>
      <DirectoryField
        label={t('storageDirectory')}
        value={state?.directory}
        labels={{
          open: t('storageOpen'),
          change: t('storageChange'),
          restore: t('storageRestore'),
        }}
        disabled={!!disabled || !state}
        changeDisabled={state?.cleanupPending}
        onOpen={() => {
          void bridge
            .open()
            .then((result) => {
              if ('issues' in result) problem(result.issues)
            })
            .catch(() => fail(t('storageOpenFailure')))
        }}
        onChange={() => {
          void choose(false)
        }}
        onRestore={
          state && state.directory !== state.defaultDirectory
            ? () => {
                void choose(true)
              }
            : undefined
        }
      />
      {state?.cleanupPending && (
        <div className="mt-3 text-xs leading-[18px] text-muted-foreground">
          <p>{t('storageCleanup')}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={disabled}
            onClick={() => {
              setWorking(true)
              void bridge
                .retryCleanup()
                .then((result) => {
                  if ('issues' in result) problem(result.issues)
                  else {
                    setState(result.value)
                    inform(t('storageCleanupDone'))
                  }
                })
                .catch(() => fail(t('storageCleanup')))
                .finally(() => setWorking(false))
            }}
          >
            {t('storageRetryCleanup')}
          </Button>
        </div>
      )}
      {window.nessoBackups && (
        <BackupSettings
          bridge={window.nessoBackups}
          disabled={!!disabled || !state || state.cleanupPending}
        />
      )}
      <Dialog.Root
        open={!!destination && !state?.moving}
        onOpenChange={(open) => {
          if (!open && !working) setDestination(undefined)
        }}
      >
        <DialogPopup initialFocus={cancel}>
          <Dialog.Title className="text-sm font-medium">
            {t(restoring ? 'storageRestoreTitle' : 'storageMoveTitle')}
          </Dialog.Title>
          {(() => {
            const marker = '\0'
            const [before, after = ''] = t(
              restoring ? 'storageRestoreConfirm' : 'storageMoveConfirm',
              { path: marker },
            ).split(marker)
            return (
              <p className="mt-5 break-all text-xs leading-[18px] text-muted-foreground">
                {before}
                <code className="inline-code">{destination}</code>
                {after}
              </p>
            )
          })()}
          {!restoring && (
            <p className="mt-2 text-xs leading-[18px] text-muted-foreground">{t('storageCloud')}</p>
          )}
          <DialogActions>
            <Button
              ref={cancel}
              variant="outline"
              disabled={working}
              onClick={() => setDestination(undefined)}
            >
              {t('cancel')}
            </Button>
            <Button
              disabled={working}
              onClick={() => {
                void move()
              }}
            >
              {t('storageMove')}
            </Button>
          </DialogActions>
        </DialogPopup>
      </Dialog.Root>
    </section>
  )
}

export function DataTransferDialog({ bridge }: { bridge: DataLocationBridge }) {
  const t = useTranslation()
  const [state, setState] = useState<DataLocationState>()
  useEffect(() => bridge.subscribe(setState), [bridge])
  const backup = state?.activity
  return (
    <Dialog.Root open={!!state?.moving || !!state?.recoveryRequired} onOpenChange={() => {}}>
      <DialogPopup data-data-transfer>
        <Dialog.Title className="text-sm font-medium">
          {t(
            state?.recoveryRequired
              ? 'backupRecoveryTitle'
              : backup === 'backup'
                ? 'backupCreating'
                : backup === 'restore'
                  ? 'backupRestoring'
                  : 'storageMoving',
          )}
        </Dialog.Title>
        <Dialog.Description className="mt-2 text-xs leading-[18px] text-muted-foreground">
          {t(
            state?.recoveryRequired
              ? 'backupRecoveryRequired'
              : backup
                ? 'backupWorkingDescription'
                : 'storageMovingDescription',
          )}
        </Dialog.Description>
        {!state?.recoveryRequired && (
          <p role="status" className="mt-5 text-xs text-muted-foreground">
            {t(backup ? 'backupVerifying' : 'storageVerifying')}
          </p>
        )}
      </DialogPopup>
    </Dialog.Root>
  )
}
