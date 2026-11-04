import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, MenuItem } from '@nesso-how/ui'
import { invokeAction, useViewActions } from '@/plugins'
import { useNessoStore } from '@/store'
import { ActionBadge } from './ActionBadge'

export function ViewActions({ viewId }: { viewId: string | null }) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const actions = useViewActions()

  return actions.map((action) => (
    <MenuItem
      key={action.id}
      onClick={() => {
        void invokeAction(action.id, viewId)
      }}
    >
      <ActionIcon name={action.icon} />
      {action.label[locale] ?? action.label.en}
      {action.badge && (
        <ActionBadge
          actionId={action.id}
          viewId={viewId}
          label={action.label[locale] ?? action.label.en}
          inline
        />
      )}
    </MenuItem>
  ))
}
