import { createContext, useContext, useState, type ComponentProps } from 'react'
import { PanelLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SidebarContext = createContext<{ open: boolean; toggle: () => void } | null>(null)

function useSidebar() {
  const sidebar = useContext(SidebarContext)
  if (!sidebar) throw new Error('Sidebar must be inside SidebarProvider')
  return sidebar
}

export function SidebarProvider({ children, ...props }: ComponentProps<'div'>) {
  const [open, setOpen] = useState(true)

  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen((value) => !value) }}>
      <div data-slot="sidebar-wrapper" className="flex min-h-svh w-full" {...props}>
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
          'relative bg-transparent transition-[width] duration-200 ease-linear',
          open ? 'w-(--sidebar-width)' : 'w-0',
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) border-r transition-[left] duration-200 ease-linear md:flex',
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
  const { toggle } = useSidebar()

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Toggle Sidebar" onClick={toggle}>
      <PanelLeftIcon />
    </Button>
  )
}

export function SidebarInset({ className, ...props }: ComponentProps<'main'>) {
  return <main className={cn('relative flex w-full flex-1 flex-col bg-background', className)} {...props} />
}
