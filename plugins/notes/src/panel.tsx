import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Banner, BannerRow, Button, MarkdownInput, PluginContent, PluginPage } from '@nesso-how/ui'
import type { ActionContext } from '@nesso-how/plugin'
import { createNotes, type Notes } from './notes.ts'
import { messages } from './i18n.ts'
import './styles.css'

function NotesPage({
  title,
  children,
  banner,
}: {
  title: string
  children?: ReactNode
  banner?: ReactNode
}) {
  return (
    <PluginPage className="notes-page">
      <div className="notes-content">
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
    </PluginPage>
  )
}

function useNotesInstance(
  storage: ActionContext['storage'],
  viewId: string | null,
  signal: AbortSignal,
) {
  const [notes, setNotes] = useState<Notes | 'failed' | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void createNotes(storage, viewId).then(
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
  }, [storage, viewId, signal, attempt])
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
}: {
  notes: Notes
  title: string
  locale: keyof typeof messages
}) {
  const state = useSyncExternalStore(notes.subscribe, notes.getSnapshot)
  const t = messages[locale]
  return (
    <NotesPage
      title={title}
      banner={state.failed ? <BannerRow message={t.saveError} /> : undefined}
    >
      <MarkdownInput
        className="notes-editor"
        aria-labelledby="notes-title"
        value={state.text}
        onChange={notes.setText}
        readOnly={state.failed}
        placeholder={t.placeholder}
      />
    </NotesPage>
  )
}

export function NotesPanel({ document, storage, viewId, signal }: ActionContext) {
  const state = useSyncExternalStore(document.subscribe, document.getState)
  const t = messages[state.locale]
  const title = state.workspace.savedViews.find(({ id }) => id === viewId)?.name ?? t.all
  const { notes, retry } = useNotesInstance(storage, viewId, signal)
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
  return <Editor notes={notes} title={title} locale={state.locale} />
}
