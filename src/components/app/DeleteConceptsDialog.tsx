import { ConfirmDialog } from '@nesso-how/ui'
import { deleteOperations } from '@/graph/commands'
import type { HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'

export function DeleteConceptsDialog({
  store,
  open,
  onClose,
  finalFocus,
}: {
  store: HostStore
  open: boolean
  onClose: () => void
  finalFocus?: () => HTMLElement | null
}) {
  const t = useTranslation(store)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={t('deleteConceptsTitle')}
      description={t('deleteConceptsDescription')}
      cancelLabel={t('cancel')}
      confirmLabel={t('deleteConcept')}
      finalFocus={finalFocus}
      onConfirm={() => {
        store.applyOperations(deleteOperations(store.getState()))
        onClose()
      }}
    />
  )
}
