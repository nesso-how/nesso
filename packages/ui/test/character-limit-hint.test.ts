import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CharacterLimitHint } from '@nesso-how/ui'

const render = (length: number, maxLength: number, className?: string) =>
  renderToStaticMarkup(
    createElement(CharacterLimitHint, {
      id: 'label-limit',
      length,
      maxLength,
      remainingText: (count) => `${count} left`,
      limitText: 'Use notes for longer text.',
      className,
    }),
  )

test('character limit hints stay empty before the warning threshold', () => {
  for (const maxLength of [30, 60]) {
    const html = render(maxLength - 11, maxLength)
    assert.match(html, /id="label-limit" role="status" aria-atomic="true"/)
    assert.match(html, /class="sr-only"><\/p>/)
  }
})

test('character limit hints show the remaining count in the last ten characters', () => {
  for (const maxLength of [30, 60])
    for (const remaining of [10, 1]) {
      const html = render(maxLength - remaining, maxLength)
      assert.ok(html.endsWith(`>${remaining} left</p>`))
      assert.doesNotMatch(html, /sr-only/)
    }
})

test('character limit hints show the notes suggestion at the limit', () => {
  for (const maxLength of [30, 60]) {
    const html = render(maxLength, maxLength)
    assert.ok(html.endsWith('>Use notes for longer text.</p>'))
    assert.doesNotMatch(html, /sr-only/)
  }
})

test('character limit hints apply popup styling only when there is feedback to show', () => {
  assert.doesNotMatch(render(49, 60, 'sticky top-0'), /sticky/)
  assert.match(render(50, 60, 'sticky top-0'), /sticky top-0/)
  assert.match(render(60, 60, 'sticky top-0'), /sticky top-0/)
})
