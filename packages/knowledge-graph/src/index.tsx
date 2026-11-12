import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'
import { Maximize, Redo2, Undo2 } from 'lucide-react'
import type { NessoStore, Selection } from '@nesso-how/core'
import { defaultLocale } from '@nesso-how/i18n'
import { bounds, draw, readTheme, relationLabels, type Transform } from './draw.ts'
import {
  remember,
  scene,
  settle,
  simulation,
  type Bubble,
  type KnowledgeGraphLayout,
} from './layout.ts'
import { translate } from './i18n/index.ts'

export type { KnowledgeGraphLayout } from './layout.ts'
export type KnowledgeGraphHandle = { readonly focusConcept: (id: string) => void }
type Point = { readonly x: number; readonly y: number }

const padding = 48
const duration = 300

const Controls = ({ className, children }: { className: string; children: ReactNode }) => (
  <div
    className={`absolute left-[15px] flex gap-0.5 overflow-hidden rounded-(--radius-control) border border-border bg-background p-0.5 ${className}`}
  >
    {children}
  </div>
)

const ControlButton = ({
  label,
  shortcut,
  ...props
}: {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) => (
  <button
    type="button"
    title={shortcut ? `${label} (${shortcut.toUpperCase()})` : label}
    aria-label={label}
    aria-keyshortcuts={shortcut}
    className="flex size-7 items-center justify-center rounded-(--radius-control) bg-background text-[color-mix(in_srgb,var(--foreground)_20%,var(--muted-foreground))] outline-none hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:bg-pressed disabled:bg-background disabled:text-muted-foreground pointer-coarse:size-11 [&_svg]:size-3.5 disabled:[&_svg]:[stroke-opacity:0.4]"
    {...props}
  />
)

export function KnowledgeGraph({
  ref,
  store,
  layout,
  readOnly = false,
  focusRef,
  onOpen,
}: {
  ref?: Ref<KnowledgeGraphHandle>
  store: Pick<NessoStore, 'getState' | 'subscribe' | 'applyOperations' | 'undo' | 'redo'>
  layout: KnowledgeGraphLayout
  readOnly?: boolean
  focusRef?: RefObject<HTMLDivElement | null>
  onOpen?: (id: string, point: Point) => void
}) {
  const t = translate(
    useSyncExternalStore(
      store.subscribe,
      () => store.getState().preferences.locale ?? defaultLocale,
    ),
  )
  const canUndo = useSyncExternalStore(store.subscribe, () => store.getState().history.canUndo)
  const canRedo = useSyncExternalStore(store.subscribe, () => store.getState().history.canRedo)
  const canvas = useRef<HTMLCanvasElement>(null)
  const marquee = useRef<HTMLDivElement>(null)
  const recenter = useRef(() => {})
  const focus = useRef<(id: string) => void>(() => {})
  const open = useRef(onOpen)
  useLayoutEffect(() => {
    open.current = onOpen
  }, [onOpen])
  useImperativeHandle(ref, () => ({ focusConcept: (id) => focus.current(id) }), [])

  useEffect(() => {
    const element = canvas.current!
    const context = element.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let graph = store.getState().graph
    let current = settle(graph, layout)
    let byId = new Map(current.bubbles.map((bubble) => [bubble.id, bubble]))
    let hovered: string | null = null
    let pending: string[] = []
    let frame = 0
    let motion = 0
    let transform: Transform = { x: 0, y: 0, k: 1 }
    const render = () => {
      frame = 0
      const ratio = window.devicePixelRatio || 1
      const state = store.getState()
      const style = getComputedStyle(element)
      const ids = (kind: Selection[number]['kind']) =>
        new Set(state.selected.filter((item) => item.kind === kind).map(({ id }) => id))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw(
        context,
        { ...current, labels: relationLabels(state) },
        readTheme((token) => style.getPropertyValue(`--${token}`).trim()),
        transform,
        {
          concepts: new Set([...ids('concept'), ...pending]),
          relations: ids('relation'),
          hovered,
        },
      )
    }
    const invalidate = () => {
      frame ||= requestAnimationFrame(render)
    }
    const animate = (bubbles: Bubble[], lines: typeof current.lines) =>
      simulation(bubbles, lines).on('tick', () => {
        remember(current.bubbles, layout)
        invalidate()
      })
    let forces = animate(current.bubbles, current.lines)
    const move = (next: Transform) => {
      if (reduced) {
        transform = next
        invalidate()
        return
      }
      const from = transform
      const start = performance.now()
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        const eased = 1 - (1 - progress) ** 3
        transform = {
          x: from.x + (next.x - from.x) * eased,
          y: from.y + (next.y - from.y) * eased,
          k: from.k + (next.k - from.k) * eased,
        }
        render()
        if (progress < 1) motion = requestAnimationFrame(step)
      }
      cancelAnimationFrame(motion)
      motion = requestAnimationFrame(step)
    }
    const fit = () => {
      const { clientWidth: width, clientHeight: height } = element
      if (!current.bubbles.length || !width || !height) return
      const box = bounds(current.bubbles)
      const k = Math.min(
        1.2,
        (width - padding * 2) / box.width,
        (height - padding * 2) / box.height,
      )
      return {
        k,
        x: width / 2 - (box.x + box.width / 2) * k,
        y: height / 2 - (box.y + box.height / 2) * k,
      }
    }
    transform = fit() ?? transform
    recenter.current = () => {
      const next = fit()
      if (next) move(next)
    }
    focus.current = (id) => {
      const bubble = byId.get(id)
      if (!bubble) return
      const k = Math.max(transform.k, 1)
      move({
        k,
        x: element.clientWidth / 2 - bubble.x! * k,
        y: element.clientHeight / 2 - bubble.y! * k,
      })
      focusRef?.current?.focus()
    }
    const unsubscribe = store.subscribe(() => {
      const state = store.getState()
      if (state.graph !== graph) {
        graph = state.graph
        const lines = new Set(current.lines.map(({ id }) => id))
        const next = scene(graph, layout, byId)
        const changed =
          next.bubbles.length !== current.bubbles.length ||
          next.lines.length !== current.lines.length ||
          next.bubbles.some(({ id }) => !byId.has(id)) ||
          next.lines.some(({ id }) => !lines.has(id))
        current = next
        byId = new Map(current.bubbles.map((bubble) => [bubble.id, bubble]))
        if (changed) {
          forces.stop()
          forces = animate(current.bubbles, current.lines).alpha(0.3)
          if (reduced) forces.tick(300)
          else forces.restart()
          remember(current.bubbles, layout)
        }
      }
      invalidate()
    })
    const resize = new ResizeObserver(() => {
      const ratio = window.devicePixelRatio || 1
      element.width = Math.round(element.clientWidth * ratio)
      element.height = Math.round(element.clientHeight * ratio)
      render()
    })
    resize.observe(element)
    const local = (event: { clientX: number; clientY: number }) => {
      const rect = element.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const world = (event: PointerEvent | MouseEvent) => {
      const point = local(event)
      return { x: (point.x - transform.x) / transform.k, y: (point.y - transform.y) / transform.k }
    }
    const hit = (event: PointerEvent | MouseEvent) => {
      const { x, y } = world(event)
      return current.bubbles.findLast(
        (bubble) => Math.hypot(bubble.x! - x, bubble.y! - y) <= bubble.radius + 4 / transform.k,
      )
    }
    const hitLine = (event: PointerEvent) => {
      const { x, y } = world(event)
      return current.lines.findLast(({ source, target }) => {
        const dx = target.x! - source.x!
        const dy = target.y! - source.y!
        const along = Math.max(
          0,
          Math.min(1, ((x - source.x!) * dx + (y - source.y!) * dy) / (dx * dx + dy * dy || 1)),
        )
        return Math.hypot(source.x! + along * dx - x, source.y! + along * dy - y) <= 5 / transform.k
      })
    }
    const select = (item: Selection[number] | undefined, event: PointerEvent) => {
      const { selected } = store.getState()
      const toggle = event.shiftKey || event.metaKey || event.ctrlKey
      if (!item) {
        if (!toggle && selected.length)
          store.applyOperations([{ kind: 'selection.set', value: [] }])
        return
      }
      const same = ({ kind, id }: Selection[number]) => kind === item.kind && id === item.id
      store.applyOperations([
        {
          kind: 'selection.set',
          value: !toggle
            ? [item]
            : selected.some(same)
              ? selected.filter((entry) => !same(entry))
              : [...selected, item],
        },
      ])
    }
    const area = marquee.current!
    let gesture: {
      bubble?: Bubble
      area: boolean
      start: Point
      origin: Transform
      moved: boolean
    } | null = null
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      element.setPointerCapture(event.pointerId)
      const bubble = hit(event)
      gesture = {
        bubble,
        area: !bubble && event.shiftKey,
        start: local(event),
        origin: transform,
        moved: false,
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!gesture) {
        const next = hit(event)?.id ?? hitLine(event)?.id ?? null
        if (next === hovered) return
        hovered = next
        element.style.cursor = hovered ? 'pointer' : ''
        invalidate()
        return
      }
      const point = local(event)
      const dx = point.x - gesture.start.x
      const dy = point.y - gesture.start.y
      if (!gesture.moved && Math.hypot(dx, dy) < 4) return
      if (!gesture.moved && gesture.bubble) forces.alphaTarget(0.3).restart()
      gesture.moved = true
      if (gesture.area) {
        Object.assign(area.style, {
          display: 'block',
          left: `${Math.min(point.x, gesture.start.x)}px`,
          top: `${Math.min(point.y, gesture.start.y)}px`,
          width: `${Math.abs(dx)}px`,
          height: `${Math.abs(dy)}px`,
        })
        const [left, right] = [gesture.start.x, point.x].sort((a, b) => a - b)
        const [top, bottom] = [gesture.start.y, point.y].sort((a, b) => a - b)
        pending = current.bubbles
          .filter((bubble) => {
            const x = bubble.x! * transform.k + transform.x
            const y = bubble.y! * transform.k + transform.y
            return x >= left && x <= right && y >= top && y <= bottom
          })
          .map(({ id }) => id)
        invalidate()
        return
      }
      if (gesture.bubble) {
        gesture.bubble.fx = (point.x - transform.x) / transform.k
        gesture.bubble.fy = (point.y - transform.y) / transform.k
      } else transform = { ...gesture.origin, x: gesture.origin.x + dx, y: gesture.origin.y + dy }
      invalidate()
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!gesture) return
      if (!gesture.moved && event.type === 'pointerup') {
        const line = gesture.bubble ? undefined : hitLine(event)
        select(
          gesture.bubble
            ? { kind: 'concept', id: gesture.bubble.id }
            : line && { kind: 'relation', id: line.id },
          event,
        )
      }
      if (gesture.area && gesture.moved) {
        area.style.display = 'none'
        const { selected } = store.getState()
        const chosen = new Set(selected.map(({ id }) => id))
        const added = pending.filter((id) => !chosen.has(id))
        pending = []
        invalidate()
        if (event.type === 'pointerup' && added.length)
          store.applyOperations([
            {
              kind: 'selection.set',
              value: [...selected, ...added.map((id) => ({ kind: 'concept' as const, id }))],
            },
          ])
      }
      if (gesture.bubble && gesture.moved) {
        gesture.bubble.fx = gesture.bubble.fy = null
        forces.alphaTarget(0)
      }
      gesture = null
    }
    const onDoubleClick = (event: MouseEvent) => {
      const bubble = hit(event)
      if (bubble) open.current?.(bubble.id, { x: event.clientX, y: event.clientY })
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const point = local(event)
      const delta = event.deltaY * (event.deltaMode === 1 ? 20 : 1) * (event.ctrlKey ? 5 : 1)
      const k = Math.min(4, Math.max(0.1, transform.k * Math.exp(-delta * 0.002)))
      transform = {
        k,
        x: point.x - ((point.x - transform.x) * k) / transform.k,
        y: point.y - ((point.y - transform.y) * k) / transform.k,
      }
      invalidate()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.metaKey || event.ctrlKey || event.altKey) return
      recenter.current()
    }
    const onLeave = () => {
      if (hovered === null) return
      hovered = null
      invalidate()
    }
    const container = element.parentElement!
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerUp)
    element.addEventListener('pointerleave', onLeave)
    element.addEventListener('dblclick', onDoubleClick)
    element.addEventListener('wheel', onWheel, { passive: false })
    container.addEventListener('keydown', onKeyDown)
    return () => {
      forces.stop()
      unsubscribe()
      resize.disconnect()
      cancelAnimationFrame(frame)
      cancelAnimationFrame(motion)
      focus.current = () => {}
      recenter.current = () => {}
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerUp)
      element.removeEventListener('pointerleave', onLeave)
      element.removeEventListener('dblclick', onDoubleClick)
      element.removeEventListener('wheel', onWheel)
      container.removeEventListener('keydown', onKeyDown)
    }
  }, [store, layout, focusRef])

  return (
    <div
      ref={focusRef}
      tabIndex={0}
      role="application"
      aria-label={t('overview')}
      className="relative h-full w-full outline-none"
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" />
      <div
        ref={marquee}
        aria-hidden="true"
        className="pointer-events-none absolute hidden border border-primary bg-(--selection-halo)"
      />
      <Controls className="bottom-[15px]">
        <ControlButton label={t('fitView')} shortcut="f" onClick={() => recenter.current()}>
          <Maximize aria-hidden="true" />
        </ControlButton>
      </Controls>
      {!readOnly && (
        <Controls className="top-[15px]">
          <ControlButton label={t('undo')} onClick={store.undo} disabled={!canUndo}>
            <Undo2 aria-hidden="true" />
          </ControlButton>
          <ControlButton label={t('redo')} onClick={store.redo} disabled={!canRedo}>
            <Redo2 aria-hidden="true" />
          </ControlButton>
        </Controls>
      )}
    </div>
  )
}
