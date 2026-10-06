import { createContext, useContext, type ComponentProps } from 'react'
import { PanelLeftIcon } from 'lucide-react'
import { Button } from '@nesso/ui'
import { cn } from 'cn'
import { NessoError } from '@/store/errors'
import { NewViewButton } from './NewViewButton'
import { host, useNessoStore } from '@/store'

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
  const { open } = useSidebar()

  return (
    <div data-slot="sidebar" className="hidden text-sidebar-foreground md:block">
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative bg-transparent transition-[width] duration-(--duration-state) ease-linear',
          open ? 'w-(--sidebar-width)' : 'w-0',
        )}
      />
      <div
        data-slot="sidebar-container"
        inert={!open}
        className={cn(
          'absolute inset-y-0 z-10 hidden w-(--sidebar-width) border-r transition-[left] duration-(--duration-state) ease-linear md:flex',
          open ? 'left-0' : 'left-[calc(var(--sidebar-width)*-1)]',
        )}
      >
        <div data-slot="sidebar-inner" className="flex size-full flex-col bg-sidebar">
          {children}
        </div>
      </div>
    </div>
  )
}

export function SidebarTrigger() {
  const { open, toggle } = useSidebar()

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Toggle Sidebar" aria-expanded={open} title={open ? 'Collapse sidebar' : 'Expand sidebar'} onClick={toggle}>
      <PanelLeftIcon />
    </Button>
  )
}

export function SidebarInset({ className, ...props }: ComponentProps<'main'>) {
  return <main className={cn('relative flex w-full flex-1 flex-col bg-background', className)} {...props} />
}

export function SidebarNewView() {
  const { open } = useSidebar()
  return open ? null : <NewViewButton iconOnly />
}
