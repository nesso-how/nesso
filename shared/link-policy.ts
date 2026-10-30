export function isAllowedExternalLink(url: string): boolean {
  try {
    const destination = new URL(url)
    return (
      !destination.username &&
      !destination.password &&
      (destination.origin === 'https://nesso.how' ||
        (destination.origin === 'https://github.com' &&
          /^\/nesso-how\/nesso(?:\/|$)/.test(destination.pathname)))
    )
  } catch {
    return false
  }
}

export function isAllowedPluginLink(url: string): boolean {
  try {
    const destination = new URL(url)
    if (destination.username || destination.password || destination.search || destination.hash)
      return false
    return (
      (destination.origin === 'https://www.npmjs.com' &&
        /^\/package\/(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(destination.pathname)) ||
      (destination.origin === 'https://github.com' &&
        /^\/[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9._-]+$/.test(destination.pathname))
    )
  } catch {
    return false
  }
}
