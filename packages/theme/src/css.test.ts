// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { defaultTheme } from './default.js'
import { baseVars, modeVars, resolveMode, themeCss } from './css.js'
import { defineTheme, getTheme, themes } from './registry.js'

describe('resolveMode', () => {
  it('returns the light tokens verbatim for light mode', () => {
    expect(resolveMode(defaultTheme, 'light')).toEqual(defaultTheme.light)
  })

  it('applies the dark diff over light, deep-merging nested groups', () => {
    const dark = resolveMode(defaultTheme, 'dark')
    expect(dark.color.paper).toBe(defaultTheme.dark.color?.paper)
    expect(dark.color.ink[1]).toBe(defaultTheme.dark.color?.ink?.[1])
  })

  it('inherits tokens the dark diff omits (recall is mode-shared)', () => {
    expect(defaultTheme.dark.color?.recall).toBeUndefined()
    expect(resolveMode(defaultTheme, 'dark').color.recall).toEqual(defaultTheme.light.color.recall)
  })
})

describe('modeVars', () => {
  it('emits the exact CSS variable names the app and graph consume', () => {
    const vars = modeVars(defaultTheme, 'light')
    expect(vars['--paper']).toBe('#ffffff')
    expect(vars['--ink-2']).toBe(defaultTheme.light.color.ink[2])
    expect(vars['--conf-1']).toBe(defaultTheme.light.color.recall[1])
    expect(vars['--shadow-md']).toBe(defaultTheme.light.shadow.md)
  })

  it('reflects the dark diff in emitted accent', () => {
    expect(modeVars(defaultTheme, 'dark')['--accent']).toBe(defaultTheme.dark.color?.accent)
  })

  it('does not emit category colours (those belong to the relation-type vocabulary)', () => {
    const names = Object.keys(modeVars(defaultTheme, 'light'))
    expect(names.some((n) => n.startsWith('--cat-'))).toBe(false)
  })
})

describe('baseVars', () => {
  it('emits radii shape primitives alongside ramp steps', () => {
    const vars = baseVars(defaultTheme)
    expect(vars['--radius-pill']).toBe('999px')
    expect(vars['--radius-circle']).toBe('50%')
    expect(vars['--radius-lg']).toBe('14px')
  })

  it('stringifies numeric tokens', () => {
    expect(baseVars(defaultTheme)['--font-weight-semibold']).toBe('600')
  })

  it('emits the font families consumed by component shorthands', () => {
    const vars = baseVars(defaultTheme)
    expect(vars['--font-sans']).toBe(defaultTheme.font.sans)
    expect(vars['--font-display']).toBe(defaultTheme.font.display)
    expect(vars['--font-mono']).toBe(defaultTheme.font.mono)
  })
})

describe('themeCss', () => {
  it('puts mode-invariant tokens only under :root, dark tokens under [data-theme]', () => {
    const css = themeCss(defaultTheme)
    expect(css).toContain(':root {')
    expect(css).toContain("[data-theme='dark'] {")
    const [root, dark] = css.split("[data-theme='dark']")
    expect(root).toContain('--space-6')
    expect(dark).not.toContain('--space-6')
    expect(dark).toContain('--paper')
  })
})

describe('defineTheme', () => {
  it('derives a pack by overriding only the diff', () => {
    const sharp = defineTheme(defaultTheme, {
      id: 'sharp',
      name: 'Sharp',
      radii: { sm: '2px', lg: '4px' },
    })
    expect(sharp.radii.sm).toBe('2px')
    expect(sharp.radii.lg).toBe('4px')
    expect(sharp.radii.pill).toBe(defaultTheme.radii.pill)
    expect(sharp.light.color.paper).toBe(defaultTheme.light.color.paper)
  })

  it('does not mutate the base pack', () => {
    defineTheme(defaultTheme, { id: 'x', name: 'X', radii: { sm: '99px' } })
    expect(defaultTheme.radii.sm).toBe('6px')
  })
})

describe('getTheme', () => {
  it('returns a registered pack and falls back to default for unknown ids', () => {
    expect(getTheme('default')).toBe(themes.default)
    expect(getTheme('nope')).toBe(defaultTheme)
  })
})
