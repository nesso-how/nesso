import type { SavedView } from '@nesso-how/plugin'
import { ConfirmDialog } from '@nesso-how/ui'
import { useRef, useState } from 'react'
import { host } from '@/store'
import { buildDeleteViewOperations } from '@/store/views'
import { useTranslation } from '@/i18n'

export function DeleteViewDialog({ target, onClose, finalFocus }: {
  target: SavedView | 'complete-graph' | null
  onClose: () => void
  finalFocus?: () => HTMLElement | null
}) {
  const t = useTranslation()
  const cancel = useRef<HTMLButtonElement>(null)
  const [withConcepts, setWithConcepts] = useState(true)
  const complete = target === 'complete-graph'
  const close = () => {
    setWithConcepts(true)
    onClose()
  }
  return (
    <ConfirmDialog open={target !== null} onOpenChange={(open) => { if (!open) close() }} title={t('deleteViewTitle', { name: complete ? t('completeGraph') : target?.name ?? '' })} description={t(complete ? 'resetConfirmation' : 'deleteViewDescription')} cancelLabel={t('cancel')} confirmLabel={t('deleteView')} initialFocus={cancel} finalFocus={finalFocus} onConfirm={() => {
      if (target) host.store.applyOperations(buildDeleteViewOperations(host.store.getState(), target === 'complete-graph' ? null : target.id, withConcepts))
      close()
    }}>
      {!complete && target && (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" checked={withConcepts} onChange={(event) => setWithConcepts(event.target.checked)} className="size-4 shrink-0 accent-primary" />
          {t('deleteViewConcepts')}
        </label>
      )}
    </ConfirmDialog>
  )
}
