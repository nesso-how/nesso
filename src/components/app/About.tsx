import type { Ref } from 'react'
import { ArrowRight, BookOpen, ExternalLink, GitFork, Globe, MessageCircle } from 'lucide-react'
import { useTranslation } from '@/i18n'
import appPackage from '../../../package.json'

export function About({
  titleRef,
  onDiscover,
}: {
  titleRef: Ref<HTMLHeadingElement>
  onDiscover: () => void
}) {
  const t = useTranslation()
  return (
    <div className="about">
      <h2 ref={titleRef} tabIndex={-1} className="outline-none">
        <img src="/logo.svg" width="148" height="32" alt="Nesso" />
      </h2>
      <p className="about-description">{t('aboutDescription')}</p>
      <div className="about-links">
        <a href="https://nesso.how" target="_blank" rel="noopener noreferrer">
          <span>
            <Globe size={14} aria-hidden="true" />
            {t('aboutWebsite')}
          </span>
          <span>
            nesso.how <ExternalLink size={13} aria-hidden="true" />
          </span>
        </a>
        <a href="https://github.com/nesso-how/nesso" target="_blank" rel="noopener noreferrer">
          <span>
            <GitFork size={14} aria-hidden="true" />
            GitHub
          </span>
          <span>
            nesso-how/nesso <ExternalLink size={13} aria-hidden="true" />
          </span>
        </a>
        <a
          href="https://github.com/nesso-how/nesso/discussions"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>
            <MessageCircle size={14} aria-hidden="true" />
            {t('aboutDiscussions')}
          </span>
          <span>
            nesso-how/nesso/discussions <ExternalLink size={13} aria-hidden="true" />
          </span>
        </a>
        <button className="about-discover" onClick={onDiscover}>
          <span>
            <BookOpen size={14} aria-hidden="true" />
            {t('discoverNesso')}
          </span>
          <span>
            {t('aboutIntroduction')} <ArrowRight size={14} aria-hidden="true" />
          </span>
        </button>
      </div>
      <div className="about-footer">
        <a
          href="https://github.com/nesso-how/nesso/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('aboutLicense')}
        </a>
        <a
          href="https://github.com/nesso-how/nesso/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
        >
          v{appPackage.version}
        </a>
      </div>
    </div>
  )
}
