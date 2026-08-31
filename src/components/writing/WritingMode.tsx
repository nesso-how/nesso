// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useState } from 'react'
import { countNotesWords } from '@nesso-how/vocab-learning'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { CloseButton } from '@/components/ui/CloseButton'
import type { NotesDocument } from '@/types/graph'
import { WritingEditor } from './WritingEditor'

interface Props {
  nodeId: string
  onClose: () => void
}

/**
 * Full-screen Writing Mode overlay (ReviewMode pattern): takes over the screen,
 * Escape/close returns to the canvas exactly where you were. Pending editor
 * edits flush on unmount (WritingEditor); the store's close lifecycle handles
 * deletion/graph-switch/reload, and `anyModalOpen` suppresses canvas shortcuts.
 */
export function WritingMode({ nodeId, onClose }: Props) {
  const t = useT()
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId) ?? null)
  const graphName = useGraphStore(
    (s) => s.graphList.find((g) => g.id === s.currentGraphId)?.name ?? '',
  )
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const [words, setWords] = useState(() => countNotesWords(node?.data.elaboration?.notes))

  // Memoized so word-count re-renders never churn the editor's props. Reads the
  // node's CURRENT definition from the store at commit time — the definition may
  // have changed since mount, and a node deleted mid-write must no-op.
  const commit = useCallback(
    (notes: NotesDocument | undefined) => {
      const current = useGraphStore.getState().nodes.find((n) => n.id === nodeId)
      if (!current) return
      const definition = current.data.elaboration?.definition ?? ''
      updateNodeData(nodeId, {
        elaboration: { definition, ...(notes === undefined ? {} : { notes }) },
      })
    },
    [nodeId, updateNodeData],
  )

  // Escape closes unless the event was already consumed by the focused editor
  // or the slash menu (defaultPrevented). On teardown, the save is deferred to
  // a macrotask so it deterministically fires AFTER the child editor's unmount
  // flush has landed its pending notes in the store — for close-path unmounts
  // and deletion unmounts alike — never losing the last writing pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const save = useGraphStore.getState().saveCurrentGraph
      setTimeout(() => void save(), 0)
    }
  }, [onClose])

  if (!node) return null

  const definition = node.data.elaboration?.definition ?? ''

  return (
    <div
      data-testid="writing-mode"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 72,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: '10px 18px',
          borderBottom: '0.5px solid var(--line)',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--paper)',
            background: 'var(--ink-2)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          {t.writing.pill}
        </span>
        <span
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {graphName ? `${graphName} / ` : ''}
          {node.data.text}
        </span>
        <span
          data-testid="writing-mode-words"
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-4)',
          }}
        >
          {t.writing.words(words)}
        </span>
        <span data-testid="writing-mode-close">
          <CloseButton onClick={onClose} />
        </span>
      </div>

      {definition.trim() !== '' && (
        <div
          style={{
            flexShrink: 0,
            width: '100%',
            maxWidth: 680,
            margin: '0 auto',
            padding: '18px 24px 0',
            fontSize: '12.5px',
            lineHeight: 1.5,
            fontFamily: 'var(--font-display)',
            color: 'var(--ink-4)',
            fontStyle: 'italic',
          }}
        >
          {definition}
        </div>
      )}

      <div
        className="nesso-scrollbar"
        style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}
      >
        <div style={{ width: '100%', maxWidth: 680, padding: '18px 24px 48px' }}>
          <WritingEditor
            key={nodeId}
            identityKey={nodeId}
            definition={definition}
            placeholder={t.writing.placeholder}
            initialNotes={node.data.elaboration?.notes}
            onCommit={commit}
            onWordCountChange={setWords}
            snippets={t.writing.snippets}
            menuLabel={t.writing.pill}
          />
        </div>
      </div>
    </div>
  )
}
