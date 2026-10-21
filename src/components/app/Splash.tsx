import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

const pixels = [
  { x: 6, y: 6 },
  { x: 22, y: 6 },
  { x: 6, y: 10 },
  { x: 10, y: 10 },
  { x: 22, y: 10 },
  { x: 6, y: 14 },
  { x: 14, y: 14 },
  { x: 22, y: 14 },
  { x: 6, y: 18 },
  { x: 18, y: 18 },
  { x: 22, y: 18 },
  { x: 6, y: 22 },
  { x: 22, y: 22 },
]

export function Splash({ onDone }: { onDone: () => void }) {
  const saved = useRef(onDone)
  const finished = useRef(false)
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [fading, setFading] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    saved.current = onDone
  })
  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    if (reduced) {
      saved.current()
      return
    }
    setFading(true)
    setTimeout(() => saved.current(), 180)
  }, [reduced])
  useEffect(() => {
    title.current?.focus({ preventScroll: true })
    const id = setTimeout(finish, reduced ? 400 : 900)
    return () => clearTimeout(id)
  }, [finish, reduced])
  return (
    <section
      className={['splash', reduced ? null : 'is-playing', fading ? 'is-fading' : null].filter(Boolean).join(' ')}
      aria-labelledby="splash-title"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return
        event.preventDefault()
        finish()
      }}
    >
      <svg className="splash-logo" viewBox="0 0 148 32" role="img" aria-label="Nesso">
        <g fill="var(--primary)">
          {pixels.map(({ x, y }, index) => (
            <rect key={`${x}-${y}`} className="splash-pixel" style={{ '--i': index } as CSSProperties} x={x} y={y} width={4} height={4} />
          ))}
        </g>
        <text className="splash-wordmark" x={36} y={22} fontSize={19} fontWeight={500} fill="var(--foreground)">nesso</text>
        <rect className="splash-underline" x={95} y={25} width={15} height={2} fill="var(--primary)" />
      </svg>
      <h1 id="splash-title" ref={title} tabIndex={-1} className="sr-only">Nesso</h1>
    </section>
  )
}
