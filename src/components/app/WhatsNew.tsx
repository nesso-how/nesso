import { useRef } from 'react'
import type { Locale } from '@nesso-how/i18n'
import { Button, Dialog, DialogActions, DialogPopup } from '@nesso-how/ui'
import { Sparkles, X } from 'lucide-react'
import Markdown from 'react-markdown'
import { translate, useTranslation } from '@/i18n'
import type { ReleaseNotes } from '@/whats-new/catalog'

export function WhatsNewBanner({
  visible,
  onOpen,
  onDismiss,
}: {
  visible: boolean
  onOpen: () => void
  onDismiss: () => void
}) {
  const t = useTranslation()
  if (!visible) return null
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2 text-xs">
      <div className="flex flex-1 basis-36 items-center gap-2" role="status">
        <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {t('whatsNewAvailable')}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button size="sm" variant="outline" onClick={onOpen}>
          {t('whatsNewAction')}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t('whatsNewDismiss')}
          onClick={onDismiss}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export function WhatsNewDialog({
  notes,
  locale,
  onOpen,
  onClose,
  finalFocus,
}: {
  notes: readonly ReleaseNotes[] | null
  locale: Locale
  onOpen?: () => void
  onClose: () => void
  finalFocus?: () => HTMLElement | null
}) {
  const t = translate(locale)
  const title = useRef<HTMLHeadingElement>(null)
  return (
    <Dialog.Root open={notes !== null} onOpenChange={(open) => (open ? onOpen?.() : onClose())}>
      {onOpen && (
        <Dialog.Trigger
          render={<Button size="sm" variant="outline" className="font-sans text-xs" />}
        >
          {t('whatsNew')}
        </Dialog.Trigger>
      )}
      {notes && (
        <DialogPopup
          className="flex max-h-9/10 flex-col"
          initialFocus={title}
          finalFocus={finalFocus}
        >
          <Dialog.Title ref={title} tabIndex={-1} className="text-base font-medium outline-none">
            {t('whatsNew')}
          </Dialog.Title>
          {notes.length > 0 ? (
            <div className="nesso-scroll mt-4 min-h-0 space-y-4 overflow-y-auto">
              {notes.map(({ version, messages }) => (
                <section key={version} className="space-y-2">
                  <h3 className="font-mono text-xs font-medium">v{version}</h3>
                  <ul className="list-disc space-y-1 ps-4 text-sm">
                    {messages[locale].map((message) => (
                      <li key={message}>
                        <Markdown allowedElements={['p', 'strong', 'em']} unwrapDisallowed skipHtml>
                          {message}
                        </Markdown>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              {t('whatsNewEmpty')}
            </Dialog.Description>
          )}
          <DialogActions>
            <Dialog.Close render={<Button variant="outline" />}>{t('close')}</Dialog.Close>
          </DialogActions>
        </DialogPopup>
      )}
    </Dialog.Root>
  )
}
