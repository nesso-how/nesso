import { useMemo } from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import { Button } from '@nesso-how/ui'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useNessoStore } from '@/store'
import { createIntroStore } from '@/store/intro'
import { GraphWorkspace } from './GraphWorkspace'

export function CompactIntro({ onFinish }: { onFinish: () => void }) {
  const t = useTranslation()
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const vocab = useNessoStore((state) => state.vocabs.find(({ id }) => id === 'base-vocab')!)
  const store = useMemo(() => createIntroStore(locale, vocab, 2), [locale, vocab])

  return (
    <section className="intro compact-intro" aria-labelledby="compact-intro-title">
      <header className="compact-intro-header">
        <span className="font-mono text-sm font-medium tracking-wide">nesso</span>
        <Button variant="ghost" className="min-h-11 text-muted-foreground" onClick={onFinish}>
          {t('introSkip')}
        </Button>
      </header>
      <div className="compact-intro-scroll">
        <div className="compact-intro-graph">
          <GraphWorkspace store={store} preview />
        </div>
        <div className="compact-intro-copy">
          <h1 id="compact-intro-title">{t('introCompactTitle')}</h1>
          <p>
            {t('introCompactDescription')
              .split('**')
              .map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part))}
          </p>
          <p className="text-muted-foreground">{t('introCompactExplore')}</p>
        </div>
        <footer className="compact-intro-footer">
          <Button onClick={onFinish}>
            {t('introExplore')}
            <ArrowRight aria-hidden="true" />
          </Button>
          <p>{t('introCompactDesktopNote')}</p>
        </footer>
      </div>
    </section>
  )
}
