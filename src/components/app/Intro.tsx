import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button, useMediaQuery } from '@nesso-how/ui'
import { resolveRelationTypeLabel } from '@nesso-how/core'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { createIntroStore, introConnection, setIntroStep } from '@/store/intro'
import { useTranslation } from '@/i18n'
import { defaultLocale } from '@nesso-how/i18n'
import { useNessoStore } from '@/store'
import { resolveInspector } from '@/store/settings'
import { chat } from '@/ai'
import { AppSidebar } from './Sidebar'
import { Inspector } from './Inspector'
import { GraphWorkspace } from './GraphWorkspace'
import { ViewHeader } from './ViewHeader'
import reviewPackage from '../../../plugins/review/package.json'

const chapters = [
  { title: 'introConceptTitle', description: 'introConceptDescription' },
  { title: 'introConnectionsTitle', description: 'introConnectionsDescription' },
  { title: 'introViewsTitle', description: 'introViewsDescription' },
  { title: 'introReviewTitle', description: 'introReviewDescription' },
] as const

const lastStep = chapters.length - 1
const reviewTabs = [
  {
    id: 'review',
    key: 'intro-review',
    label: reviewPackage.i18n.metadata.name,
    icon: 'repeat',
    badge: true,
  },
] as const

export function Intro({ onFinish }: { onFinish: () => void }) {
  const t = useTranslation()
  const compact = useMediaQuery('(max-width: 767px)')
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const panels = useNessoStore((state) => state.preferences.panels)
  const vocab = useNessoStore((state) => state.vocabs.find(({ id }) => id === 'base-vocab')!)
  const { width: inspectorWidth, minWidth: inspectorMinWidth } = resolveInspector(panels, false)
  const [step, setStep] = useState(0)
  const title = useRef<HTMLHeadingElement>(null)
  const store = useMemo(() => createIntroStore(locale, vocab), [locale, vocab])
  const graph = useNessoStore((state) => state.graph, store)
  const selected = useNessoStore((state) => state.selected, store)
  const relation = graph.relations.find(
    ({ source, target }) => source === introConnection.source && target === introConnection.target,
  )
  const relationType = relation && graph.relationTypes.find(({ id }) => id === relation.predicate)
  const relationLabel =
    relationType && relationType.id !== vocab.defaultTypeId
      ? resolveRelationTypeLabel(relationType, [vocab], locale)
      : ''
  const inspectorOpen = step === 1 && selected.length === 1 && selected[0].kind === 'relation'
  const narrative = useRef<HTMLElement>(null)
  const [bottomInset, setBottomInset] = useState(0)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setBottomInset(entry.contentRect.height + 56))
    observer.observe(narrative.current!)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setIntroStep(store, step)
    title.current?.focus()
  }, [store, step])

  const progress = { step: step + 1, total: chapters.length }
  const description = t(chapters[step].description)

  return (
    <section
      className="intro"
      aria-label={t('discoverNesso')}
      style={
        {
          '--intro-explorer-width': `${panels.explorerWidth}px`,
          '--intro-inspector-width': `${inspectorWidth}px`,
          '--intro-inspector-min-width': `${inspectorMinWidth}px`,
        } as CSSProperties
      }
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return
        if (
          event.target instanceof Element &&
          event.target.closest(
            'input, textarea, a, aside, [role="tablist"], [role="tabpanel"], .react-flow__controls',
          )
        )
          return
        if (event.key === 'ArrowRight' && step < lastStep) {
          event.preventDefault()
          setStep(step + 1)
        }
        if (event.key === 'ArrowLeft' && step > 0) {
          event.preventDefault()
          setStep(step - 1)
        }
      }}
    >
      <div className="intro-body">
        <div
          className="intro-explorer-slot"
          data-open={step >= 2}
          inert={step < 2}
          aria-hidden={step < 2}
        >
          <aside className="intro-explorer" aria-label={t('views')}>
            <AppSidebar store={store} readonly bare />
          </aside>
        </div>
        <div className="intro-workspace flex min-h-0 min-w-0 flex-1">
          <div className="intro-canvas min-h-0 min-w-0 flex-1">
            {step === lastStep && (
              <div className="intro-preview-tabs">
                <ViewHeader store={store} readonly preview={{ tabs: reviewTabs, badgeCount: 3 }} />
              </div>
            )}
            <div className="intro-graph min-h-0 flex-1">
              <GraphWorkspace
                store={store}
                preview
                connection={step === 1 && !relation ? introConnection : undefined}
                showContext={step >= 2}
                bottomInset={compact ? 0 : bottomInset}
              />
            </div>
            <section
              ref={narrative}
              className="intro-narrative intro-overlay"
              aria-labelledby="intro-title"
            >
              <div className="intro-copy" key={step}>
                <h1 ref={title} id="intro-title" tabIndex={-1}>
                  {t(chapters[step].title)}
                </h1>
                <p>
                  {description
                    .split('**')
                    .map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part))}
                </p>
                {(step === 1 || step === lastStep) && relationLabel && (
                  <p className="intro-relation">
                    {graph.concepts.find(({ id }) => id === introConnection.source)?.label}
                    <span> · {relationLabel} · </span>
                    {graph.concepts.find(({ id }) => id === introConnection.target)?.label}
                  </p>
                )}
                {step === lastStep && !!chat && (
                  <p className="intro-desktop-note">{t('introChatNote')}</p>
                )}
              </div>
              <nav className="intro-navigation" aria-label={t('introNavigation')}>
                <span aria-label={t('introStep', progress)}>{t('introStepCount', progress)}</span>
                <Button className="intro-skip" variant="ghost" size="sm" onClick={onFinish}>
                  {t('introSkip')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={step === 0}
                  aria-label={t('introPrevious')}
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => (step === lastStep ? onFinish() : setStep(step + 1))}
                >
                  {t(step === lastStep ? 'introExplore' : 'introContinue')}
                  <ArrowRight aria-hidden="true" />
                </Button>
              </nav>
              <span className="sr-only" role="status">
                {t('introStep', progress)}. {t(chapters[step].title)}
              </span>
            </section>
          </div>
          <div
            className="intro-inspector-slot"
            data-open={inspectorOpen}
            inert={!inspectorOpen}
            aria-hidden={!inspectorOpen}
          >
            <div className="intro-inspector">
              {inspectorOpen && <Inspector store={store} relationTypeOnly focusRelation />}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
