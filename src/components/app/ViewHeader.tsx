import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, Button, IconButton, Menu, MenuPopup, PanelHeader } from '@nesso-how/ui'
import { MoreHorizontal } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { invokeAction, useViewActions } from '@/plugins'
import { useNessoStore } from '@/store'
import { ViewActions } from './ViewActions'
import { ActionBadge } from './ActionBadge'

export function ViewHeader({ readonly = false }: { readonly?: boolean }) {
  const t = useTranslation()
  const workspace = useNessoStore((state) => state.workspace)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const actions = useViewActions()
  const inlineActions = ['notes', 'review'].flatMap((id) =>
    actions.filter((action) => action.id === id),
  )
  const view = workspace.savedViews.find((view) => view.id === workspace.activeViewId)
  const name = view?.name ?? t('completeGraph')

  return (
    <PanelHeader
      size="lg"
      actions={
        <>
          {inlineActions.map((action) => (
            <Button
              key={action.id}
              disabled={readonly}
              variant="ghost"
              size="sm"
              className="relative hidden w-auto sm:inline-flex"
              onClick={() => {
                void invokeAction(action.id, workspace.activeViewId)
              }}
            >
              <ActionIcon name={action.icon} />
              {action.label[locale] ?? action.label.en}
              {action.badge && (
                <ActionBadge
                  actionId={action.id}
                  viewId={workspace.activeViewId}
                  label={action.label[locale] ?? action.label.en}
                />
              )}
            </Button>
          ))}
          <Menu.Root key={workspace.activeViewId ?? 'complete-graph'}>
            <Menu.Trigger
              disabled={readonly}
              render={
                <IconButton
                  aria-label={t('actionsFor', { name })}
                  title={t('actionsFor', { name })}
                />
              }
            >
              <MoreHorizontal />
            </Menu.Trigger>
            <MenuPopup align="end">
              <ViewActions
                viewId={workspace.activeViewId}
                inlineActionIds={inlineActions.map(({ id }) => id)}
              />
            </MenuPopup>
          </Menu.Root>
        </>
      }
    >
      <h1 className="truncate text-[13px] font-medium" title={name}>
        {name}
      </h1>
    </PanelHeader>
  )
}
