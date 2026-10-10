import { desktopDownload, detectDesktopPlatform } from './platform.ts'

const platform = detectDesktopPlatform(navigator.userAgent, navigator.maxTouchPoints)

const download = document.querySelector<HTMLAnchorElement>('[data-download-version]')
const label = download?.querySelector('span')

if (download?.dataset.downloadVersion && label) {
  const target = desktopDownload(platform, download.dataset.downloadVersion)
  if (target) {
    download.href = target.href
    label.textContent = target.label
  }
}
