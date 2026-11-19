import type { WorkspaceMap } from '@nesso-how/core'
import { ConfirmDialog } from '@nesso-how/ui'
import { useRef, useState } from 'react'
import { host, useNessoStore } from '@/store'
import { buildDeleteMapOperations, exclusiveConceptIds } from '@/store/maps'
import { useTranslation } from '@/i18n'

export function DeleteMapDialog({
  target,
  onClose,
  finalFocus,
}: {
  target: WorkspaceMap | 'complete-graph' | null
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
      title={t('deleteMapTitle', { name: complete ? t('completeGraph') : (target?.name ?? '') })}
      description={t(complete ? 'resetConfirmation' : 'deleteMapDescription')}
      cancelLabel={t('cancel')}
      confirmLabel={t('deleteMap')}
      initialFocus={cancel}
      finalFocus={finalFocus}
      onConfirm={() => {
        if (target)
          host.store.applyOperations(
            buildDeleteMapOperations(
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
          {t('deleteMapKeepConcepts', { count: exclusive })}
        </label>
      )}
    </ConfirmDialog>
  )
}
