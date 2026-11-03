import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, IconButton, Menu, MenuPopup, PanelHeader, Tabs } from '@nesso-how/ui'
import { MoreHorizontal } from 'lucide-react'
import { useTranslation } from '@/i18n'
import {
  canvasTabActionIds,
  invokeAction,
  pluginPanel,
  usePluginPanel,
  useViewActions,
} from '@/plugins'
import { useNessoStore } from '@/store'
import { ViewActions } from './ViewActions'
import { ActionBadge } from './ActionBadge'

export function ViewHeader({ readonly = false }: { readonly?: boolean }) {
  const t = useTranslation()
  const workspace = useNessoStore((state) => state.workspace)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const actions = useViewActions()
  const panel = usePluginPanel()
  const tabs = canvasTabActionIds.flatMap((id) => actions.filter((action) => action.id === id))
  const value = panel && canvasTabActionIds.includes(panel.actionId) ? panel.actionId : 'graph'
  const view = workspace.savedViews.find((view) => view.id === workspace.activeViewId)
  const name = view?.name ?? t('completeGraph')

  return (
    <PanelHeader
      size="lg"
      actions={
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
              inlineActionIds={tabs.map(({ id }) => id)}
            />
          </MenuPopup>
        </Menu.Root>
      }
    >
      <Tabs.Root
        value={value}
        className="flex self-stretch"
        onValueChange={(next) => {
          if (next === 'graph') pluginPanel.close()
          else void invokeAction(next, workspace.activeViewId)
        }}
      >
        <Tabs.List aria-label={t('canvasTabs')} className="canvas-tabs">
          <Tabs.Tab value="graph">
            <ActionIcon name="share" />
            {t('canvasGraph')}
          </Tabs.Tab>
          {tabs.length > 0 && (
            <>
              <span aria-hidden="true" className="h-4 w-px bg-border" />
              {tabs.map((action) => (
                <Tabs.Tab key={action.id} value={action.id} disabled={readonly}>
                  <ActionIcon name={action.icon} />
                  {action.label[locale] ?? action.label.en}
                  {action.badge && (
                    <ActionBadge
                      actionId={action.id}
                      viewId={workspace.activeViewId}
                      label={action.label[locale] ?? action.label.en}
                      inline
                    />
                  )}
                </Tabs.Tab>
              ))}
            </>
          )}
        </Tabs.List>
      </Tabs.Root>
    </PanelHeader>
  )
}
