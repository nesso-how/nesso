import { detectDesktopPlatform } from './platform.ts'

const platform = detectDesktopPlatform(navigator.userAgent, navigator.maxTouchPoints)

for (const downloads of document.querySelectorAll<HTMLElement>('.downloads[data-platform]')) {
  downloads.hidden = downloads.dataset.platform !== platform
}
