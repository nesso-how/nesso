import type { LocalizedText } from './i18n.ts'

const boundText = (text: string, limit: number) => {
  let result = ''
  let bytes = 0
  const encoder = new TextEncoder()
  for (const character of text) {
    bytes += encoder.encode(character).byteLength
    if (bytes > limit) break
    result += character
  }
  return result
}

export class PluginError extends Error {
  override name = 'PluginError'
  readonly issues: { path: string; message: string }[]
  readonly code: string
  readonly displayMessage?: LocalizedText
  constructor(code: string, issues: { path: string; message: string }[], displayMessage?: LocalizedText) {
    const bounded = issues.slice(0, 32).map(({ path, message }) => ({ path: boundText(path, 256), message: boundText(message, 2048) }))
    if (!bounded.length) bounded.push({ path: 'plugin', message: 'Plugin request failed' })
    super(bounded.map(({ path, message }) => `${path}: ${message}`).join('\n'))
    this.issues = bounded
    this.code = code
    if (displayMessage) this.displayMessage = { en: boundText(displayMessage.en, 2048), ...(displayMessage.it !== undefined ? { it: boundText(displayMessage.it, 2048) } : {}), ...(displayMessage['zh-CN'] !== undefined ? { 'zh-CN': boundText(displayMessage['zh-CN'], 2048) } : {}) }
  }
}
