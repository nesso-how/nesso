import { resolveRelationTypeLabel } from '@nesso-how/core'
import { defaultLocale } from '@nesso-how/i18n'
import { relationKey, type Concept } from '@nesso-how/schema'
import { BottomSheet, Button, ContextLabel, MarkdownInput } from '@nesso-how/ui'
import { ArrowLeft, ArrowRight, ChevronRight, Share2 } from 'lucide-react'
import { useLayoutEffect, useState, type RefObject } from 'react'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'
import { usePluginPanel } from '@/plugins'
import { host, useNessoStore } from '@/store'
import { openNotesLink } from './notes-link'

const shareUrl = 'https://nesso.how'

async function share(text: string, copied: string, failed: string) {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Nesso', text, url: shareUrl })
      return
    }
    await navigator.clipboard.writeText(shareUrl)
    notifications.api.notify({ tone: 'info', title: copied })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    notifications.api.notify({ tone: 'warning', title: failed })
  }
}

export function ConceptSheet({
  canvas,
  onCover,
}: {
  canvas: RefObject<HTMLElement | null>
  onCover: (height: number) => void
}) {
  const t = useTranslation()
  const selected = useNessoStore((state) => state.selected)
  const graph = useNessoStore((state) => state.viewGraph)
  const vocabs = useNessoStore((state) => state.vocabs)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const pluginPanel = usePluginPanel()
  const item = selected.length === 1 && selected[0].kind === 'concept' ? selected[0] : undefined
  const concept = item && graph.concepts.find(({ id }) => id === item.id)
  const [shown, setShown] = useState<Concept | undefined>(concept)
  if (concept && concept !== shown) setShown(concept)
  const open = !!concept && !pluginPanel
  const [popup, setPopup] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const element = canvas.current
    if (!open || !popup || !element) {
      onCover(0)
      return
    }
    const measure = () => {
      const bounds = element.getBoundingClientRect()
      onCover(
        Math.min(
          bounds.height,
          Math.max(0, popup.offsetHeight - (window.innerHeight - bounds.bottom)),
        ),
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(popup)
    observer.observe(element)
    return () => {
      observer.disconnect()
      onCover(0)
    }
  }, [open, popup, canvas, onCover])

  const connections = shown
    ? graph.relations.filter(
        (relation) => relation.source === shown.id || relation.target === shown.id,
      )
    : []

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) host.store.setSelection([])
      }}
      popupRef={setPopup}
      closeLabel={t('close')}
      title={
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 self-start rounded-[4px] border border-node-border mt-1"
            style={{ background: shown?.color ?? 'var(--background)' }}
          />
          <span className="min-w-0">{shown?.label}</span>
        </span>
      }
      footer={
        !window.nessoMenu && (
          <>
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t('sharePrompt')}</p>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void share(t('shareText'), t('linkCopied'), t('shareFailed'))}
            >
              <Share2 />
              {t('shareNesso')}
            </Button>
          </>
        )
      }
    >
      {shown && (
        <div className="flex flex-col gap-5">
          {shown.notes && (
            <MarkdownInput
              key={shown.id}
              aria-label={t('notes')}
              className="concept-sheet-notes min-h-0 overflow-visible border-0 bg-transparent p-0"
              value={shown.notes}
              onChange={() => {}}
              readOnly
              history={false}
              onOpenLink={(url) => openNotesLink(url, t('notesLinkOpenFailed'))}
            />
          )}
          <section className="flex flex-col">
            <ContextLabel className="mb-1">{t('connectionsInView')}</ContextLabel>
            {connections.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">{t('noConnectionsInView')}</p>
            ) : (
              <ul className="flex flex-col">
                {connections.map((relation) => {
                  const outgoing = relation.source === shown.id
                  const Direction = outgoing ? ArrowRight : ArrowLeft
                  const otherId = outgoing ? relation.target : relation.source
                  const other = graph.concepts.find(({ id }) => id === otherId)
                  const type = graph.relationTypes.find(({ id }) => id === relation.predicate)
                  const label = type ? resolveRelationTypeLabel(type, vocabs, locale) : ''
                  return (
                    <li
                      key={relationKey(relation)}
                      className="border-b border-border last:border-b-0"
                    >
                      <button
                        type="button"
                        className="flex min-h-12 w-full items-center gap-2.5 text-left active:bg-pressed"
                        onClick={() => host.store.setSelection([{ kind: 'concept', id: otherId }])}
                      >
                        <span className="inline-flex w-28 shrink-0 items-center gap-1.5 font-mono text-[10px] leading-[14px] text-muted-foreground">
                          <Direction aria-hidden="true" className="size-3 shrink-0" />
                          <span className="sr-only">
                            {t(outgoing ? 'outgoingRelation' : 'incomingRelation')}:{' '}
                          </span>
                          <span className="min-w-0 break-words">{label}</span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-[3px] border border-node-border"
                          style={{ background: other?.color ?? 'var(--background)' }}
                        />
                        <span className="min-w-0 flex-1 text-[15px] leading-[21px] break-words">
                          {other?.label}
                        </span>
                        <ChevronRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </BottomSheet>
  )
}
