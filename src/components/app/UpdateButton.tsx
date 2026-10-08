import { useEffect, useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'
import { Button } from '@nesso/ui'
import { useTranslation } from '@/i18n'
import type { UpdateState } from '../../../electron/updates'

export function UpdateButton() {
  const t = useTranslation()
  const [state, setState] = useState<UpdateState>(null)
  useEffect(() => window.nessoUpdater?.subscribe(setState), [])

  if (!state) return null
  const busy = state.status !== 'available'
  return (
    <div className="flex items-center gap-2">
      {state.error && <span role="alert" className="text-xs text-destructive">{t(state.error === 'save' ? 'updateSaveFailure' : 'updateFailure')}</span>}
      <Button size="sm" variant="outline" disabled={busy} aria-busy={busy} onClick={() => {
        void window.nessoUpdater?.download().catch(() => setState({ status: 'available', error: 'download' }))
      }}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Download />}
        {state.status === 'downloading' ? `${t('updating')} ${state.percent ?? 0}%` : t(state.status === 'installing' ? 'restarting' : 'update')}
      </Button>
    </div>
  )
}
