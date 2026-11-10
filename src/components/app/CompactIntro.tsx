import { useMemo, type ReactNode } from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import { Button } from '@nesso-how/ui'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useNessoStore } from '@/store'
import { createIntroStore } from '@/store/intro'
import { GraphWorkspace } from './GraphWorkspace'
import { IntroDescription } from './IntroDescription'

export function CompactIntro({
  onFinish,
  exampleChoice,
}: {
  onFinish: () => void
  exampleChoice: ReactNode
}) {
  const t = useTranslation()
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const vocab = useNessoStore((state) => state.vocabs.find(({ id }) => id === 'base-vocab')!)
  const store = useMemo(() => createIntroStore(locale, vocab, 2), [locale, vocab])

  return (
    <section className="intro compact-intro" aria-labelledby="compact-intro-title">
      <header className="compact-intro-header">
        <img src="/logo.svg" width="111" height="24" alt="Nesso" />
        <Button variant="ghost" className="min-h-11 text-muted-foreground" onClick={onFinish}>
          {t('introSkip')}
        </Button>
      </header>
      <div className="compact-intro-scroll nesso-scroll">
        <div className="compact-intro-graph">
          <GraphWorkspace store={store} preview />
        </div>
        <div className="compact-intro-copy">
          <h1 id="compact-intro-title">{t('introCompactTitle')}</h1>
          <IntroDescription>{t('introCompactDescription')}</IntroDescription>
          <p className="text-muted-foreground">{t('introCompactExplore')}</p>
        </div>
        <footer className="compact-intro-footer">
          {exampleChoice}
          <Button onClick={onFinish}>
            {t('introExplore')}
            <ArrowRight aria-hidden="true" />
          </Button>
          {!window.nessoMenu && <p>{t('introCompactDesktopNote')}</p>}
        </footer>
      </div>
    </section>
  )
}
