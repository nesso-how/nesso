import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, IconButton, Menu, MenuItem, MenuPopup, PanelHeader, Tabs } from '@nesso-how/ui'
import { ChevronDown, MoreHorizontal } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { openCanvasTab, useCanvasTabs, usePluginPanel, useViewActions } from '@/plugins'
import {
  sameTabLayout,
  visibleTabs,
  type CanvasTab,
  type CanvasTabLayout,
} from '@/plugins/canvas-tabs'
import { nessoStore, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { ViewActions } from './ViewActions'
import { ActionBadge } from './ActionBadge'

const shortcut = (index: number) => {
  if (!window.nessoMenu || index > 8) return undefined
  return `${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'}${index + 1}`
}

export function ViewHeader({
  readonly = false,
  store = nessoStore,
  preview,
}: {
  readonly?: boolean
  store?: HostStore
  preview?: { readonly tabs: readonly CanvasTab[]; readonly badgeCount: number }
}) {
  const t = useTranslation(store)
  const workspace = useNessoStore((state) => state.workspace, store)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale, store)
  const availableTabs = useCanvasTabs()
  const tabs = preview?.tabs ?? availableTabs
  const commands = useViewActions().length > 0
  const panel = usePluginPanel()
  const root = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<CanvasTabLayout | null>(null)
  const activeIndex = preview ? -1 : tabs.findIndex(({ id }) => id === panel?.actionId)
  const value = activeIndex < 0 ? 'graph' : tabs[activeIndex].id
  const shown = preview ? tabs : visibleTabs(tabs, activeIndex, layout)
  const hidden = tabs.filter((tab) => !shown.includes(tab))
  const view = workspace.savedViews.find((view) => view.id === workspace.activeViewId)
  const name = view?.name ?? t('completeGraph')
  const label = (tab: CanvasTab) => tab.label[locale] ?? tab.label.en
  const content = (tab: CanvasTab) => (
    <>
      <ActionIcon name={tab.icon} />
      {label(tab)}
      {tab.badge &&
        (preview ? (
          <span
            className="font-mono text-[10px] text-muted-foreground"
            aria-label={t('actionBadgeCount', { count: preview.badgeCount })}
          >
            {preview.badgeCount}
          </span>
        ) : (
          <ActionBadge
            actionId={tab.id}
            viewId={workspace.activeViewId}
            label={label(tab)}
            inline
          />
        ))}
    </>
  )
  const keys = tabs.map(({ key }) => key).join('\n')
  const isPreview = !!preview

  useLayoutEffect(() => {
    if (isPreview) return
    const container = root.current
    const row = measure.current
    if (!container || !row) return
    const update = () => {
      const items = [...row.children] as HTMLElement[]
      const width = (element: HTMLElement) => element.getBoundingClientRect().width
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0
      const next: CanvasTabLayout = {
        available: width(container),
        gap,
        fixed: width(items[0]) + gap + width(items[1]),
        more: width(items[items.length - 1]),
        tabs: items.slice(2, -1).map(width),
      }
      setLayout((previous) => (previous && sameTabLayout(previous, next) ? previous : next))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    for (const item of row.children) observer.observe(item)
    return () => observer.disconnect()
  }, [keys, locale, isPreview])

  const tab = (value: string, index: number, children: ReactNode, text: string) => {
    const key = shortcut(index)
    return (
      <Tabs.Tab
        key={value}
        value={value}
        disabled={readonly && value !== 'graph'}
        className={preview && value !== 'graph' ? 'canvas-tab intro-review-tab' : 'canvas-tab'}
        title={key ? `${text} ${key}` : undefined}
      >
        {children}
      </Tabs.Tab>
    )
  }

  const navigation = (
    <Tabs.Root
      ref={root}
      value={value}
      className="relative flex min-w-0 flex-1 items-center gap-1 self-stretch"
      onValueChange={(next: string) => {
        if (!readonly && !preview) openCanvasTab(next === 'graph' ? null : next)
      }}
    >
      <div
        ref={measure}
        aria-hidden="true"
        inert
        className="canvas-tabs pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap"
      >
        <span className="canvas-tab">
          <ActionIcon name="share" />
          {t('canvasGraph')}
        </span>
        <span className="h-4 w-px" />
        {tabs.map((tab) => (
          <span key={tab.key} className="canvas-tab">
            {content(tab)}
          </span>
        ))}
        <span className="canvas-tabs-more">
          <ChevronDown />9
        </span>
      </div>
      <Tabs.List
        aria-label={t('canvasTabs')}
        className="canvas-tabs -m-[3px] min-w-0 overflow-hidden p-[3px]"
      >
        {tab(
          'graph',
          0,
          <>
            <ActionIcon name="share" />
            {t('canvasGraph')}
          </>,
          t('canvasGraph'),
        )}
        {tabs.length > 0 && <span aria-hidden="true" className="h-4 w-px bg-border" />}
        {shown.map((item) => tab(item.id, tabs.indexOf(item) + 1, content(item), label(item)))}
      </Tabs.List>
      {hidden.length > 0 && (
        <Menu.Root>
          <Menu.Trigger
            disabled={readonly}
            className="canvas-tabs-more"
            aria-label={t('moreTabs', { count: hidden.length })}
            title={t('moreTabs', { count: hidden.length })}
          >
            <ChevronDown />
            {hidden.length}
          </Menu.Trigger>
          <MenuPopup>
            {hidden.map((item) => {
              const key = shortcut(tabs.indexOf(item) + 1)
              return (
                <MenuItem key={item.key} onClick={() => openCanvasTab(item.id)}>
                  {content(item)}
                  {key && (
                    <span className="ml-auto pl-4 font-mono text-[10px] text-muted-foreground">
                      {key}
                    </span>
                  )}
                </MenuItem>
              )
            })}
          </MenuPopup>
        </Menu.Root>
      )}
    </Tabs.Root>
  )

  if (preview) return navigation

  return (
    <PanelHeader
      size="lg"
      actions={
        <Menu.Root key={workspace.activeViewId ?? 'complete-graph'}>
          <Menu.Trigger
            disabled={readonly || !commands}
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
            <ViewActions viewId={workspace.activeViewId} />
          </MenuPopup>
        </Menu.Root>
      }
    >
      {navigation}
    </PanelHeader>
  )
}
