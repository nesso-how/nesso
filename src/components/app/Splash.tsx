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
        <path
          className="splash-wordmark"
          d="M39.667 22h-2.071v-9.804h2.071v1.672h.095q.152-.38.389-.732.238-.351.58-.607.342-.257.798-.409t1.064-.152q1.482 0 2.394.969t.912 2.755V22h-2.071v-6.004q0-2.337-2.033-2.337-.399 0-.779.105-.38.104-.684.313t-.485.532q-.18.323-.18.741zm13.642.228q-1.121 0-2.014-.361t-1.501-1.026-.931-1.605-.323-2.119.332-2.128.931-1.625q.599-.674 1.454-1.035t1.9-.361q1.026 0 1.862.351.836.352 1.425.998t.902 1.539q.314.893.314 1.976v.779h-7.03v.323q0 1.159.722 1.891.722.731 1.995.731.95 0 1.624-.408.675-.409 1.093-1.093l1.292 1.14q-.494.855-1.51 1.444t-2.537.589m-.152-8.683q-.551 0-1.017.19t-.797.542q-.333.351-.523.826t-.19 1.045v.133h4.921v-.19q0-1.159-.656-1.852-.655-.694-1.738-.694m11.362 8.683q-1.596 0-2.746-.513t-1.852-1.368l1.273-1.14q.646.703 1.453 1.073.808.371 1.91.371 1.007 0 1.624-.342t.618-1.064q0-.304-.114-.513t-.323-.342-.485-.209-.579-.114l-1.558-.247q-.57-.076-1.159-.247t-1.055-.485q-.465-.313-.76-.807-.294-.494-.294-1.254 0-1.501 1.149-2.28t3.031-.779q1.368 0 2.365.409.998.408 1.663 1.13l-1.159 1.216q-.38-.437-1.083-.808-.703-.37-1.862-.37-2.071 0-2.071 1.311 0 .627.446.865.447.237 1.055.313l1.558.247q.589.095 1.169.247.579.152 1.045.466.465.313.759.807.295.494.295 1.254 0 1.482-1.149 2.328t-3.164.845m11.4 0q-1.596 0-2.745-.513t-1.853-1.368l1.273-1.14q.646.703 1.453 1.073.808.371 1.91.371 1.007 0 1.625-.342.617-.342.617-1.064 0-.304-.114-.513t-.323-.342-.484-.209-.58-.114l-1.558-.247q-.57-.076-1.159-.247t-1.054-.485q-.466-.313-.761-.807-.294-.494-.294-1.254 0-1.501 1.15-2.28t3.03-.779q1.368 0 2.366.409.997.408 1.662 1.13l-1.159 1.216q-.38-.437-1.083-.808-.703-.37-1.862-.37-2.071 0-2.071 1.311 0 .627.447.865.446.237 1.054.313l1.558.247q.589.095 1.169.247.579.152 1.045.466.465.313.76.807.294.494.294 1.254 0 1.482-1.149 2.328t-3.164.845m11.381 0q-1.083 0-1.947-.361t-1.463-1.026-.922-1.615-.323-2.128.323-2.128.922-1.615 1.463-1.026 1.947-.361 1.948.361q.864.361 1.463 1.026.598.665.921 1.615t.323 2.128-.323 2.128-.921 1.615-1.463 1.026-1.948.361m0-1.634q1.14 0 1.815-.693.674-.694.674-2.062v-1.482q0-1.368-.674-2.061-.675-.694-1.815-.694t-1.814.694q-.675.693-.675 2.061v1.482q0 1.368.675 2.062.674.693 1.814.693"
          fill="var(--foreground, #292929)"
        />
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
