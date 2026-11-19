import type { RefObject } from 'react'
import { Layers, LayersPlus, Pin } from 'lucide-react'
import { Menu, MenuItem, MenuPopup } from '@nesso-how/ui'
import type { WorkspaceMap } from '@nesso-how/core'
import { useTranslation } from '@/i18n'

export function OpenMapMenu({
  target,
  onClose,
  onOpen,
  onCreate,
  finalFocus,
}: {
  target: { x: number; y: number; maps: readonly WorkspaceMap[] } | null
  onClose: () => void
  onOpen: (mapId: string) => void
  onCreate: () => void
  finalFocus: RefObject<HTMLDivElement | null>
}) {
  const t = useTranslation()
  return (
    <Menu.Root
      open={target !== null}
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {target && (
        <MenuPopup
          anchor={{
            getBoundingClientRect: () => DOMRect.fromRect({ ...target, width: 0, height: 0 }),
          }}
          sideOffset={2}
          aria-label={t('openInMap')}
          finalFocus={finalFocus}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {target.maps.length === 0 ? (
            <MenuItem onClick={onCreate}>
              <LayersPlus aria-hidden="true" />
              {t('createMapWithConcept')}
            </MenuItem>
          ) : (
            target.maps
              .toSorted((a, b) => Number(b.pinned) - Number(a.pinned))
              .map((map) => (
                <MenuItem key={map.id} onClick={() => onOpen(map.id)}>
                  {map.pinned ? <Pin aria-hidden="true" /> : <Layers aria-hidden="true" />}
                  {map.name}
                </MenuItem>
              ))
          )}
        </MenuPopup>
      )}
    </Menu.Root>
  )
}
