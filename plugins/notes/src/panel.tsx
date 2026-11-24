import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Banner, BannerRow, Button, MarkdownInput, PluginContent, PluginPage } from '@nesso-how/ui'
import type { ActionContext } from '@nesso-how/plugin'
import { createNotes, type Notes } from './notes.ts'
import { NotesFind } from './find-bar.tsx'
import { messages } from './i18n.ts'
import './styles.css'

const scrollPositions = new Map<string | null, number>()

function NotesPage({
  title,
  children,
  banner,
  footer,
  mapId,
}: {
  title: string
  children?: ReactNode
  banner?: ReactNode
  footer?: ReactNode
  mapId?: string | null
}) {
  const content = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (mapId === undefined) return
    const element = content.current!
    const target = scrollPositions.get(mapId) ?? 0
    const restore = () => {
      element.scrollTop = target
    }
    restore()
    const frame = requestAnimationFrame(restore)
    return () => cancelAnimationFrame(frame)
  }, [mapId])
  return (
    <PluginPage className="notes-page">
      <div
        ref={content}
        className="notes-content nesso-scroll"
        onScroll={
          mapId === undefined
            ? undefined
            : ({ currentTarget }) => scrollPositions.set(mapId, currentTarget.scrollTop)
        }
      >
        <PluginContent className="notes-document">
          <h1 id="notes-title">{title}</h1>
          {children}
        </PluginContent>
      </div>
      {banner && (
        <Banner tone="warning" className="notes-banner">
          {banner}
        </Banner>
      )}
      {footer}
    </PluginPage>
  )
}

function useNotesInstance(
  storage: ActionContext['storage'],
  mapId: string | null,
  signal: AbortSignal,
) {
  const [notes, setNotes] = useState<Notes | 'failed' | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void createNotes(storage, mapId).then(
      (notes) => {
        if (active && !signal.aborted) setNotes(notes)
      },
      () => {
        if (active && !signal.aborted) setNotes('failed')
      },
    )
    return () => {
      active = false
    }
  }, [storage, mapId, signal, attempt])
  return {
    notes,
    retry: () => {
      setNotes(null)
      setAttempt((attempt) => attempt + 1)
    },
  }
}

function RestoreBanner({
  message,
  label,
  onRetry,
}: {
  message: string
  label: string
  onRetry: () => void
}) {
  return (
    <BannerRow
      message={<span>{message}</span>}
      actions={
        <Button variant="outline" size="sm" onClick={onRetry}>
          {label}
        </Button>
      }
    />
  )
}

function Editor({
  notes,
  title,
  locale,
  mapId,
}: {
  notes: Notes
  title: string
  locale: keyof typeof messages
  mapId: string | null
}) {
  const state = useSyncExternalStore(notes.subscribe, notes.getSnapshot)
  const t = messages[locale]
  return (
    <NotesFind labels={t.find}>
      {(findBar) => (
        <NotesPage
          title={title}
          mapId={mapId}
          banner={state.failed ? <BannerRow message={t.saveError} /> : undefined}
          footer={findBar}
        >
          <MarkdownInput
            className="notes-editor"
            aria-labelledby="notes-title"
            aria-keyshortcuts="Meta+F Control+F"
            value={state.text}
            onChange={notes.setText}
            readOnly={state.failed}
            tabIndex={state.failed ? 0 : undefined}
            tasks
            placeholder={t.placeholder}
          />
        </NotesPage>
      )}
    </NotesFind>
  )
}

export function NotesPanel({ document, storage, mapId, signal }: ActionContext) {
  const state = useSyncExternalStore(document.subscribe, document.getState)
  const t = messages[state.locale]
  const title = state.workspace.maps.find(({ id }) => id === mapId)?.name ?? t.graph
  const { notes, retry } = useNotesInstance(storage, mapId, signal)
  if (notes === 'failed')
    return (
      <NotesPage
        title={title}
        banner={<RestoreBanner message={t.restoreError} label={t.reload} onRetry={retry} />}
      />
    )
  if (!notes)
    return (
      <NotesPage title={title}>
        <p className="notes-status" role="status">
          {t.loading}
        </p>
      </NotesPage>
    )
  return <Editor notes={notes} title={title} locale={state.locale} mapId={mapId} />
}
