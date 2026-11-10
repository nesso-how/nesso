import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatMarkdown } from './ChatMarkdown.ts'

const render = (content: string) => renderToStaticMarkup(createElement(ChatMarkdown, { content }))

test('assistant Markdown renders basic formatting and code', () => {
  const html = render(
    '# Title\n\n**Bold** and *italic* with `code`.\n\n- First\n- Second\n\n1. Ordered\n\n> Quote\n\n```\nconst value = 1\n```',
  )
  for (const expected of [
    '<h1>Title</h1>',
    '<strong>Bold</strong>',
    '<em>italic</em>',
    '<code>code</code>',
    '<ul>',
    '<li>First</li>',
    '<ol>',
    '<blockquote>',
    '<pre><code>const value = 1\n</code></pre>',
  ]) {
    assert.ok(html.includes(expected), expected)
  }
})

test('assistant Markdown highlights complete and streaming code without interpreting its content', () => {
  const source = '```ts\nconst value = "<script>alert(1)</script>'
  for (const content of [source, `${source}"\n\`\`\``]) {
    const html = render(content)
    assert.match(html, /<code class="hljs language-ts">/)
    assert.match(html, /<span class="hljs-keyword">const<\/span>/)
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
    assert.doesNotMatch(html, /<script\b/)
  }
})

test('assistant Markdown keeps unknown languages unhighlighted', () => {
  const html = render('```nesso-unknown\nconst value = 1\n```')
  assert.match(html, /const value = 1\n<\/code><\/pre>/)
  assert.doesNotMatch(html, /<span/)
})

test('assistant Markdown renders tables with aligned columns and inline formatting', () => {
  const html = render(
    '| Topic | Progress | Reviews |\n| :--- | :---: | ---: |\n| **Memory** | In progress | 3 |\n| `FSRS` | Ready | 12 |',
  )
  for (const expected of [
    '<div class="chat-markdown-table" tabindex="0"><table>',
    '<thead>',
    '<tbody>',
    '<th style="text-align:left">Topic</th>',
    '<th style="text-align:center">Progress</th>',
    '<th style="text-align:right">Reviews</th>',
    '<td style="text-align:left"><strong>Memory</strong></td>',
    '<td style="text-align:center">In progress</td>',
    '<td style="text-align:right">3</td>',
    '<td style="text-align:left"><code>FSRS</code></td>',
  ]) {
    assert.ok(html.includes(expected), expected)
  }
  assert.equal((html.match(/<tr>/g) ?? []).length, 3)
})

test('assistant Markdown renders tables while a response is still streaming', () => {
  const html = render('| Topic | Progress |\n| --- | --- |\n| Memory | In pro')
  assert.match(html, /<table>/)
  assert.match(html, /<td>In pro<\/td>/)
})

test('assistant Markdown keeps table content subject to HTML, image and link restrictions', () => {
  const html = render(
    '| Content |\n| --- |\n| [Nesso](https://nesso.how) |\n| [Unsafe](https://evil.example) |\n| ![Image](https://evil.example/pixel) |\n| <img src="https://evil.example/pixel"> |\n| <script>alert(1)</script> |',
  )
  assert.match(html, /<table>/)
  assert.doesNotMatch(html, /<script|<img|evil\.example/)
  assert.equal((html.match(/<a /g) ?? []).length, 1)
  assert.match(html, /href="https:\/\/nesso\.how" target="_blank" rel="noopener noreferrer"/)
  assert.match(html, /<td><span>Unsafe<\/span><\/td>/)
})

test('assistant Markdown omits HTML and images and only links to trusted HTTPS destinations', () => {
  const html = render(
    '<script>alert(1)</script>\n\n<img src="https://evil.example/pixel">\n\n![Image](https://evil.example/pixel)\n\n[Unsafe](javascript:alert) [Other](https://evil.example) [Relative](/settings) [HTTP](http://nesso.how) [Credentials](https://user:pass@nesso.how) [Lookalike](https://nesso.how.evil.example) [Wrong repo](https://github.com/nesso-how/nesso-other)\n\n[Nesso](https://nesso.how) [Help](https://github.com/nesso-how/nesso/discussions)',
  )
  assert.doesNotMatch(
    html,
    /<script|<img|javascript:|evil\.example|href="\/settings"|http:\/\/|user:pass|nesso-other/,
  )
  assert.equal((html.match(/<a /g) ?? []).length, 2)
  assert.match(html, /href="https:\/\/nesso\.how" target="_blank" rel="noopener noreferrer"/)
  assert.match(
    html,
    /href="https:\/\/github\.com\/nesso-how\/nesso\/discussions" target="_blank" rel="noopener noreferrer"/,
  )
  assert.ok(html.includes('Unsafe'))
})
