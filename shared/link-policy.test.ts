import assert from 'node:assert/strict'
import test from 'node:test'
import { isAllowedNotesLink, isAllowedExternalLink, isAllowedPluginLink } from './link-policy.ts'

test('notes links allow HTTPS destinations without credentials without widening app or plugin links', () => {
  const url = 'https://en.wikipedia.org/wiki/Knowledge?source=nesso#Overview'
  assert.equal(isAllowedNotesLink(url), true)
  assert.equal(isAllowedExternalLink(url), false)
  assert.equal(isAllowedPluginLink(url), false)
  for (const url of [
    'http://example.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'mailto:hello@example.com',
    'https://user:pass@example.com',
    'https://user@example.com',
    '//example.com',
    '/relative',
    '',
  ])
    assert.equal(isAllowedNotesLink(url), false, url)
})

test('plugin links allow only HTTPS npm package pages and GitHub repository roots without widening assistant links', () => {
  for (const url of [
    'https://www.npmjs.com/package/nesso-plugin-test',
    'https://www.npmjs.com/package/@example/nesso-plugin-test',
    'https://github.com/example/plugin',
  ]) {
    assert.equal(isAllowedPluginLink(url), true, url)
    assert.equal(isAllowedExternalLink(url), false, url)
  }
  for (const url of ['https://nesso.how', 'https://github.com/nesso-how/nesso/discussions']) {
    assert.equal(isAllowedExternalLink(url), true, url)
    assert.equal(isAllowedPluginLink(url), false, url)
  }
  for (const url of [
    'http://www.npmjs.com/package/plugin',
    'http://github.com/example/plugin',
    'https://www.npmjs.com.evil.test/package/plugin',
    'https://github.com.evil.test/example/plugin',
    'https://user:pass@www.npmjs.com/package/plugin',
    'https://user:pass@github.com/example/plugin',
    'https://www.npmjs.com:444/package/plugin',
    'https://github.com:444/example/plugin',
    'https://www.npmjs.com/package/plugin?redirect=other',
    'https://github.com/example/plugin#main',
    'https://github.com/example/plugin/tree/main',
    'https://github.com/example',
    'https://www.npmjs.com',
    'https://www.npmjs.com/login',
    'https://www.npmjs.com/package/@example',
    'https://www.npmjs.com/package/example/other',
    'javascript:alert(1)',
    '/package/plugin',
  ]) {
    assert.equal(isAllowedPluginLink(url), false, url)
  }
})
