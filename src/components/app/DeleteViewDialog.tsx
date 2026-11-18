import type { SavedView } from '@nesso-how/core'
import { ConfirmDialog } from '@nesso-how/ui'
import { useRef, useState } from 'react'
import { host, useNessoStore } from '@/store'
import { buildDeleteViewOperations, exclusiveConceptIds } from '@/store/views'
import { useTranslation } from '@/i18n'

export function DeleteViewDialog({
  target,
  onClose,
  finalFocus,
}: {
  target: SavedView | 'complete-graph' | null
  onClose: () => void
  finalFocus?: () => HTMLElement | null
}) {
  const t = useTranslation()
  const cancel = useRef<HTMLButtonElement>(null)
  const [keepConcepts, setKeepConcepts] = useState(false)
  const complete = target === 'complete-graph'
  const exclusive = useNessoStore((state) =>
    target && !complete ? exclusiveConceptIds(state, target.id).size : 0,
  )
  const close = () => {
    setKeepConcepts(false)
    onClose()
  }
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={t('deleteViewTitle', { name: complete ? t('completeGraph') : (target?.name ?? '') })}
      description={t(complete ? 'resetConfirmation' : 'deleteViewDescription')}
      cancelLabel={t('cancel')}
      confirmLabel={t('deleteView')}
      initialFocus={cancel}
      finalFocus={finalFocus}
      onConfirm={() => {
        if (target)
          host.store.applyOperations(
            buildDeleteViewOperations(
              host.store.getState(),
              complete ? null : target.id,
              keepConcepts,
            ),
          )
        close()
      }}
    >
      {exclusive > 0 && (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={keepConcepts}
            onChange={(event) => setKeepConcepts(event.target.checked)}
            className="size-4 shrink-0 accent-primary"
          />
          {t('deleteViewKeepConcepts', { count: exclusive })}
        </label>
      )}
    </ConfirmDialog>
  )
}
