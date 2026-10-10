export function detectDesktopPlatform(userAgent: string, maxTouchPoints: number) {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'other'
  if (/Windows NT/i.test(userAgent)) return 'Windows'
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macOS'
  if (/Linux/i.test(userAgent) && !/aarch64|arm/i.test(userAgent)) return 'Linux'
  return 'other'
}

export function desktopDownload(platform: ReturnType<typeof detectDesktopPlatform>, version: string) {
  if (platform === 'other') return null
  const suffix = { macOS: 'universal.dmg', Windows: 'x64.exe', Linux: 'x86_64.AppImage' }[platform]
  return {
    label: `Download for ${platform}`,
    href: `https://github.com/nesso-how/nesso/releases/download/v${version}/Nesso-${version}-${suffix}`,
  }
}
