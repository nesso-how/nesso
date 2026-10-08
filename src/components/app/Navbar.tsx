import { Layers, PanelRight, Settings2 } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@nesso/ui'
import { defaultLocale } from '@nesso/i18n'
import { SidebarNewView, SidebarTrigger } from '@/components/app/SidebarLayout'
import { host, useNessoStore } from '@/store'
import { translate } from '@/i18n'

export function Navbar({ readonly = false, detailsOpen, onToggleDetails, onOpenViews, onOpenSettings }: { readonly?: boolean; detailsOpen: boolean; onToggleDetails: () => void; onOpenViews?: () => void; onOpenSettings: () => void }) {
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
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={onToggleDetails} aria-label={t('toggleDetails')} title={t('details')} aria-expanded={detailsOpen} aria-controls="details-panel"><PanelRight /></Button>
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onOpenSettings} aria-label={t('settings')} title={t('settings')}><Settings2 /></Button>
      </div>
    </header>
  )
}
