import { useEffect, useRef, useState, type CSSProperties } from 'react'

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

export function Splash({
  ready,
  animate,
  onDone,
}: {
  ready: boolean
  animate: boolean
  onDone: () => void
}) {
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [elapsed, setElapsed] = useState(!animate)
  const fading = ready && elapsed && animate && !reduced
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    title.current?.focus({ preventScroll: true })
    if (!animate) return
    const id = setTimeout(() => setElapsed(true), reduced ? 400 : 900)
    return () => clearTimeout(id)
  }, [animate, reduced])
  useEffect(() => {
    if (!ready || !elapsed) return
    if (reduced || !animate) {
      onDone()
      return
    }
    const id = setTimeout(onDone, 180)
    return () => clearTimeout(id)
  }, [ready, elapsed, reduced, animate, onDone])
  return (
    <section
      className={['splash', animate && !reduced ? 'is-playing' : null, fading ? 'is-fading' : null]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby="splash-title"
      aria-busy={!ready}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return
        event.preventDefault()
        setElapsed(true)
      }}
    >
      <svg className="splash-logo" viewBox="0 0 148 32" role="img" aria-label="Nesso">
        <g fill="var(--primary, #393939)">
          {pixels.map(({ x, y }, index) => (
            <rect
              key={`${x}-${y}`}
              className="splash-pixel"
              style={{ '--i': index } as CSSProperties}
              x={x}
              y={y}
              width={4}
              height={4}
            />
          ))}
        </g>
        <text
          className="splash-wordmark"
          x={36}
          y={22}
          fontSize={19}
          fontWeight={500}
          fill="var(--foreground, #292929)"
        >
          nesso
        </text>
        <rect
          className="splash-underline"
          x={95}
          y={25}
          width={15}
          height={2}
          fill="var(--primary, #393939)"
        />
      </svg>
      <h1 id="splash-title" ref={title} tabIndex={-1} className="sr-only">
        Nesso
      </h1>
    </section>
  )
}
