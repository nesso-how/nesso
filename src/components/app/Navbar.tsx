import { Menu } from '@base-ui/react/menu'
import { MenuIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { actions } from '@/plugins'
import { host, useNessoStore } from '@/store'

const itemClass = 'cursor-default rounded px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent'

export function Navbar() {
  const focusName = useNessoStore((state) =>
    state.graph.concepts.find((concept) => concept.id === state.workspace.focusId)?.label,
  )

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger />
      <span className="max-w-48 truncate text-sm font-semibold tracking-tight">{focusName}</span>
      <div className="ml-auto">
        <Menu.Root>
          <Menu.Trigger render={<Button size="icon-sm" variant="ghost" aria-label="Graph menu" title="Graph menu" />}>
            <MenuIcon />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner align="end" sideOffset={4} className="z-50">
              <Menu.Popup className="min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none">
                {actions.map((action) => (
                  <Menu.Item key={action.id} className={itemClass} onClick={action.run}>{action.label}</Menu.Item>
                ))}
                <Menu.Separator className="my-1 h-px bg-border" />
                <Menu.Item className={`${itemClass} text-destructive`} onClick={() => {
                  if (window.confirm('Reset the graph? All concepts and relations will be replaced by one new concept. This cannot be undone.')) host.ui.resetGraph()
                }}>Reset graph</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  )
}
