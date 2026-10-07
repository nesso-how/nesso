import { MoreHorizontal } from 'lucide-react'
import { useEffect } from 'react'
import { Button, Menu, MenuItem, MenuPopup, MenuRadioItem } from '@nesso/ui'
import { defaultLocale, isLocale, localeNames, locales } from '@nesso/i18n'
import { SidebarNewView, SidebarTrigger } from '@/components/app/SidebarLayout'
import { actions } from '@/plugins'
import { host, useNessoStore } from '@/store'
import { translate } from '@/i18n'

export function Navbar() {
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
      <SidebarTrigger />
      <SidebarNewView />
      <div className="ml-auto">
        <Menu.Root>
          <Menu.Trigger render={<Button size="icon-sm" variant="ghost" aria-label={t('graphMenu')} title={t('graphMenu')} />}>
            <MoreHorizontal />
          </Menu.Trigger>
          <MenuPopup>
            {actions.map((action) => (
              <MenuItem key={action.id} onClick={action.run}>{action.label(locale)}</MenuItem>
            ))}
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Group>
              <Menu.GroupLabel className="px-2.5 py-2 text-xs text-muted-foreground">{t('language')}</Menu.GroupLabel>
              <Menu.RadioGroup value={locale} onValueChange={(value) => { if (isLocale(value)) host.store.setLocale(value) }}>
                {locales.map((value) => <MenuRadioItem key={value} value={value} lang={value}>{localeNames[value]}</MenuRadioItem>)}
              </Menu.RadioGroup>
            </Menu.Group>
            <Menu.Separator className="my-1 h-px bg-border" />
            <MenuItem onClick={() => {
              if (window.confirm(translate(host.store.getState().preferences.locale ?? defaultLocale)('resetConfirmation'))) host.store.resetGraph()
            }}>{t('resetGraph')}</MenuItem>
          </MenuPopup>
        </Menu.Root>
      </div>
    </header>
  )
}
