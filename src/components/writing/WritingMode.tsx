// SPDX-License-Identifier: MIT
import { useCallback, useEffect } from 'react'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { CloseButton } from '@/components/ui/CloseButton'
import type { NotesDocument } from '@/types/graph'
import { isSlashMenuOpen } from './extensions/slashCommand'
import { WritingEditor } from './WritingEditor'

interface Props {
  nodeId: string
  onClose: () => void
}

// WritingEditor requires an onWordCountChange callback, but the header no
// longer shows a word count: a stable no-op keeps the editor's contract intact
// without state or re-renders here.
const noop = () => {}

/**
 * Canvas-area Writing Mode (ReviewMode pattern): a translucent modal overlay
 * with the writing surface as the dialog card, so the node Inspector stays
 * visible docked on the right. Escape/close returns to the canvas exactly
 * where you were. Pending editor edits flush on unmount (WritingEditor); the
 * store's close lifecycle handles deletion/graph-switch/reload, and
 * `anyModalOpen` suppresses canvas shortcuts.
 */
export function WritingMode({ nodeId, onClose }: Props) {
  const t = useT()
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId) ?? null)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)

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

  // Escape closes via a window CAPTURE-phase listener: ProseMirror's own
  // keydown handling preventDefaults Escape (keyCode 27) in the bubble phase,
  // so a bubble listener here would never see an unconsumed event while the
  // editor is focused. Capture runs BEFORE the editor sees the key: when the
  // slash menu is open its consumption is tracked out-of-band in
  // slashCommand (`isSlashMenuOpen`) — the menu's own preventDefault happens
  // later, in the bubble phase — and the Escape is left to the menu. On close
  // we preventDefault + stopPropagation so ProseMirror and app shortcuts never
  // process the consumed Escape. On teardown, the save is deferred to a
  // macrotask so it deterministically fires AFTER the child editor's unmount
  // flush has landed its pending notes in the store — for close-path unmounts
  // and deletion unmounts alike — never losing the last writing pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isSlashMenuOpen()) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      const save = useGraphStore.getState().saveCurrentGraph
      setTimeout(() => void save(), 0)
    }
  }, [onClose])

  if (!node) return null

  const definition = node.data.elaboration?.definition ?? ''

  return (
    // Backdrop conventions mirror ReviewMode's ModalOverlay (translucent dim,
    // click-to-close) so the canvas and the docked Inspector stay visible
    // behind it. Two deliberate deviations: no `backdropFilter` blur — its
    // fresh compositing layer defers focus into the subtree and swallows the
    // first keystrokes typed right after opening — and ModalOverlay itself is
    // not reused because its own Escape listener is unguarded against
    // defaultPrevented, which conflicts with the editor's Escape contract
    // handled above.
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 70,
        background: 'rgba(20, 18, 14, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        data-testid="writing-mode"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 860px)',
          maxHeight: 'calc(90vh - 40px)',
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '10px 18px',
            borderBottom: '0.5px solid var(--line)',
          }}
        >
          <span data-testid="writing-mode-close">
            <CloseButton onClick={onClose} label={t.writing.close} />
          </span>
        </div>

        <div
          className="nesso-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '100%', maxWidth: 680, padding: '18px 24px 48px' }}>
            <h1
              data-testid="writing-mode-title"
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 500,
                lineHeight: 1.25,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.01em',
                color: 'var(--ink)',
              }}
            >
              {node.data.text}
            </h1>
            {definition.trim() !== '' && (
              <div
                data-testid="writing-mode-definition"
                style={{
                  marginTop: 10,
                  fontSize: '13px',
                  lineHeight: 1.55,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--ink-4)',
                }}
              >
                {definition}
              </div>
            )}
            <div style={{ marginTop: 18 }}>
              <WritingEditor
                key={nodeId}
                identityKey={nodeId}
                definition={definition}
                placeholder={t.writing.placeholder}
                initialNotes={node.data.elaboration?.notes}
                onCommit={commit}
                onWordCountChange={noop}
                snippets={t.writing.snippets}
                menuLabel={t.writing.snippetsMenu}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
