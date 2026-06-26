// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ONBOARDING_STEP_COUNT, ONBOARDING_STEPS, type OnboardingStepId } from './onboardingSteps'
import { useT } from '@/i18n'
import { useGraphStore } from '@/store'
import { hoverStyle } from '@/lib/hoverStyle'

interface Hole {
  id: string
  x: number
  y: number
  w: number
  h: number
  r: number
}

interface Props {
  stepIndex: number
  onSkip: () => void
  onNext: () => void
}

const SCRIM = 'rgba(26, 24, 20, 0.46)'
const CARD_W = 300
const CARD_EST_H = 168

/** Anchors lit (and kept interactive) for each step. Most steps spotlight a
 *  single element; the connect step lights both the source handle and the whole
 *  destination node so the drag has a visible start and end. */
function anchorIdsForStep(id: OnboardingStepId): string[] {
  if (id === 'connect-handle') return ['connect-handle', 'connect-target']
  return [id]
}

/** Steps whose anchor is a small round control get a tighter, pill-shaped hole. */
function isRoundTarget(id: string): boolean {
  return id === 'review-button' || id === 'connect-handle'
}

/** Full-canvas anchors are already inset to the visible canvas; padding them
 *  would bleed the hole into the navbar and status bar. */
function isCanvasRegion(id: string): boolean {
  return id === 'add-concept' || id === 'second-concept' || id === 'delete-node'
}

function roundedRectPath({ x, y, w, h, r }: Hole): string {
  const rr = Math.min(r, w / 2, h / 2)
  return [
    `M${x + rr},${y}`,
    `h${w - 2 * rr}`,
    `a${rr},${rr} 0 0 1 ${rr},${rr}`,
    `v${h - 2 * rr}`,
    `a${rr},${rr} 0 0 1 ${-rr},${rr}`,
    `h${-(w - 2 * rr)}`,
    `a${rr},${rr} 0 0 1 ${-rr},${-rr}`,
    `v${-(h - 2 * rr)}`,
    `a${rr},${rr} 0 0 1 ${rr},${-rr}`,
    'z',
  ].join(' ')
}

function holesEqual(a: Hole[], b: Hole[]): boolean {
  if (a.length !== b.length) return false
  return a.every((h, i) => {
    const o = b[i]
    return (
      h.id === o.id &&
      Math.abs(h.x - o.x) < 0.5 &&
      Math.abs(h.y - o.y) < 0.5 &&
      Math.abs(h.w - o.w) < 0.5 &&
      Math.abs(h.h - o.h) < 0.5 &&
      h.r === o.r
    )
  })
}

export function CoachmarkOverlay({ stepIndex, onSkip, onNext }: Props) {
  const t = useT()
  const step = ONBOARDING_STEPS[stepIndex]
  // Reactive: the step auto-advances the moment its real action is done.
  const complete = useGraphStore((s) => (step ? step.isComplete(s) : false))
  const [holes, setHoles] = useState<Hole[]>([])

  // The action itself drives the tour: as soon as the step's action is done,
  // advance. The ref keys on stepIndex so a step advances at most once (and
  // React StrictMode's double-invoked effect cannot skip a step).
  const advancedFor = useRef<number | null>(null)
  useEffect(() => {
    if (complete && advancedFor.current !== stepIndex) {
      advancedFor.current = stepIndex
      onNext()
    }
  }, [complete, stepIndex, onNext])

  // Continuously track the anchors: React Flow pans/zooms and inspector layout
  // shifts don't fire scroll/resize, and a target can appear a few frames late.
  useEffect(() => {
    if (!step) return
    const ids = anchorIdsForStep(step.id)
    let raf = 0
    const tick = () => {
      const next: Hole[] = []
      for (const id of ids) {
        const el = document.querySelector(`[data-onboarding="${id}"]`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        const round = isRoundTarget(id)
        const pad = isCanvasRegion(id) ? 0 : round ? 7 : 10
        next.push({
          id,
          x: rect.left - pad,
          y: rect.top - pad,
          w: rect.width + pad * 2,
          h: rect.height + pad * 2,
          r: round ? 999 : 12,
        })
      }
      setHoles((prev) => (holesEqual(prev, next) ? prev : next))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step])

  if (!step) return null
  const copy = t.onboarding.tour.steps[step.i18nKey]
  const stepNum = String(stepIndex + 1).padStart(2, '0')
  const totalNum = String(ONBOARDING_STEP_COUNT).padStart(2, '0')

  // Bounding box of all holes, used to place the tip card clear of the lit area.
  let union: { x: number; y: number; w: number; h: number } | null = null
  if (holes.length) {
    const left = Math.min(...holes.map((h) => h.x))
    const top = Math.min(...holes.map((h) => h.y))
    const right = Math.max(...holes.map((h) => h.x + h.w))
    const bottom = Math.max(...holes.map((h) => h.y + h.h))
    union = { x: left, y: top, w: right - left, h: bottom - top }
  }

  // A focus area covering most of the screen (canvas steps) can't be dodged by
  // placing the card beside it — float it bottom-center instead.
  const big = union != null && union.w * union.h > window.innerWidth * window.innerHeight * 0.3

  let tipStyle: CSSProperties
  if (union && !big) {
    const belowTop = union.y + union.h + 14
    const placeAbove = belowTop + CARD_EST_H > window.innerHeight
    const left = Math.min(Math.max(16, union.x), window.innerWidth - CARD_W - 16)
    tipStyle = {
      position: 'fixed',
      width: CARD_W,
      zIndex: 67,
      left,
      top: placeAbove ? union.y - 14 : belowTop,
      transform: placeAbove ? 'translateY(-100%)' : 'none',
    }
  } else if (big) {
    tipStyle = {
      position: 'fixed',
      width: CARD_W,
      zIndex: 67,
      left: '50%',
      bottom: 96,
      transform: 'translateX(-50%)',
    }
  } else {
    tipStyle = {
      position: 'fixed',
      width: CARD_W,
      zIndex: 67,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  const w = window.innerWidth
  const h = window.innerHeight
  // Single evenodd path: fills the screen minus the holes, so it darkens
  // everything except the lit areas and — via `pointer-events: auto` on the
  // filled region only — captures (blocks) every interaction outside them.
  const scrimPath = `M0,0 H${w} V${h} H0 Z ${holes.map(roundedRectPath).join(' ')}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 65, pointerEvents: 'none' }}>
      <svg
        width={w}
        height={h}
        aria-hidden
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}
      >
        <path d={scrimPath} fillRule="evenodd" fill={SCRIM} style={{ pointerEvents: 'auto' }} />
        {holes.map((hole) => (
          <path
            key={hole.id}
            d={roundedRectPath(hole)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            style={{ pointerEvents: 'none' }}
          />
        ))}
      </svg>

      <div style={{ ...tipStyle, pointerEvents: 'auto' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '0.5px solid var(--line-strong)',
            borderRadius: 13,
            boxShadow: 'var(--shadow-lg)',
            padding: '18px 18px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 11,
            }}
          >
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ink-4)',
              }}
            >
              {copy.eyebrow}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-5)',
              }}
            >
              {stepNum} / {totalNum}
            </span>
          </div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 500,
              fontFamily: 'var(--font-display)',
              letterSpacing: 'var(--tracking-title)',
              color: 'var(--ink)',
              marginBottom: 7,
            }}
          >
            {copy.title}
          </div>
          <div
            style={{
              fontSize: '13px',
              lineHeight: 1.5,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink-3)',
              marginBottom: 16,
            }}
          >
            {copy.body}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onSkip}
              style={{
                appearance: 'none',
                border: 0,
                background: 'transparent',
                color: 'var(--ink-4)',
                fontSize: '11.5px',
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                padding: '6px 2px',
                whiteSpace: 'nowrap',
              }}
              {...hoverStyle({ color: 'var(--ink-2)' }, { color: 'var(--ink-4)' })}
            >
              {t.onboarding.tour.skipTour}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
