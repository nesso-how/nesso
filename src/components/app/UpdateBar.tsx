import { useEffect, useId, useState } from 'react'
import { Button } from '@nesso-how/ui'
import { CircleAlert, Download, ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react'
import type { UpdateBridge, UpdateState } from '../../../electron/updates'
import { useTranslation } from '@/i18n'
import { releasesUrl } from '../../../shared/link-policy.ts'

const presentations = {
  ready: {
    message: 'updateReady',
    action: 'updateAction',
    hint: 'updateReadyDescription',
    busy: false,
    Icon: Download,
    ActionIcon: RefreshCw,
  },
  saving: {
    message: 'updateReady',
    action: 'updateSaving',
    hint: null,
    busy: true,
    Icon: Download,
    ActionIcon: LoaderCircle,
  },
  installing: {
    message: 'updateReady',
    action: 'updateRestarting',
    hint: null,
    busy: true,
    Icon: Download,
    ActionIcon: LoaderCircle,
  },
  download: {
    message: 'updateDownloadFailure',
    action: 'updateDownloadManually',
    hint: 'updateDownloadFailureDescription',
    busy: false,
    Icon: CircleAlert,
    ActionIcon: ExternalLink,
  },
  save: {
    message: 'updateSaveFailure',
    action: 'updateRetry',
    hint: 'updateFailureDescription',
    busy: false,
    Icon: CircleAlert,
    ActionIcon: RefreshCw,
  },
  install: {
    message: 'updateInstallFailure',
    action: 'updateRetry',
    hint: 'updateFailureDescription',
    busy: false,
    Icon: CircleAlert,
    ActionIcon: RefreshCw,
  },
} as const

export function UpdateBar({ updater }: { updater: UpdateBridge }) {
  const t = useTranslation()
  const [state, setState] = useState<UpdateState>(null)
  const hintId = useId()
  useEffect(() => updater.subscribe(setState), [updater])

  if (!state) return null
  const phase = state.error ?? state.status
  if (phase === 'downloading') return null
  const { message, action, hint: hintKey, busy, Icon, ActionIcon } = presentations[phase]
  const label = t(action)
  const hint = hintKey ? t(hintKey) : ''

  return (
    <div className="update-position" data-state={phase}>
      <div className="update-bar">
        <div className="update-copy" role="status" aria-live="polite" aria-atomic="true">
          <Icon aria-hidden="true" />
          <div className="update-details">
            <span>{t(message)}</span>
            {!state.error && <span className="update-version">v{state.version}</span>}
          </div>
          <span className="sr-only">
            {label} {hint}
          </span>
        </div>
        <Button
          size="sm"
          className="update-action"
          disabled={busy}
          aria-label={phase === 'ready' ? t('updateActionLabel') : label}
          aria-describedby={hint ? hintId : undefined}
          onClick={() =>
            phase === 'download'
              ? window.open(releasesUrl, '_blank', 'noopener,noreferrer')
              : updater.restart()
          }
        >
          {label}
          <ActionIcon
            aria-hidden="true"
            className={busy ? 'motion-safe:animate-spin' : undefined}
          />
        </Button>
      </div>
      {hint && (
        <p className="update-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}
