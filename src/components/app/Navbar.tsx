import { MoreHorizontal } from 'lucide-react'
import { useEffect } from 'react'
import { Button, Menu, MenuItem, MenuPopup } from '@nesso/ui'
import { SidebarNewView, SidebarTrigger } from '@/components/app/SidebarLayout'
import { actions } from '@/plugins'
import { host, useNessoStore } from '@/store'

export function Navbar() {
  const history = useNessoStore((state) => state.history)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey)) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, [contenteditable="true"]') && !target.hasAttribute('data-document-edit')) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && !(key === 'y' && event.ctrlKey && !event.metaKey)) return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) host.history.redo()
      else host.history.undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
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
            <MenuItem disabled={!history.canUndo} onClick={host.history.undo}>Undo</MenuItem>
            <MenuItem disabled={!history.canRedo} onClick={host.history.redo}>Redo</MenuItem>
            <Menu.Separator className="my-1 h-px bg-border" />
            {actions.map((action) => (
              <MenuItem key={action.id} onClick={action.run}>{action.label}</MenuItem>
            ))}
            <Menu.Separator className="my-1 h-px bg-border" />
            <MenuItem onClick={() => {
              if (window.confirm('Reset the graph? All concepts and relations will be replaced by one new concept. This cannot be undone.')) host.store.resetGraph()
            }}>Reset graph</MenuItem>
          </MenuPopup>
        </Menu.Root>
      </div>
    </header>
  )
}
