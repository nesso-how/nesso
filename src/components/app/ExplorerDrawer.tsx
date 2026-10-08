import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@nesso/ui'
import { AppSidebar } from './Sidebar'
import { useTranslation } from '@/i18n'

export function ExplorerDrawer({ open, onClose, onOpenSettings }: { open: boolean; onClose: () => void; onOpenSettings: () => void }) {
  const t = useTranslation()
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={t('views')} className="absolute inset-y-0 left-0 flex w-[85vw] max-w-80 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex shrink-0 items-center justify-end px-2 pt-2">
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('close')}>
            <X />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <AppSidebar readonly bare onNavigate={onClose} onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </div>
  )
}
