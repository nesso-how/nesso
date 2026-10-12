import assert from 'node:assert/strict'
import test from 'node:test'
import { siteLocaleRedirect } from './locale.ts'

test('site language redirects only the root, honoring saved choices before browser preferences', () => {
  assert.equal(siteLocaleRedirect('/', null, ['fr-FR', 'it-IT']), '/it/')
  assert.equal(siteLocaleRedirect('/', null, ['zh-SG']), '/zh-CN/')
  assert.equal(siteLocaleRedirect('/', null, ['zh-Hant']), null)
  assert.equal(siteLocaleRedirect('/', null, ['fr-FR']), null)
  assert.equal(siteLocaleRedirect('/', 'en', ['it-IT']), null)
  assert.equal(siteLocaleRedirect('/', 'it', ['zh-CN']), '/it/')
  assert.equal(siteLocaleRedirect('/', 'zh-CN', ['en-US']), '/zh-CN/')
  assert.equal(siteLocaleRedirect('/', 'unknown', ['it-IT']), '/it/')
  for (const path of ['/it/', '/zh-CN/', '/it', '/zh-CN', '/unknown/']) {
    assert.equal(siteLocaleRedirect(path, 'it', ['zh-CN']), null)
  }
})
