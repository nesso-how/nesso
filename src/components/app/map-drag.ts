import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

export type MapDrag = { readonly kind: 'pin' | 'map' | 'group'; readonly id: string }
export type MapDrop = {
  readonly groupId: string | null
  readonly beforeId: string | null
  readonly key: string
  readonly position: 'before' | 'after' | 'into'
}

const threshold = 4
const edge = 32

const insertion = (items: readonly HTMLElement[], y: number, id: (item: HTMLElement) => string) => {
  const before = items.find((item) => {
    const { top, height } = item.getBoundingClientRect()
    return y < top + height / 2
  })
  const target = before ?? items.at(-1)
  return (
    target &&
    ({
      beforeId: before ? id(before) : null,
      key: target.dataset.dropKey!,
      position: before ? 'before' : 'after',
    } as const)
  )
}

const groupDrop = (sections: readonly HTMLElement[], id: string, y: number): MapDrop | null => {
  const groups = sections.filter(
    ({ dataset }) => dataset.mapSection === 'group' && dataset.id !== id,
  )
  const drop = insertion(groups, y, ({ dataset }) => dataset.id!)
  return drop ? { ...drop, groupId: null } : null
}

const mapDrop = (section: HTMLElement | undefined, drag: MapDrag, y: number): MapDrop | null => {
  if (!section) return null
  const groupId = section.dataset.mapSection === 'group' ? section.dataset.id! : null
  const rows = [...section.querySelectorAll<HTMLElement>('[data-map-row]')].filter(
    (row) => row.dataset.mapRow !== drag.id && row.getClientRects().length > 0,
  )
  const drop = insertion(rows, y, ({ dataset }) => dataset.mapRow!)
  if (drop) return { ...drop, groupId }
  if (drag.kind === 'pin') return null
  return { groupId, beforeId: null, key: section.dataset.dropKey!, position: 'into' }
}

const dropAt = (root: HTMLElement, drag: MapDrag, x: number, y: number): MapDrop | null => {
  const { left, right, top, bottom } = root.getBoundingClientRect()
  if (x < left || x > right || y < top || y > bottom) return null
  const sections = [...root.querySelectorAll<HTMLElement>('[data-map-section]')]
  if (drag.kind === 'group') return groupDrop(sections, drag.id, y)
  const pinned = (section: HTMLElement) => section.dataset.mapSection === 'pinned'
  return mapDrop(
    drag.kind === 'pin'
      ? sections.find(pinned)
      : sections
          .filter((section) => !pinned(section))
          .findLast((section) => section.getBoundingClientRect().top <= y),
    drag,
    y,
  )
}

const sameDrop = (a: MapDrop | null, b: MapDrop | null) =>
  a?.key === b?.key && a?.position === b?.position

export function useMapDrag(
  scroller: RefObject<HTMLElement | null>,
  onDrop: (drag: MapDrag, drop: MapDrop) => void,
) {
  const [state, setState] = useState<{ drag: MapDrag; drop: MapDrop | null } | null>(null)
  const stop = useRef<(() => void) | null>(null)
  useEffect(() => () => stop.current?.(), [])

  const start = (event: PointerEvent<HTMLElement>, drag: MapDrag) => {
    if (event.button !== 0 || event.pointerType === 'touch') return
    stop.current?.()
    const handle = event.currentTarget
    const { pointerId, clientX, clientY } = event
    let active = false
    let cancelled = false
    let x = clientX
    let y = clientY
    let frame = 0
    let drop: MapDrop | null = null
    const update = () => {
      const root = scroller.current
      const target = root && dropAt(root, drag, x, y)
      if (sameDrop(target, drop)) return
      drop = target
      setState({ drag, drop })
    }
    const scroll = () => {
      const root = scroller.current
      if (root) {
        const { top, bottom } = root.getBoundingClientRect()
        const offset = y < top + edge ? y - top - edge : y > bottom - edge ? y - bottom + edge : 0
        root.scrollTop += Math.max(-edge, Math.min(edge, offset)) / 2
      }
      update()
      frame = requestAnimationFrame(scroll)
    }
    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointerId || cancelled) return
      x = event.clientX
      y = event.clientY
      if (!active) {
        if (Math.hypot(x - clientX, y - clientY) < threshold) return
        active = true
        handle.setPointerCapture(pointerId)
        handle.addEventListener('lostpointercapture', cancel)
        window.getSelection()?.removeAllRanges()
        setState({ drag, drop })
        frame = requestAnimationFrame(scroll)
      }
      update()
    }
    const finish = (commit: boolean) => {
      stop.current?.()
      if (!active) return
      const swallow = (event: MouseEvent) => {
        const target = event.target
        if (!(target instanceof Node) || !(target.contains(handle) || handle.contains(target)))
          return
        event.preventDefault()
        event.stopPropagation()
        window.removeEventListener('click', swallow, true)
      }
      window.addEventListener('click', swallow, true)
      setTimeout(() => window.removeEventListener('click', swallow, true))
      if (commit && drop) onDrop(drag, drop)
    }
    const release = (event: globalThis.PointerEvent) => {
      if (event.pointerId === pointerId) finish(event.type === 'pointerup')
    }
    const cancel = () => finish(false)
    const key = (event: KeyboardEvent) => {
      if (!active || cancelled || event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      cancelled = true
      drop = null
      cancelAnimationFrame(frame)
      setState(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('keydown', key, true)
    window.addEventListener('blur', cancel)
    stop.current = () => {
      stop.current = null
      cancelAnimationFrame(frame)
      handle.removeEventListener('lostpointercapture', cancel)
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('blur', cancel)
      setState(null)
    }
  }

  return { drag: state?.drag ?? null, drop: state?.drop ?? null, start }
}
