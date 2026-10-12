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

const download = document.querySelector<HTMLAnchorElement>('[data-download-version]')
const label = download?.querySelector('span')

if (download?.dataset.downloadVersion && download.dataset.downloadLabel && label) {
  const target = desktopDownload(platform, download.dataset.downloadVersion)
  if (target) {
    download.href = target.href
    label.textContent = download.dataset.downloadLabel.replace('{platform}', platform)
  }
}
