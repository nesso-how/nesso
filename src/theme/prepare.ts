import { PluginError, themeTokens } from '@nesso/plugin/runtime'
import type { ThemeDefinition } from '@nesso/plugin'

export type ThemePresentation = { readonly tokens: Readonly<Record<typeof themeTokens[number], string>>; readonly fontStyles: string }

const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), (byte) => byte.toString(16).padStart(2, '0')).join('')

export async function prepareTheme(theme: ThemeDefinition, assets: ReadonlyMap<string, Uint8Array>): Promise<ThemePresentation> {
  const paths = [...new Set([...theme.fonts.sans.faces, ...theme.fonts.mono.faces].map(({ path }) => path))].sort()
  const fingerprints: string[] = [JSON.stringify(theme)]
  for (const path of paths) {
    const bytes = assets.get(path)
    if (!bytes || bytes.byteLength > 4 * 1024 * 1024 || new TextDecoder().decode(bytes.subarray(0, 4)) !== 'wOF2') throw new PluginError('invalid-input', [{ path, message: 'Expected an admitted WOFF2 font within the font budget' }])
    fingerprints.push(await digest(bytes))
  }
  const hash = await digest(new TextEncoder().encode(fingerprints.join('\n')))
  const tokens: Record<string, string> = { ...theme.colors }
  for (const [key, value] of Object.entries(theme.metrics)) tokens[key] = `${value}${key === 'duration-state' ? 'ms' : 'px'}`
  const rules: string[] = []
  for (const role of ['sans', 'mono'] as const) {
    const family = `nesso-${hash}-${role}`
    const fallback = role === 'sans' ? 'system-ui, sans-serif' : 'ui-monospace, monospace'
    tokens[`font-${role}`] = theme.fonts[role].faces.length ? `"${family}", ${fallback}` : fallback
    for (const face of theme.fonts[role].faces) {
      const source = btoa(Array.from(assets.get(face.path)!, (byte) => String.fromCharCode(byte)).join(''))
      const intervals = face.unicodeRange?.map(([from, to]) => `U+${from.toString(16)}-${to.toString(16)}`).join(',')
      rules.push(`@font-face{font-family:"${family}";font-style:${face.style};font-weight:${face.weight.join(' ')};font-display:swap;src:url(data:font/woff2;base64,${source}) format("woff2");${intervals ? `unicode-range:${intervals};` : ''}}`)
    }
  }
  return { tokens: tokens as ThemePresentation['tokens'], fontStyles: rules.join('\n') }
}
