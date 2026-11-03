import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, MenuItem } from '@nesso-how/ui'
import { invokeAction, useViewActions } from '@/plugins'
import { useNessoStore } from '@/store'
import { ActionBadge } from './ActionBadge'

export function ViewActions({
  viewId,
  inlineActionIds = [],
}: {
  viewId: string | null
  inlineActionIds?: readonly string[]
}) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const actions = useViewActions()

  return actions.map((action) => (
    <MenuItem
      key={action.id}
      className={inlineActionIds.includes(action.id) ? 'sm:hidden' : undefined}
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
