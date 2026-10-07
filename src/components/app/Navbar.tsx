import { Layers, MoreHorizontal } from 'lucide-react'
import { useEffect } from 'react'
import { Button, Menu, MenuItem, MenuPopup } from '@nesso/ui'
import { defaultLocale } from '@nesso/i18n'
import { SidebarNewView, SidebarTrigger } from '@/components/app/SidebarLayout'
import { actions } from '@/plugins'
import { host, useNessoStore } from '@/store'
import { translate } from '@/i18n'

export function Navbar({ readonly = false, onOpenViews, onOpenSettings }: { readonly?: boolean; onOpenViews?: () => void; onOpenSettings: () => void }) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey)) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, [contenteditable="true"]') && !target.hasAttribute('data-document-edit')) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && !(key === 'y' && event.ctrlKey && !event.metaKey)) return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) host.store.redo()
      else host.store.undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 border-b bg-background px-3">
      {readonly ? (
        <Button variant="ghost" size="icon-sm" onClick={onOpenViews} aria-label={t('views')} title={t('views')}>
          <Layers />
        </Button>
      ) : (
        <SidebarTrigger />
      )}
      {!readonly && <SidebarNewView />}
      <div className="ml-auto">
        <Menu.Root>
          <Menu.Trigger render={<Button data-graph-menu-trigger size="icon-sm" variant="ghost" aria-label={t('graphMenu')} title={t('graphMenu')} />}>
            <MoreHorizontal />
          </Menu.Trigger>
          <MenuPopup>
            {actions.map((action) => (
              <MenuItem key={action.id} onClick={action.run}>{action.label(locale)}</MenuItem>
            ))}
            <Menu.Separator className="my-1 h-px bg-border" />
            <MenuItem className="md:hidden" onClick={onOpenSettings}>{t('settings')}</MenuItem>
            {!readonly && (
              <MenuItem onClick={() => {
                if (window.confirm(translate(host.store.getState().preferences.locale ?? defaultLocale)('resetConfirmation'))) host.store.resetGraph()
              }}>{t('resetGraph')}</MenuItem>
            )}
          </MenuPopup>
        </Menu.Root>
      </div>
    </header>
  )
}
