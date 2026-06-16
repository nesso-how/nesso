// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { defaultTheme } from './default.js'
import { resolveMode } from './css.js'
import { starlightCss } from './starlight.js'

describe('starlightCss', () => {
  it('uses Starlight selectors: :root is dark, light is :root[data-theme=light]', () => {
    const css = starlightCss(defaultTheme)
    const [dark, light] = css.split(":root[data-theme='light']")
    expect(dark).toContain(':root {')
    expect(dark).toContain(`--sl-color-bg: ${defaultTheme.dark.color?.paper}`)
    expect(light).toContain(`--sl-color-bg: ${defaultTheme.light.color.paper}`)
  })

  it('maps the shared tokens onto the Starlight namespace', () => {
    const css = starlightCss(defaultTheme)
    expect(css).toContain(`--sl-color-gray-1: ${defaultTheme.light.color.ink[1]}`)
    expect(css).toContain(`--sl-color-gray-6: ${defaultTheme.light.color.paperDeep}`)
    expect(css).toContain(`--sl-color-text-accent: ${defaultTheme.light.color.accent}`)
    expect(css).toContain(`--highlight-selection: ${defaultTheme.light.color.highlightSelection}`)
  })

  it('emits the mode-invariant --font-display once, under the dark :root', () => {
    const css = starlightCss(defaultTheme)
    const [dark, light] = css.split(":root[data-theme='light']")
    expect(dark).toContain(`--font-display: ${defaultTheme.font.display}`)
    expect(light).not.toContain('--font-display')
  })

  it('does not emit docs-specific chrome (orange, accent-high) — those stay docs-owned', () => {
    const css = starlightCss(defaultTheme)
    expect(css).not.toContain('--sl-color-orange')
    expect(css).not.toContain('--sl-color-accent-high')
  })

  it('reflects the dark diff', () => {
    const darkAccent = resolveMode(defaultTheme, 'dark').color.accent
    expect(starlightCss(defaultTheme)).toContain(`--sl-color-text-accent: ${darkAccent}`)
  })
})
