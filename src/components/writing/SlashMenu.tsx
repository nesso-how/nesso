// SPDX-License-Identifier: MIT
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { SuggestionProps } from '@tiptap/suggestion'
import type { SnippetDefinition } from './snippets/registry'

/** Editor-storage key carrying the localized listbox label. WritingEditor
 *  writes `menuLabel ?? placeholder` before the menu can open; the
 *  extension-owned renderer only exposes `props.editor` to this component, so
 *  the storage slot is the label's transport. */
export const SLASH_MENU_LABEL_KEY = 'writingSlashMenuLabel'

/** Imperative handle consumed by the SlashCommand extension's `onKeyDown`
 *  delegate (Escape is handled by the extension itself). */
export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

/** Notion-style dropdown rendered by the SlashCommand suggestion plugin. */
export const SlashMenu = forwardRef<SlashMenuRef, SuggestionProps<SnippetDefinition>>(
  function SlashMenu(props, ref) {
    const [index, setIndexState] = useState(0)
    // The ref is the source of truth so rapid keydowns never read a stale
    // closure; state only drives the re-render.
    const indexRef = useRef(0)
    const items = props.items
    const command = props.command

    const setIndex = useCallback((next: number) => {
      indexRef.current = next
      setIndexState(next)
    }, [])

    // biome-ignore lint/correctness/useExhaustiveDependencies: suggestion item identity intentionally resets the selected option.
    useEffect(() => {
      setIndex(0)
    }, [items, setIndex])

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }) => {
          if (items.length === 0) return false
          // Synchronously clamp before any lookup so a shrunk items list can
          // never produce an out-of-bounds selection (Enter always works).
          if (indexRef.current >= items.length) indexRef.current = items.length - 1
          if (event.key === 'ArrowDown') {
            setIndex((indexRef.current + 1) % items.length)
            return true
          }
          if (event.key === 'ArrowUp') {
            setIndex((indexRef.current - 1 + items.length) % items.length)
            return true
          }
          if (event.key === 'Enter') {
            const item = items[indexRef.current]
            if (item === undefined) return false
            command(item)
            return true
          }
          return false
        },
      }),
      [items, command, setIndex],
    )

    if (items.length === 0) return null

    // Same synchronous clamp for the highlighted option (render side).
    if (indexRef.current >= items.length) indexRef.current = items.length - 1
    const selectedIndex = Math.min(index, items.length - 1)
    const storage = props.editor.storage as unknown as Record<string, unknown> | undefined
    const storedLabel = storage?.[SLASH_MENU_LABEL_KEY]
    const menuLabel =
      typeof storedLabel === 'string' && storedLabel !== '' ? storedLabel : undefined

    return (
      <div
        role="listbox"
        aria-label={menuLabel}
        style={{
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          minWidth: 220,
          padding: 'var(--space-2)',
        }}
      >
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={i === selectedIndex}
            data-testid={`slash-item-${item.id}`}
            onMouseEnter={() => setIndex(i)}
            onClick={() => command(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-5)',
              width: '100%',
              textAlign: 'left',
              appearance: 'none',
              border: 0,
              background: i === selectedIndex ? 'var(--paper-deep)' : 'transparent',
              color: 'var(--ink)',
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
            </svg>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--font-weight-medium)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-4)',
                }}
              >
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    )
  },
)
