import type { WorkspaceMapGroup } from '@nesso-how/core'
import { newIri } from '@nesso-how/schema'
import { ConfirmDialog, TextPromptDialog } from '@nesso-how/ui'
import { useTranslation } from '@/i18n'
import { maxMapNameLength } from '@/store/settings'
import type { HostStore } from '@/store/types'

export type MapGroupEdit =
  | { kind: 'create'; mapId?: string }
  | { kind: 'rename' | 'delete'; group: WorkspaceMapGroup }

export function MapGroupDialog({
  edit,
  store,
  onClose,
  finalFocus,
}: {
  edit: MapGroupEdit | null
  store: HostStore
  onClose: () => void
  finalFocus: () => HTMLElement | null
}) {
  const t = useTranslation(store)
  const rename = edit?.kind === 'rename' ? edit.group : null
  const deletion = edit?.kind === 'delete' ? edit.group : null
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }
  const groupExists = (id: string) =>
    store.getState().workspace.mapGroups.some((group) => group.id === id)

  return (
    <>
      <TextPromptDialog
        open={edit !== null && deletion === null}
        onOpenChange={onOpenChange}
        title={t(rename ? 'renameMapGroup' : 'newMapGroup')}
        description={t(rename ? 'renameMapGroupDescription' : 'newMapGroupDescription')}
        initialValue={rename?.name ?? ''}
        nameLabel={t('name')}
        submitLabel={t(rename ? 'saveName' : 'createMapGroup')}
        cancelLabel={t('cancel')}
        maxLength={maxMapNameLength}
        finalFocus={finalFocus}
        onSubmit={(name) => {
          if (rename && groupExists(rename.id))
            store.applyOperations([{ kind: 'map-group.rename', id: rename.id, name }])
          if (edit?.kind === 'create') {
            const { mapId } = edit
            const id = newIri()
            if (
              mapId === undefined ||
              store.getState().workspace.maps.some((map) => map.id === mapId)
            )
              store.applyOperations([
                { kind: 'map-group.create', id, name },
                ...(mapId === undefined
                  ? []
                  : [{ kind: 'map.group' as const, id: mapId, groupId: id }]),
              ])
          }
          onClose()
        }}
      />
      <ConfirmDialog
        open={deletion !== null}
        onOpenChange={onOpenChange}
        title={t('deleteMapGroupTitle', { name: deletion?.name ?? '' })}
        description={t('deleteMapGroupDescription')}
        cancelLabel={t('cancel')}
        confirmLabel={t('deleteMapGroup')}
        finalFocus={finalFocus}
        onConfirm={() => {
          if (deletion && groupExists(deletion.id))
            store.applyOperations([{ kind: 'map-group.remove', id: deletion.id }])
          onClose()
        }}
      />
    </>
  )
}
