import type { RefObject } from 'react'
import { Layers, LayersPlus, Pin } from 'lucide-react'
import { Menu, MenuItem, MenuPopup } from '@nesso-how/ui'
import { useTranslation } from '@/i18n'
import { useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { MapMenuSections } from './MapMenuSections'

export function OpenMapMenu({
  target,
  store,
  onClose,
  onOpen,
  onCreate,
  finalFocus,
}: {
  target: { x: number; y: number; id: string } | null
  store: HostStore
  onClose: () => void
  onOpen: (mapId: string) => void
  onCreate: () => void
  finalFocus: RefObject<HTMLDivElement | null>
}) {
  const t = useTranslation(store)
  const workspace = useNessoStore((state) => (target ? state.workspace : null), store)
  const maps =
    target && workspace
      ? workspace.maps.filter((map) => map.members.some(({ id }) => id === target.id))
      : []
  return (
    <Menu.Root
      open={target !== null}
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {target && workspace && (
        <MenuPopup
          anchor={{
            getBoundingClientRect: () => DOMRect.fromRect({ ...target, width: 0, height: 0 }),
          }}
          sideOffset={2}
          aria-label={t('openInMap')}
          finalFocus={finalFocus}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {maps.length === 0 ? (
            <MenuItem onClick={onCreate}>
              <LayersPlus aria-hidden="true" />
              {t('createMapWithConcept')}
            </MenuItem>
          ) : (
            <MapMenuSections
              workspace={workspace}
              maps={maps}
              renderMap={(map) => (
                <MenuItem key={map.id} onClick={() => onOpen(map.id)}>
                  {workspace.pinnedMapIds.includes(map.id) ? (
                    <Pin aria-hidden="true" />
                  ) : (
                    <Layers aria-hidden="true" />
                  )}
                  {map.name}
                </MenuItem>
              )}
            />
          )}
        </MenuPopup>
      )}
    </Menu.Root>
  )
}
