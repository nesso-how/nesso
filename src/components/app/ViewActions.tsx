import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, MenuItem } from '@nesso-how/ui'
import { invokeAction, useViewActions } from '@/plugins'
import { useNessoStore } from '@/store'

export function ViewActions({
  viewId,
  inlineActionId,
}: {
  viewId: string | null
  inlineActionId?: string
}) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const actions = useViewActions()

  return actions.map((action) => (
    <MenuItem
      key={action.id}
      className={action.id === inlineActionId ? 'sm:hidden' : undefined}
      onClick={() => {
        void invokeAction(action.id, viewId)
      }}
    >
      <ActionIcon name={action.icon} />
      {action.label[locale] ?? action.label.en}
    </MenuItem>
  ))
}
