// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderWithEmphasis } from './emphasis'

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  root = null
  container?.remove()
  container = null
})

async function renderText(text: string): Promise<HTMLElement> {
  await act(async () => {
    root!.render(<>{renderWithEmphasis(text)}</>)
  })
  return container!
}

describe('renderWithEmphasis', () => {
  it('renders **bold** as strong without literal asterisks', async () => {
    const el = await renderText('Recall **stability** matters')
    expect(el.querySelector('strong')?.textContent).toBe('stability')
    expect(el.textContent).not.toContain('**')
  })

  it('keeps the existing *italic* behavior', async () => {
    const el = await renderText('a *focused* question')
    expect(el.querySelector('em')?.textContent).toBe('focused')
    expect(el.textContent).not.toContain('*')
  })

  it('renders `code` as a code element', async () => {
    const el = await renderText('call `getGraphOverview` first')
    expect(el.querySelector('code')?.textContent).toBe('getGraphOverview')
    expect(el.textContent).not.toContain('`')
  })

  it('renders dash bullets as a list', async () => {
    const el = await renderText('- stability\n- last review')
    const items = el.querySelectorAll('ul > li')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('stability')
    expect(el.textContent).not.toContain('- ')
  })

  it('renders numbered items as an ordered list', async () => {
    const el = await renderText('1. search\n2. inspect')
    const items = el.querySelectorAll('ol > li')
    expect(items).toHaveLength(2)
    expect(items[1].textContent).toBe('inspect')
  })

  it('renders markdown inside list items', async () => {
    const el = await renderText('- **stability** matters')
    expect(el.querySelector('li strong')?.textContent).toBe('stability')
    expect(el.textContent).not.toContain('**')
  })

  it('keeps raw HTML inert instead of executing it', async () => {
    const el = await renderText('<script>alert(1)</script>')
    expect(el.querySelector('script')).toBeNull()
    expect(el.textContent).toContain('<script>alert(1)</script>')
  })

  it('leaves unclosed markers literal for streaming safety', async () => {
    const el = await renderText('partial **bold')
    expect(el.querySelector('strong')).toBeNull()
    expect(el.textContent).toContain('partial **bold')
  })

  it('leaves intraword underscores literal', async () => {
    const el = await renderText('foo_bar_baz')
    expect(el.querySelector('em')).toBeNull()
    expect(el.textContent).toBe('foo_bar_baz')
  })

  it('preserves single line breaks inside a paragraph', async () => {
    const el = await renderText('line one\nline two')
    expect(el.textContent).toContain('line one')
    expect(el.textContent).toContain('line two')
  })
})
