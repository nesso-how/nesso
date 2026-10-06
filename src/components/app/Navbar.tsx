import { MoreHorizontal } from 'lucide-react'
import { Button, Menu, MenuItem, MenuPopup } from '@nesso/ui'
import { SidebarNewView, SidebarTrigger } from '@/components/app/SidebarLayout'
import { actions } from '@/plugins'
import { host } from '@/store'

export function Navbar() {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger />
      <SidebarNewView />
      <div className="ml-auto">
        <Menu.Root>
          <Menu.Trigger render={<Button size="icon-sm" variant="ghost" aria-label="Graph menu" title="Graph menu" />}>
            <MoreHorizontal />
          </Menu.Trigger>
          <MenuPopup>
                {actions.map((action) => (
                   <MenuItem key={action.id} onClick={action.run}>{action.label}</MenuItem>
                ))}
                <Menu.Separator className="my-1 h-px bg-border" />
                 <MenuItem onClick={() => {
                  if (window.confirm('Reset the graph? All concepts and relations will be replaced by one new concept. This cannot be undone.')) host.ui.resetGraph()
                 }}>Reset graph</MenuItem>
          </MenuPopup>
        </Menu.Root>
      </div>
    </header>
  )
}
