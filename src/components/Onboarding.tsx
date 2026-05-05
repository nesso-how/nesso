// SPDX-License-Identifier: AGPL-3.0
import { useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

const STEPS = [
  {
    kicker: 'Welcome',
    title: <>This is <i style={{ color: 'var(--cat-causal)' }}>Nesso</i>.</>,
    body: 'A knowledge graph for active learning. You build the graph — concept by concept, relation by relation. The mentor only asks.',
  },
  {
    kicker: 'Concepts',
    title: 'Words on paper.',
    body: 'Each concept is a single phrase. No chips, no icons. The graph stays readable because the chrome is in the relations, not the nodes.',
  },
  {
    kicker: 'Relations',
    title: 'Seventeen kinds of edge.',
    body: 'Six categories — taxonomic, structural, causal, dependency, temporal, opposition — each with its own color. Line style and a small glyph disambiguate within.',
  },
  {
    kicker: 'Mentor',
    title: 'Socratic, not generative.',
    body: 'The mentor will not draw the graph for you. It will challenge it: where it\'s vague, where it\'s stale, where you\'re confident without reason.',
  },
]

export function Onboarding({ open, onClose }: Props) {
  const [step, setStep] = useState(0)
  if (!open) return null
  const s = STEPS[step]

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80,
      background: 'rgba(20, 18, 14, 0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 520, maxWidth: '92vw',
        background: 'var(--bg-card)',
        border: '0.5px solid var(--line)',
        borderRadius: 18,
        padding: '32px 36px 24px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{
          font: "500 11px 'JetBrains Mono', ui-monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--cat-causal)',
          marginBottom: 12,
        }}>
          {s.kicker} · {step + 1} of {STEPS.length}
        </div>

        <h2 style={{
          margin: 0,
          font: "500 38px/1.1 'Fraunces', ui-serif, serif",
          letterSpacing: '-0.02em',
        }}>
          {s.title}
        </h2>

        <p style={{
          margin: '16px 0 0',
          font: "400 16px/1.55 'Fraunces', serif",
          color: 'var(--ink-2)',
        }}>
          {s.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 28 }}>
          {/* Progress pips */}
          <div style={{ display: 'flex', gap: 5 }}>
            {STEPS.map((_, i) => (
              <span key={i} style={{
                width: i === step ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? 'var(--ink)' : 'var(--ink-5)',
                transition: 'all 0.25s',
                display: 'inline-block',
              }} />
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <Btn onClick={() => setStep(s => s - 1)}>Back</Btn>
          )}
          {step < STEPS.length - 1
            ? <Btn primary onClick={() => setStep(s => s + 1)}>Continue</Btn>
            : <Btn primary onClick={onClose}>Begin</Btn>
          }
        </div>
      </div>
    </div>
  )
}

function Btn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      appearance: 'none',
      border: primary ? 0 : '0.5px solid var(--line)',
      background: primary ? 'var(--ink)' : 'transparent',
      color: primary ? 'var(--paper)' : 'var(--ink-2)',
      font: "500 12px 'JetBrains Mono', ui-monospace",
      padding: '8px 16px',
      borderRadius: 999,
      cursor: 'default',
    }}>
      {children}
    </button>
  )
}
