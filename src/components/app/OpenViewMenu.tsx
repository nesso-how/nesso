import type { RefObject } from 'react'
import { Layers, LayersPlus, Pin } from 'lucide-react'
import { Menu, MenuItem, MenuPopup } from '@nesso-how/ui'
import type { SavedView } from '@nesso-how/core'
import { useTranslation } from '@/i18n'

export function OpenViewMenu({
  target,
  onClose,
  onOpen,
  onCreate,
  finalFocus,
}: {
  target: { x: number; y: number; views: readonly SavedView[] } | null
  onClose: () => void
  onOpen: (viewId: string) => void
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
          aria-label={t('openInView')}
          finalFocus={finalFocus}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {target.views.length === 0 ? (
            <MenuItem onClick={onCreate}>
              <LayersPlus aria-hidden="true" />
              {t('createViewWithConcept')}
            </MenuItem>
          ) : (
            target.views
              .toSorted((a, b) => Number(b.pinned) - Number(a.pinned))
              .map((view) => (
                <MenuItem key={view.id} onClick={() => onOpen(view.id)}>
                  {view.pinned ? <Pin aria-hidden="true" /> : <Layers aria-hidden="true" />}
                  {view.name}
                </MenuItem>
              ))
          )}
        </MenuPopup>
      )}
    </Menu.Root>
  )
}
