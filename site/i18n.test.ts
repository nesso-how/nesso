import assert from 'node:assert/strict'
import test from 'node:test'
import { locales } from '@nesso/i18n'
import { build } from 'vite'
import config from './vite.config.ts'

test('the site build emits complete localized pages with matching language links, metadata and download labels', async () => {
  const result = await build({ ...config, configFile: false, logLevel: 'silent', build: { write: false } })
  assert.ok('output' in result)
  for (const locale of locales) {
    const path = locale === 'en' ? '/' : `/${locale}/`
    const page = result.output.find((file) => file.fileName === `${path.slice(1)}index.html`)
    assert.ok(page?.type === 'asset' && typeof page.source === 'string')
    const html = page.source
    assert.ok(html.includes(`<html lang="${locale}">`))
    assert.ok(html.includes(`<link rel="canonical" href="https://nesso.how${path}">`))
    assert.ok(html.includes(`hreflang="${locale}" aria-current="page"`))
    assert.match(html, /data-download-version="\d+\.\d+\.\d+[^"]*"/)
    assert.match(html, /data-download-label="[^"]*\{platform\}[^"]*"/)
    assert.doesNotMatch(html, /{{|%NESSO_VERSION%|In development\./)
    for (const language of locales) {
      assert.ok(html.includes(`<link rel="alternate" hreflang="${language}"`))
      assert.ok(html.includes(`lang="${language}" hreflang="${language}"`))
    }
    if (locale === 'it') assert.ok(html.includes('con l&#39;aiuto dell&#39;IA'))
  }
})
