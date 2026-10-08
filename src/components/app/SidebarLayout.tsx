import { createContext, useContext, type ComponentProps } from 'react'
import { SidePanel } from '@nesso/ui'
import { cn } from 'cn'
import { NessoError } from '@/store/errors'
import { host, useNessoStore } from '@/store'
import { useTranslation } from '@/i18n'
import { panelLimits } from '@/store/settings'

const SidebarContext = createContext<{ open: boolean; toggle: () => void } | null>(null)

function useSidebar() {
  const sidebar = useContext(SidebarContext)
  if (!sidebar) throw new NessoError([{ path: 'sidebar', message: 'Sidebar must be inside SidebarProvider' }])
  return sidebar
}

export function SidebarProvider({ children, ...props }: ComponentProps<'div'>) {
  const open = useNessoStore((state) => !state.preferences.collapsedSections?.includes('sidebar'))

  return (
    <SidebarContext.Provider value={{ open, toggle: () => host.store.setSectionOpen('sidebar', !open) }}>
      <div data-slot="sidebar-wrapper" className="flex h-svh w-full flex-col overflow-hidden" {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export function Sidebar({ children }: ComponentProps<'div'>) {
  const { open, toggle } = useSidebar()
  const size = useNessoStore((state) => state.preferences.panels.explorerWidth)
  const t = useTranslation()

  return (
    <SidePanel
      id="explorer-panel"
      side="left"
      open={open}
      size={size}
      minSize={panelLimits.explorerWidth.min}
      maxSize={panelLimits.explorerWidth.max}
      onToggle={toggle}
      onSizeChange={(explorerWidth) => host.store.setPanelSizes({ ...host.store.getState().preferences.panels, explorerWidth })}
      toggleLabel={t(open ? 'collapseSidebar' : 'expandSidebar')}
      resizeLabel={t('resizeSidebar')}
      className="hidden text-sidebar-foreground md:block"
    >
      <div data-slot="sidebar-inner" className="flex size-full flex-col bg-sidebar">
        {children}
      </div>
    </SidePanel>
  )
}

export function SidebarInset({ className, ...props }: ComponentProps<'main'>) {
  return <main className={cn('relative flex w-full flex-1 flex-col bg-background', className)} {...props} />
}
