import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, MenuItem } from '@nesso-how/ui'
import { invokeAction, useMapActions } from '@/plugins'
import { useNessoStore } from '@/store'
import { ActionBadge } from './ActionBadge'

export function MapActions({ mapId }: { mapId: string | null }) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const actions = useMapActions()

  return actions.map((action) => (
    <MenuItem
      key={action.id}
      onClick={() => {
        void invokeAction(action.id, mapId)
      }}
    >
      <ActionIcon name={action.icon} />
      {action.label[locale] ?? action.label.en}
      {action.badge && (
        <ActionBadge
          actionId={action.id}
          mapId={mapId}
          label={action.label[locale] ?? action.label.en}
          inline
        />
      )}
    </MenuItem>
  ))
}
