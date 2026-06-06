// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react'

interface Props {
  text: string
  /** Milliseconds per character. */
  speed?: number
  /** Render `*word*` segments as italic emphasis. */
  emphasis?: boolean
}

function renderWithEmphasis(text: string): React.ReactNode {
  const parts = text.split(/(\*[^*\n]+\*)/g)
  return parts.map((p, i) => {
    if (p.length >= 3 && p.startsWith('*') && p.endsWith('*')) {
      return <em key={i}>{p.slice(1, -1)}</em>
    }
    return p
  })
}

export function Typewriter({ text, speed = 7, emphasis = false }: Props) {
  const [shown, setShown] = useState('')

  useEffect(() => {
    setShown('')
    if (!text) return
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setShown(text.slice(0, i))
      if (i >= text.length) window.clearInterval(id)
    }, speed)
    return () => window.clearInterval(id)
  }, [text, speed])

  const done = shown.length >= text.length

  return (
    <>
      {emphasis ? renderWithEmphasis(shown) : shown}
      {!done && (
        <span
          style={{
            display: 'inline-block',
            width: 1.5,
            height: '0.95em',
            background: 'var(--ink-3)',
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'nx-tw-caret 0.85s steps(2, end) infinite',
          }}
        />
      )}
    </>
  )
}
