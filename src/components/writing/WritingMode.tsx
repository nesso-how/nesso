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
          width: 'min(92vw, 860px)',
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
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: 'var(--space-3) var(--space-7)',
          }}
        >
          <span data-testid="writing-mode-close">
            <CloseButton onClick={handleClose} label={t.writing.close} />
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
          <div
            style={{
              width: '100%',
              maxWidth: 680,
              padding: 'var(--space-8) var(--space-9) calc(var(--space-9) * 2)',
            }}
          >
            <h1
              id="writing-mode-title"
              data-testid="writing-mode-title"
              style={{
                margin: 0,
                fontSize: 'var(--text-xl)',
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
                  fontSize: 'var(--text-md)',
                  lineHeight: 'var(--leading-normal)',
                  fontFamily: 'var(--font-display)',
                  color: 'var(--ink-4)',
                }}
              >
                {definition}
              </div>
            )}
            <div style={{ marginTop: 'var(--space-8)' }}>
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
