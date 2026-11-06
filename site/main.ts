import { desktopDownload, detectDesktopPlatform } from './platform.ts'
import { siteLocaleRedirect } from './locale.ts'

const localeKey = 'nesso.site.locale'
let savedLocale: string | null | undefined
try {
  savedLocale = localStorage.getItem(localeKey)
} catch {
  savedLocale = undefined
}

if (savedLocale !== undefined) {
  const redirect = siteLocaleRedirect(location.pathname, savedLocale, navigator.languages)
  if (redirect) location.replace(`${redirect}${location.search}${location.hash}`)
}

for (const link of document.querySelectorAll<HTMLAnchorElement>('.language-switcher a')) {
  link.addEventListener('click', () => {
    try {
      localStorage.setItem(localeKey, link.lang)
    } catch {
      return
    }
  })
}

const platform = detectDesktopPlatform(navigator.userAgent, navigator.maxTouchPoints)

if (platform !== 'other') document.documentElement.dataset.desktop = platform

for (const download of document.querySelectorAll<HTMLAnchorElement>('[data-download-version]')) {
  const label = download.querySelector('span')
  if (!download.dataset.downloadVersion || !download.dataset.downloadLabel || !label) continue
  download.setAttribute('data-umami-event-platform', platform)
  const target = desktopDownload(platform, download.dataset.downloadVersion)
  if (target) {
    download.href = target.href
    label.textContent = download.dataset.downloadLabel.replace('{platform}', platform)
    download.hidden = false
  }
}

const otherPlatforms = document.querySelector<HTMLAnchorElement>('[data-other-platforms]')
if (otherPlatforms && platform !== 'other') {
  const labels = {
    macOS: otherPlatforms.dataset.otherMac,
    Windows: otherPlatforms.dataset.otherWindows,
    Linux: otherPlatforms.dataset.otherLinux,
  }
  const label = labels[platform]
  if (label) otherPlatforms.textContent = label
}

const hero = document.querySelector('.hero')
const backToTop = document.querySelector<HTMLAnchorElement>('.back-to-top')
if (hero && backToTop) {
  new IntersectionObserver(([entry]) => {
    backToTop.hidden = entry.isIntersecting || entry.boundingClientRect.bottom > 0
  }).observe(hero)
}

const copyPrompt = document.querySelector<HTMLButtonElement>('[data-copy-plugin-prompt]')
const promptDetails = document.querySelector<HTMLDetailsElement>('#plugin-prompt')
const promptText = promptDetails?.querySelector('textarea')
const promptStatus = document.querySelector('#plugin-prompt-status')
if (copyPrompt && promptDetails && promptText && promptStatus) {
  copyPrompt.addEventListener('click', async () => {
    copyPrompt.disabled = true
    promptStatus.textContent = ''
    try {
      await navigator.clipboard.writeText(promptText.value)
      promptStatus.textContent = copyPrompt.dataset.copied ?? ''
    } catch {
      promptDetails.open = true
      promptText.focus()
      promptText.select()
      promptStatus.textContent = copyPrompt.dataset.copyFailed ?? ''
    } finally {
      copyPrompt.disabled = false
    }
  })
}
