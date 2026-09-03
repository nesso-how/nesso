// SPDX-License-Identifier: MIT
import { useCallback, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { CloseButton } from '@/components/ui/CloseButton'
import type { NotesDocument } from '@/types/graph'
import { WritingEditor } from './WritingEditor'

interface Props {
  nodeId: string
  onClose: () => void
  canvasInsets?: { top: number; right: number; bottom: number; left: number }
}

/** Text column width; the card wraps it plus uniform CONTENT_INSET gutters. */
const CONTENT_WIDTH = 680
/** Uniform gutter between the card edge and the text column. */
const CONTENT_INSET = 32

/**
 * Canvas-area Writing Mode (ReviewMode pattern): a translucent modal overlay
 * with the writing surface as the dialog card, so the node Inspector stays
 * visible docked on the right. Escape/close returns to the canvas exactly
 * where you were. Notes commit synchronously through the graph-editing slice,
 * and `anyModalOpen` suppresses canvas shortcuts.
 */
export function WritingMode({ nodeId, onClose, canvasInsets }: Props) {
  const t = useT()
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const closeRequestedRef = useRef(false)
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId) ?? null)
  const updateNodeNotes = useGraphStore((s) => s.updateNodeNotes)

  const commit = useCallback(
    (notes: NotesDocument | undefined) => updateNodeNotes(nodeId, notes),
    [nodeId, updateNodeNotes],
  )

  const handleClose = useCallback(() => {
    closeRequestedRef.current = true
    onClose()
  }, [onClose])

  // The editor's capture handler exits the official Suggestion plugin state
  // before this dialog handler can close the overlay. The dialog handler covers
  // Escape from the remaining controls without using a DOM popup marker.
  const handleDialogKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      event.stopPropagation()
      handleClose()
    },
    [handleClose],
  )

  useLayoutEffect(() => {
    const trigger = document.querySelector<HTMLElement>('[data-testid="inspector-notes-write"]')
    const active = document.activeElement
    returnFocusRef.current = trigger ?? (active instanceof HTMLElement ? active : null)
    return () => {
      if (!closeRequestedRef.current) return
      const target = returnFocusRef.current
      if (target?.isConnected) target.focus()
    }
  }, [])

  if (!node) return null

  const definition = node.data.elaboration?.definition ?? ''
  const insets = canvasInsets ?? { top: 0, right: 0, bottom: 0, left: 0 }

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
      data-testid="writing-mode-backdrop"
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: insets.top,
        right: insets.right,
        bottom: insets.bottom,
        left: insets.left,
        zIndex: 70,
        background: 'color-mix(in srgb, var(--ink) 55%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        data-testid="writing-mode"
        role="dialog"
        aria-labelledby="writing-mode-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        style={{
          position: 'relative',
          width: `min(92vw, ${CONTENT_WIDTH + CONTENT_INSET * 2}px)`,
          maxWidth: 'calc(100% - (var(--space-9) * 2))',
          maxHeight: 'calc(90vh - (var(--space-8) * 2))',
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Close affordance mirrors SettingsDialog: 28px `large` CloseButton,
            absolutely offset 12px from the card's top-right. */}
        <div
          data-testid="writing-mode-close"
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
        >
          <CloseButton large onClick={handleClose} label={t.writing.close} />
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
          <div
            style={{
              /* Full width: the card itself is sized to the text measure
                 (CONTENT_WIDTH + gutters), so no maxWidth cap here —
                 capping would re-center the column and double the gutters.
                 Uniform CONTENT_INSET padding on every side. */
              width: '100%',
              padding: CONTENT_INSET,
            }}
          >
            <div
              style={{ paddingBottom: 'var(--space-8)', borderBottom: '0.5px solid var(--line)' }}
            >
              <h1
                id="writing-mode-title"
                data-testid="writing-mode-title"
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 'var(--font-weight-medium)',
                  lineHeight: 'var(--leading-tight)',
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
                    marginTop: 'var(--space-5)',
                    fontSize: '14.5px',
                    fontWeight: 400,
                    lineHeight: 1.55,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--ink-2)',
                  }}
                >
                  {definition}
                </div>
              )}
            </div>
            <div style={{ marginTop: 'var(--space-9)' }}>
              <WritingEditor
                key={nodeId}
                identityKey={nodeId}
                definition={definition}
                placeholder={t.writing.placeholder}
                initialNotes={node.data.elaboration?.notes}
                onCommit={commit}
                onEscape={handleClose}
                invalidNotesMessage={t.writing.invalidNotes}
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
