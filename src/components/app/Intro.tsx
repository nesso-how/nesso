import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { conceptMapPlugin } from '@nesso/concept-map'
import { Button } from '@nesso/ui'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { createIntroStore, setIntroStep } from '@/store/intro'
import { createPluginStore } from '@/store/commands'
import { notifications } from '@/notifications'
import { useTranslation } from '@/i18n'
import { defaultLocale } from '@nesso/i18n'
import { useNessoStore } from '@/store'
import { resolveInspector } from '@/store/settings'
import { chat } from '@/ai'
import { AppSidebar } from './Sidebar'
import { Inspector } from './Inspector'
import { AssistantPanel } from './AssistantPanel'

const chapters = [
  { title: 'introConceptTitle', description: 'introConceptDescription' },
  { title: 'introConnectionsTitle', description: 'introConnectionsDescription' },
  { title: 'introUnderstandingTitle', description: 'introUnderstandingDescription' },
] as const

const lastStep = chapters.length - 1

export function Intro({ onFinish }: { onFinish: () => void }) {
  const t = useTranslation()
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const panels = useNessoStore((state) => state.preferences.panels)
  const { width: inspectorWidth, minWidth: inspectorMinWidth } = resolveInspector(panels, !!chat)
  const [step, setStep] = useState(0)
  const title = useRef<HTMLHeadingElement>(null)
  const { store, Component } = useMemo(() => {
    const store = createIntroStore(locale)
    const renderer = conceptMapPlugin.create({ store: createPluginStore(store, ['selection.set']), notifications: notifications.api })
    return { store, Component: renderer.component }
  }, [locale])

  useEffect(() => {
    setIntroStep(store, step)
    title.current?.focus()
  }, [store, step])

  const progress = { step: step + 1, total: chapters.length }
  const description = t(step === lastStep && chat ? 'introUnderstandingDesktopDescription' : chapters[step].description)
  const [desktopBefore, desktopAfter] = t('introDesktopDescription', { website: '<website>' }).split('<website>')

  return <section className="intro" aria-label={t('discoverNesso')} style={{
    '--intro-explorer-width': `${panels.explorerWidth}px`,
    '--intro-inspector-width': `${inspectorWidth}px`,
    '--intro-inspector-min-width': `${inspectorMinWidth}px`,
  } as CSSProperties} onKeyDown={(event) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.target instanceof Element && event.target.closest('input, textarea, a, aside, [role="tablist"], [role="tabpanel"], .react-flow__controls')) return
    if (event.key === 'ArrowRight' && step < lastStep) { event.preventDefault(); setStep(step + 1) }
    if (event.key === 'ArrowLeft' && step > 0) { event.preventDefault(); setStep(step - 1) }
  }}>
    <header className="intro-header">
      <img src="/logo.svg" width="94" height="24" alt="Nesso" />
      <span className="intro-mode">{t('introReadonly')}</span>
      <Button variant="ghost" size="sm" onClick={onFinish}>{t('introSkip')}<X aria-hidden="true" /></Button>
    </header>
    <div className="intro-body">
      <div className="intro-explorer-slot" data-open={step > 0} inert={step === 0} aria-hidden={step === 0}>
        <aside className="intro-explorer" aria-label={t('views')}><AppSidebar store={store} readonly bare /></aside>
      </div>
      <div className="intro-workspace flex min-h-0 min-w-0 flex-1">
        <div className="intro-canvas min-h-0 min-w-0 flex-1">
          <Component readOnly overlay={<section className="intro-narrative" aria-labelledby="intro-title">
            <div className="intro-copy" key={step}>
              <h1 ref={title} id="intro-title" tabIndex={-1}>{t(chapters[step].title)}</h1>
              <p>{description.split('**').map((part, index) => index % 2 ? <strong key={index}>{part}</strong> : part)}</p>
              {step === lastStep && !chat && <p className="intro-desktop-note">{desktopBefore}<a href="https://nesso.how" target="_blank" rel="noopener noreferrer">nesso.how</a>{desktopAfter}</p>}
            </div>
            <nav className="intro-navigation" aria-label={t('introNavigation')}>
              <span aria-label={t('introStep', progress)}>{t('introStepCount', progress)}</span>
              <Button variant="ghost" size="icon-sm" disabled={step === 0} aria-label={t('introPrevious')} onClick={() => setStep(step - 1)}><ArrowLeft aria-hidden="true" /></Button>
              <Button size="sm" onClick={() => step === lastStep ? onFinish() : setStep(step + 1)}>{t(step === lastStep ? 'introExplore' : 'introContinue')}<ArrowRight aria-hidden="true" /></Button>
            </nav>
            <span className="sr-only" role="status">{t('introStep', progress)}. {t(chapters[step].title)}</span>
          </section>} />
        </div>
        <div className="intro-inspector-slot" data-open={step === lastStep} inert={step !== lastStep} aria-hidden={step !== lastStep}>
          <div className="intro-inspector">{step === lastStep && (chat ? <AssistantPanel chat={chat} store={store} readonly /> : <Inspector store={store} readonly />)}</div>
        </div>
      </div>
    </div>
  </section>
}
