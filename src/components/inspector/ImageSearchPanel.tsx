// SPDX-License-Identifier: MIT
import { useState, useEffect, useRef, type FormEvent } from 'react'
import { CloseButton } from '@/components/ui/CloseButton'
import { searchCommonsImages, type WikiImage } from '@/lib/commonsImageSearch'
import { useT } from '@/i18n'

interface Props {
  query: string
  setQuery: (q: string) => void
  conceptText: string
  onPick: (img: WikiImage) => void
  onClose: () => void
}

export function ImageSearchPanel({ query, setQuery, conceptText, onPick, onClose }: Props) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<WikiImage[]>([])
  const [loading, setLoading] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once when search panel opens; query/conceptText are initial props
  useEffect(() => {
    let cancelled = false
    const initialQ = query.trim() || conceptText.trim()
    if (!query.trim() && conceptText.trim()) setQuery(conceptText.trim())

    const focusTimer = setTimeout(() => inputRef.current?.focus(), 30)

    if (initialQ) {
      setLoading(true)
      searchCommonsImages(initialQ)
        .then((r) => {
          if (!cancelled) setResults(r)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    return () => {
      cancelled = true
      clearTimeout(focusTimer)
    }
  }, [])

  async function runSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    try {
      setResults(await searchCommonsImages(q))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--bg-card)',
        borderBottom: '0.5px solid var(--line)',
        padding: '10px 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}
    >
      <form
        onSubmit={runSearch}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          background: 'var(--paper)',
          border: '0.5px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: '6px 9px',
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--ink-4)"
          strokeWidth="1.6"
          style={{ flexShrink: 0 }}
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L13 13" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.inspector.image.searchPlaceholder}
          style={{
            flex: 1,
            minWidth: 0,
            appearance: 'none',
            border: 0,
            background: 'transparent',
            outline: 'none',
            padding: 0,
            fontSize: '12.5px',
            fontWeight: 450,
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink)',
          }}
        />
        {results.length > 0 && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-5)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            {results.length} hits
          </span>
        )}
        {loading && (
          <span
            aria-busy="true"
            aria-label={t.inspector.image.searching}
            role="status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexShrink: 0,
              height: 15,
              padding: '0 2px',
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 'var(--radius-circle)',
                  background: 'var(--ink-4)',
                  animation: `nx-dots-pulse 0.75s ease-in-out ${i * 0.13}s infinite both`,
                }}
              />
            ))}
          </span>
        )}
        <CloseButton onClick={onClose} />
      </form>

      {results.length > 0 && (
        <div className="nesso-scrollbar" style={{ maxHeight: 220, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {results.map((img) => (
              <button
                key={img.title}
                type="button"
                onClick={() => onPick(img)}
                style={{
                  appearance: 'none',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  height: 70,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 0 0 0.5px var(--line)',
                }}
              >
                <img
                  src={img.thumbUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
