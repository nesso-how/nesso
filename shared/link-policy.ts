export function isAllowedExternalLink(url: string): boolean {
  try {
    const destination = new URL(url)
    return !destination.username && !destination.password && (
      destination.origin === 'https://nesso.how'
      || (destination.origin === 'https://github.com' && /^\/nesso-how\/nesso(?:\/|$)/.test(destination.pathname))
    )
  } catch {
    return false
  }
}
