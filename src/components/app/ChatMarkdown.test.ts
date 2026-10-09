import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatMarkdown } from './ChatMarkdown.ts'

const render = (content: string) => renderToStaticMarkup(createElement(ChatMarkdown, { content }))

test('assistant Markdown renders basic formatting and code', () => {
  const html = render('# Title\n\n**Bold** and *italic* with `code`.\n\n- First\n- Second\n\n1. Ordered\n\n> Quote\n\n```ts\nconst value = 1\n```')
  for (const expected of ['<h1>Title</h1>', '<strong>Bold</strong>', '<em>italic</em>', '<code>code</code>', '<ul>', '<li>First</li>', '<ol>', '<blockquote>', '<pre><code class="language-ts">const value = 1\n</code></pre>']) {
    assert.ok(html.includes(expected), expected)
  }
})

test('assistant Markdown omits HTML and images and only links to trusted HTTPS destinations', () => {
  const html = render('<script>alert(1)</script>\n\n<img src="https://evil.example/pixel">\n\n![Image](https://evil.example/pixel)\n\n[Unsafe](javascript:alert) [Other](https://evil.example) [Relative](/settings) [HTTP](http://nesso.how) [Credentials](https://user:pass@nesso.how) [Lookalike](https://nesso.how.evil.example) [Wrong repo](https://github.com/nesso-how/nesso-other)\n\n[Nesso](https://nesso.how) [Help](https://github.com/nesso-how/nesso/discussions)')
  assert.doesNotMatch(html, /<script|<img|javascript:|evil\.example|href="\/settings"|http:\/\/|user:pass|nesso-other/)
  assert.equal((html.match(/<a /g) ?? []).length, 2)
  assert.match(html, /href="https:\/\/nesso\.how" target="_blank" rel="noopener noreferrer"/)
  assert.match(html, /href="https:\/\/github\.com\/nesso-how\/nesso\/discussions" target="_blank" rel="noopener noreferrer"/)
  assert.ok(html.includes('Unsafe'))
})
