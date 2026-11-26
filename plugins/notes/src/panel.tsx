import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { Banner, BannerRow, Button, MarkdownInput, PluginContent, PluginPage } from '@nesso-how/ui'
import type { ActionContext } from '@nesso-how/plugin'
import { createNotes, type Notes } from './notes.ts'
import { NotesFind } from './find-bar.tsx'
import { messages } from './i18n.ts'
import './styles.css'

const scrollPositions = new Map<string | null, number>()
const focusableText = EditorView.contentAttributes.of({ tabindex: '0' })

function NotesPage({
  title,
  children,
  banner,
  footer,
}: {
  title: string
  children?: ReactNode
  banner?: ReactNode
  footer?: ReactNode
}) {
  return (
    <PluginPage className="notes-page">
      <PluginContent className="notes-document">
        <h1 id="notes-title">{title}</h1>
        {children}
      </PluginContent>
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
  const editor = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const view = editor.current && EditorView.findFromDOM(editor.current)
    if (!view) return
    view.dispatch({ effects: StateEffect.appendConfig.of(focusableText) })
    const { scrollDOM: scroller } = view
    scroller.classList.add('nesso-scroll')
    const target = scrollPositions.get(mapId) ?? 0
    const restore = () => {
      scroller.scrollTop = target
    }
    const record = () => scrollPositions.set(mapId, scroller.scrollTop)
    scroller.addEventListener('scroll', record)
    restore()
    const frame = requestAnimationFrame(restore)
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener('scroll', record)
    }
  }, [mapId])

  return (
    <NotesFind editor={editor} labels={t.find}>
      {({ bar, button }) => (
        <NotesPage
          title={title}
          banner={state.failed ? <BannerRow message={t.saveError} /> : undefined}
          footer={bar}
        >
          <MarkdownInput
            ref={editor}
            className="notes-editor"
            aria-labelledby="notes-title"
            aria-keyshortcuts="Meta+F Control+F"
            value={state.text}
            onChange={notes.setText}
            readOnly={state.failed}
            tasks
            placeholder={t.placeholder}
            toolbar={t.formatting}
            readOnlyToolbar
            toolbarEnd={button}
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
