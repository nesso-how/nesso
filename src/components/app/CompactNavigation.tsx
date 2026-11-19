import type { WorkspaceMap } from '@nesso-how/core'
import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, Menu, MenuPopup, MenuRadioItem, PanelHeader, Tabs } from '@nesso-how/ui'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from '@/i18n'
import { openCanvasTab, useCanvasTabs, usePluginPanel } from '@/plugins'
import { host, useNessoStore } from '@/store'
import { ActionBadge } from './ActionBadge'

const graphOption = 'graph'

export function MapSwitcher() {
  const t = useTranslation()
  const workspace = useNessoStore((state) => state.workspace)
  const conceptCount = useNessoStore((state) => state.graph.concepts.length)
  const map = workspace.maps.find(({ id }) => id === workspace.activeMapId)
  const name = map?.name ?? t('completeGraph')
  const pinned = workspace.maps.filter((map) => map.pinned)
  const ordinary = workspace.maps.filter((map) => !map.pinned)
  const option = (value: string, label: string, count: number) => (
    <MenuRadioItem key={value} value={value} className="min-h-11">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="pl-4 font-mono text-[10px] leading-4 text-muted-foreground">
        {t('conceptCount', { count })}
      </span>
    </MenuRadioItem>
  )
  const savedOption = (map: WorkspaceMap) => option(map.id, map.name, map.members.length)
  const group = (label: string, children: ReactNode) => (
    <Menu.Group>
      <Menu.GroupLabel className="px-2.5 pt-2 pb-1 font-mono text-[11px] leading-4 text-muted-foreground">
        {label}
      </Menu.GroupLabel>
      {children}
    </Menu.Group>
  )

  return (
    <PanelHeader size="lg" actions={null} className="pl-2">
      <Menu.Root>
        <Menu.Trigger
          className="compact-map-switcher"
          aria-label={t('switchMap', { name })}
          title={t('switchMap', { name })}
        >
          <span className="truncate">{name}</span>
          <ChevronDown aria-hidden="true" />
        </Menu.Trigger>
        <MenuPopup sideOffset={6} className="w-[calc(100vw-16px)]">
          <Menu.RadioGroup
            value={workspace.activeMapId ?? graphOption}
            onValueChange={(value: string) =>
              host.store.setMap(value === graphOption ? null : value)
            }
          >
            {option(graphOption, t('completeGraph'), conceptCount)}
            {pinned.length > 0 && (
              <>
                <Menu.Separator className="my-1 h-px bg-border" />
                {group(t('pinnedMaps'), pinned.map(savedOption))}
              </>
            )}
            {ordinary.length > 0 && (
              <>
                <Menu.Separator className="my-1 h-px bg-border" />
                {group(t('maps'), ordinary.map(savedOption))}
              </>
            )}
          </Menu.RadioGroup>
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
        <Tabs.Tab value="graph" className="compact-tab">
          <ActionIcon name="share" />
          <span className="compact-tab-label">{t(canvasLabel)}</span>
        </Tabs.Tab>
        {tabs.map((tab) => {
          const label = tab.label[locale] ?? tab.label.en
          return (
            <Tabs.Tab key={tab.key} value={tab.id} className="compact-tab">
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
