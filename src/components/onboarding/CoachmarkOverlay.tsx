// SPDX-License-Identifier: MIT
import { useEffect, useState, type CSSProperties } from 'react'
import { ONBOARDING_STEP_COUNT, ONBOARDING_STEPS } from './onboardingSteps'
import { useT } from '@/i18n'
import { useGraphStore } from '@/store'
import { hoverStyle } from '@/lib/hoverStyle'

interface Hole {
  x: number
  y: number
  w: number
  h: number
  r: number
}

interface Props {
  stepIndex: number
  /** Review was opened during the tour — completes the final step. */
  reviewOpened: boolean
  onSkip: () => void
  onNext: () => void
}

const SCRIM = 'rgba(26, 24, 20, 0.46)'
const CARD_W = 300
const CARD_EST_H = 168

/** Steps whose anchor is a small round control get a tighter, pill-shaped hole. */
function isRoundTarget(id: string): boolean {
  return id === 'review-button' || id === 'connect-handle'
}

function sameHole(a: Hole | null, b: Hole): boolean {
  return (
    a != null &&
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5 &&
    a.r === b.r
  )
}

export function CoachmarkOverlay({ stepIndex, reviewOpened, onSkip, onNext }: Props) {
  const t = useT()
  const step = ONBOARDING_STEPS[stepIndex]
  // Reactive: the CTA stays disabled until the real action for this step is done.
  const complete = useGraphStore((s) => (step ? step.isComplete(s, reviewOpened) : false))
  const [hole, setHole] = useState<Hole | null>(null)

  // Continuously track the anchor: React Flow pans/zooms and inspector layout
  // shifts don't fire scroll/resize, and the target can appear a few frames late.
  useEffect(() => {
    if (!step) return
    let raf = 0
    const tick = () => {
      const el = document.querySelector(`[data-onboarding="${step.id}"]`)
      if (el) {
        const rect = el.getBoundingClientRect()
        const round = isRoundTarget(step.id)
        const pad = round ? 7 : 10
        const next: Hole = {
          x: rect.left - pad,
          y: rect.top - pad,
          w: rect.width + pad * 2,
          h: rect.height + pad * 2,
          r: round ? 999 : 12,
        }
        setHole((prev) => (sameHole(prev, next) ? prev : next))
      } else {
        setHole((prev) => (prev === null ? prev : null))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step])

  if (!step) return null
  const copy = t.onboarding.tour.steps[step.i18nKey]
  const stepNum = String(stepIndex + 1).padStart(2, '0')
  const totalNum = String(ONBOARDING_STEP_COUNT).padStart(2, '0')

  let tipStyle: CSSProperties
  if (hole) {
    const belowTop = hole.y + hole.h + 14
    const placeAbove = belowTop + CARD_EST_H > window.innerHeight
    const left = Math.min(Math.max(16, hole.x), window.innerWidth - CARD_W - 16)
    tipStyle = {
      position: 'fixed',
      width: CARD_W,
      zIndex: 67,
      left,
      top: placeAbove ? hole.y - 14 : belowTop,
      transform: placeAbove ? 'translateY(-100%)' : 'none',
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 65, pointerEvents: 'none' }}>
      {hole ? (
        <>
          <div
            style={{
              position: 'fixed',
              left: hole.x,
              top: hole.y,
              width: hole.w,
              height: hole.h,
              borderRadius: hole.r,
              boxShadow: `0 0 0 9999px ${SCRIM}`,
              transition:
                'left 0.18s var(--ease), top 0.18s var(--ease), width 0.18s var(--ease), height 0.18s var(--ease)',
              pointerEvents: 'none',
              zIndex: 65,
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: hole.x,
              top: hole.y,
              width: hole.w,
              height: hole.h,
              borderRadius: hole.r,
              border: '1.5px dashed var(--accent)',
              transition:
                'left 0.18s var(--ease), top 0.18s var(--ease), width 0.18s var(--ease), height 0.18s var(--ease)',
              pointerEvents: 'none',
              zIndex: 66,
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: SCRIM,
            pointerEvents: 'none',
            zIndex: 65,
          }}
        />
      )}

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            <button
              type="button"
              onClick={onNext}
              disabled={!complete}
              style={{
                appearance: 'none',
                border: '0.5px solid var(--ink-2)',
                background: 'var(--ink-2)',
                color: 'var(--paper)',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                cursor: complete ? 'pointer' : 'not-allowed',
                opacity: complete ? 1 : 0.45,
              }}
              {...(complete
                ? hoverStyle({ background: 'var(--ink)' }, { background: 'var(--ink-2)' })
                : {})}
            >
              {copy.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
