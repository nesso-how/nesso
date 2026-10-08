import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { CircleHelp, Info, TriangleAlert, X } from 'lucide-react'
import { Button } from './button'

type ToastAction = { label: string; onClick: () => void }

export type ToastItem = {
  id: string
  label: string
  title: string
  description?: string
} & (
  | { tone: 'info'; duration?: number; action?: ToastAction }
  | { tone: 'warning'; action?: ToastAction }
  | { tone: 'request'; action: ToastAction; cancelAction: ToastAction }
)

function useToastLifecycle({ id, duration, onDismiss, onRestoreFocus }: {
  id: string
  duration: number
  onDismiss: (id: string) => void
  onRestoreFocus: () => void
}) {
  const card = useRef<HTMLDivElement>(null)
  const remaining = useRef(duration)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(() => document.hidden)
  const [leaving, setLeaving] = useState(false)
  const paused = hovered || focused || hidden
  const dismiss = useCallback(() => setLeaving(true), [])

  useEffect(() => {
    const update = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    if (!duration || paused || leaving) return
    const started = performance.now()
    const timer = window.setTimeout(dismiss, remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (performance.now() - started))
    }
  }, [duration, paused, leaving, dismiss])

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => {
      if (card.current?.contains(document.activeElement)) onRestoreFocus()
      onDismiss(id)
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140)
    return () => window.clearTimeout(timer)
  }, [leaving, id, onDismiss, onRestoreFocus])

  return { card, setHovered, setFocused, paused, leaving, dismiss }
}

const toastIcons = { info: Info, warning: TriangleAlert, request: CircleHelp }

function ToastCard({ item, closeLabel, onDismiss, onRestoreFocus }: {
  item: ToastItem
  closeLabel: string
  onDismiss: (id: string) => void
  onRestoreFocus: () => void
}) {
  const duration = item.tone === 'info' ? item.duration ?? 6000 : 0
  const { card, setHovered, setFocused, paused, leaving, dismiss } = useToastLifecycle({ id: item.id, duration, onDismiss, onRestoreFocus })
  const Icon = toastIcons[item.tone]

  const act = (action: ToastAction) => {
    if (leaving) return
    action.onClick()
    dismiss()
  }

  return (
    <div
      ref={card}
      data-slot="toast"
      data-tone={item.tone}
      data-leaving={leaving || undefined}
      className="nesso-toast"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
    >
      <p className="sr-only" role={item.tone === 'warning' ? 'alert' : 'status'} aria-atomic="true">
        {item.label}: {item.title}. {item.description}
      </p>
      <Icon className="toast-icon" aria-hidden="true" />
      <div className="toast-content">
        <span className="toast-label">{item.label}</span>
        <h2 className="toast-title">{item.title}</h2>
        {item.description && <p className="toast-description">{item.description}</p>}
      </div>
      {item.tone !== 'request' && <Button variant="ghost" size="icon-sm" className="toast-close" aria-label={`${closeLabel}: ${item.title}`} disabled={leaving} onClick={dismiss}><X /></Button>}
      {item.action && (
        <div className="toast-actions">
          {item.tone === 'request' && <Button size="sm" variant="ghost" disabled={leaving} onClick={() => act(item.cancelAction)}>{item.cancelAction.label}</Button>}
          <Button size="sm" variant={item.tone === 'request' ? 'default' : 'outline'} disabled={leaving} onClick={() => { if (item.action) act(item.action) }}>{item.action.label}</Button>
        </div>
      )}
      {duration > 0 && <div aria-hidden="true" className="toast-progress" style={{ '--toast-duration': `${duration}ms`, animationPlayState: paused || leaving ? 'paused' : 'running' } as CSSProperties} />}
    </div>
  )
}

export function ToastViewport({ items, label, closeLabel, queueLabel, onDismiss, onRestoreFocus }: {
  items: readonly ToastItem[]
  label: string
  closeLabel: string
  queueLabel: string
  onDismiss: (id: string) => void
  onRestoreFocus: () => void
}) {
  if (items.length === 0) return null
  return (
    <section className="toast-viewport" aria-label={label}>
      {items.length > 3 && <p className="toast-queue" role="status">{queueLabel}</p>}
      <div className="toast-stack">
        {items.slice(0, 3).map((item) => <ToastCard key={item.id} item={item} closeLabel={closeLabel} onDismiss={onDismiss} onRestoreFocus={onRestoreFocus} />)}
      </div>
    </section>
  )
}
