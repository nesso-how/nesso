import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, Menu, MenuItem, MenuPopup, PanelHeader, Tabs } from '@nesso-how/ui'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { openCanvasTab, useCanvasTabs, usePluginPanel } from '@/plugins'
import { host, useNessoStore } from '@/store'
import { ActionBadge } from './ActionBadge'
import { MapMenuSections } from './MapMenuSections'

export function MapSwitcher() {
  const t = useTranslation()
  const workspace = useNessoStore((state) => state.workspace)
  const conceptCount = useNessoStore((state) => state.graph.concepts.length)
  const map = workspace.maps.find(({ id }) => id === workspace.activeMapId)
  const name = map?.name ?? t('completeGraph')
  const option = (id: string | null, label: string, count: number) => (
    <MenuItem
      key={id}
      aria-current={id === workspace.activeMapId ? 'page' : undefined}
      className="min-h-11"
      onClick={() => host.store.setMap(id)}
    >
      <span className="size-3.5">
        {id === workspace.activeMapId && <Check aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="pl-4 font-mono text-[10px] leading-4 text-muted-foreground">
        {t('conceptCount', { count })}
      </span>
    </MenuItem>
  )

  return (
    <PanelHeader size="lg" actions={null} className="pl-2">
      <Menu.Root>
        <Menu.Trigger
          className="compact-map-switcher nesso-focus-inset"
          aria-label={t('switchMap', { name })}
          title={t('switchMap', { name })}
        >
          <span className="truncate">{name}</span>
          <ChevronDown aria-hidden="true" />
        </Menu.Trigger>
        <MenuPopup sideOffset={6} className="w-[calc(100vw-16px)]">
          {option(null, t('completeGraph'), conceptCount)}
          <MapMenuSections
            workspace={workspace}
            afterGraph
            renderMap={(map) => option(map.id, map.name, map.members.length)}
          />
        </MenuPopup>
      </Menu.Root>
    </PanelHeader>
  )
}

export function CanvasTabBar() {
  const t = useTranslation()
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const mapId = useNessoStore((state) => state.workspace.activeMapId)
  const tabs = useCanvasTabs()
  const panel = usePluginPanel()
  if (tabs.length === 0) return <div className="shrink-0 pb-[env(safe-area-inset-bottom,0px)]" />
  const value = tabs.find(({ id }) => id === panel?.actionId)?.id ?? 'graph'
  const canvasLabel = mapId === null ? 'canvasGraph' : 'canvasMap'

  return (
    <Tabs.Root
      value={value}
      onValueChange={(next: string) => openCanvasTab(next === 'graph' ? null : next)}
      className="compact-tab-bar"
    >
      <Tabs.List aria-label={t('canvasTabs')} className="compact-tab-list">
        <Tabs.Tab value="graph" className="compact-tab nesso-focus-inset">
          <ActionIcon name="share" />
          <span className="compact-tab-label">{t(canvasLabel)}</span>
        </Tabs.Tab>
        {tabs.map((tab) => {
          const label = tab.label[locale] ?? tab.label.en
          return (
            <Tabs.Tab key={tab.key} value={tab.id} className="compact-tab nesso-focus-inset">
              <ActionIcon name={tab.icon} />
              <span className="compact-tab-label">{label}</span>
              {tab.badge && <ActionBadge actionId={tab.id} mapId={mapId} label={label} inline />}
            </Tabs.Tab>
          )
        })}
      </Tabs.List>
    </Tabs.Root>
  )
}
