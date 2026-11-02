import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { useViewActionBadge } from '@/plugins'

export function ActionBadge({
  actionId,
  viewId,
  label,
  inline = false,
}: {
  actionId: string
  viewId: string | null
  label: string
  inline?: boolean
}) {
  const element = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const value = useViewActionBadge(actionId, viewId, visible)
  const count = value !== null && value > 0 ? value : null
  const t = useTranslation()
  const announcement = count === null ? null : `${label}, ${t('actionBadgeCount', { count })}`
  useEffect(() => {
    const target = element.current?.parentElement
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(target)
    if (announcement === null) {
      target.style.paddingRight = ''
      target.removeAttribute('aria-label')
    } else {
      if (!inline) target.style.paddingRight = `${Math.ceil(element.current?.offsetWidth ?? 14)}px`
      target.setAttribute('aria-label', announcement)
    }
    return () => observer.disconnect()
  }, [announcement, count, inline])
  return (
    <span
      ref={element}
      aria-hidden={count !== null}
      className={
        count !== null
          ? inline
            ? 'pointer-events-none inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ecd8d4] px-[3px] text-[9px] font-semibold leading-none text-[#75443c] tabular-nums'
            : 'pointer-events-none absolute -top-0.5 -right-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ecd8d4] px-[3px] text-[9px] font-semibold leading-none text-[#75443c] ring-2 ring-background tabular-nums'
          : undefined
      }
    >
      {count}
    </span>
  )
}
