import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { locales } from '@nesso-how/i18n'
import { parseGraph } from '@nesso-how/schema'
import { build } from 'vite'
import config from './vite.config.ts'
import en from './i18n/en.json' with { type: 'json' }
import it from './i18n/it.json' with { type: 'json' }
import zhCN from './i18n/zh-CN.json' with { type: 'json' }
import example from './data-example.json' with { type: 'json' }

function assertSoftwareApplication(html: string, path: string) {
  const structuredData = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  assert.ok(structuredData)
  const app = JSON.parse(structuredData[1])
  assert.equal(app['@type'], 'SoftwareApplication')
  assert.equal(app.url, `https://nesso.how${path}`)
  assert.equal(app.offers.price, '0')
  assert.equal(app.license, 'https://opensource.org/licenses/MIT')
  assert.equal(app.operatingSystem, 'macOS, Windows, Linux')
  assert.equal(app.downloadUrl.length, 3)
  for (const download of app.downloadUrl)
    assert.ok(download.includes(`/v${app.softwareVersion}/Nesso-${app.softwareVersion}-`))
}

test('landing translations cover the same content with concise metadata', () => {
  for (const messages of [en, it, zhCN]) {
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort())
    for (const value of Object.values(messages)) assert.ok(value.trim())
    assert.ok(messages.metaDescription.length <= 155)
    assert.ok(messages.socialDescription.length <= 155)
  }
})

test('the displayed JSON-LD example is a complete supported graph', () => {
  const { graph, views } = parseGraph(example)
  assert.equal(graph.concepts.length, 2)
  assert.equal(graph.relations.length, 1)
  assert.equal(graph.relationTypes.length, 1)
  assert.deepEqual(views, [])
})

test('the site build emits complete localized pages with matching language links, metadata and download labels', async () => {
  const result = await build({
    ...config,
    configFile: false,
    logLevel: 'silent',
    build: { ...config.build, write: false },
  })
  assert.ok('output' in result)
  for (const locale of locales) {
    const messages = { en, it, 'zh-CN': zhCN }[locale]
    const path = locale === 'en' ? '/' : `/${locale}/`
    const page = result.output.find((file) => file.fileName === `${path.slice(1)}index.html`)
    assert.ok(page?.type === 'asset' && typeof page.source === 'string')
    const html: string = page.source
    assert.ok(html.includes(`<html lang="${locale}">`))
    assert.match(html, /<main id="main" tabindex="-1">/)
    assert.match(
      html,
      /<a\b[^>]*class="button back-to-top"[^>]*href="#main"[^>]*aria-label="[^"]+"[^>]*hidden/,
    )
    assert.match(html.slice(0, html.indexOf('</head>')), /<style>[\s\S]*?\.hero[\s\S]*?<\/style>/)
    assert.doesNotMatch(html, /<link[^>]*rel="stylesheet"/)
    assert.match(html, new RegExp(`<link rel="canonical" href="https://nesso.how${path}" ?/?>`))
    assert.ok(html.includes(`hreflang="${locale}" aria-current="page"`))
    assert.match(html, /data-download-version="\d+\.\d+\.\d+[^"]*"/)
    assert.match(html, /data-download-label="[^"]*\{platform\}[^"]*"/)
    assert.equal([...html.matchAll(/data-download-version=/g)].length, 2)
    assert.equal(
      [...html.matchAll(/<a\b[^>]*data-download-version=[^>]*\bhidden\b[^>]*>/g)].length,
      2,
    )
    assert.match(html, /<img[^>]+src="\/nesso-understanding.webp"[^>]+alt="[^"]+"/)
    assert.match(html, /<code><span class="hljs-punctuation">/)
    assert.ok(html.includes('<span class="hljs-attr">'))
    assert.ok(html.includes('<span class="hljs-string">'))
    assert.match(html, /<meta property="og:locale" content="[^"]+"/)
    assert.equal([...html.matchAll(/property="og:locale:alternate"/g)].length, 2)
    for (const section of ['why', 'elements', 'plugins', 'data']) {
      assert.ok(html.includes(`id="${section}"`))
      assert.ok(html.includes(`href="#${section}"`))
    }
    const navigation = html.match(/<nav class="section-links mono"[^>]*>([\s\S]*?)<\/nav>/)
    assert.ok(navigation)
    assert.deepEqual(
      [...navigation[1].matchAll(/href="#(\w+)"/g)].map((link) => link[1]),
      ['why', 'elements', 'plugins', 'data'],
    )
    assert.ok(html.includes('id="ai"'))
    assert.ok(html.includes(messages.backupDescription))
    assert.match(
      html,
      /<button\b[^>]*type="button"[^>]*data-copy-plugin-prompt[^>]*aria-describedby="plugin-create-hint"[^>]*aria-controls="plugin-prompt"/,
    )
    assert.ok(html.includes(messages.createPlugin))
    assert.ok(html.includes(`data-copied="${messages.pluginPromptCopied}"`))
    assert.ok(html.includes(`data-copy-failed="${messages.pluginPromptCopyFailed}"`))
    assert.ok(html.includes('<span class="mono" role="status" id="plugin-prompt-status">'))
    assert.ok(html.includes(`<summary>${messages.pluginPromptShow}</summary>`))
    const prompt = html.match(/<textarea\b[^>]*readonly[^>]*>([\s\S]*?)<\/textarea>/)
    assert.ok(prompt)
    assert.equal(
      prompt[1].trim(),
      messages.pluginPrompt
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;'),
    )
    assert.ok(
      html.includes(
        'href="https://github.com/nesso-how/nesso/blob/main/packages/plugin/README.md#create-a-plugin"',
      ),
    )
    assertSoftwareApplication(html, path)
    assert.doesNotMatch(html, /{{|%NESSO_VERSION%|In development\./)
    for (const language of locales) {
      assert.ok(html.includes(`<link rel="alternate" hreflang="${language}"`))
      assert.ok(html.includes(`lang="${language}" hreflang="${language}"`))
    }
  }
  const notFound = result.output.find((file) => file.fileName === '404.html')
  assert.ok(notFound?.type === 'asset' && typeof notFound.source === 'string')
  assert.match(notFound.source, /name="robots" content="noindex"/)
  assert.ok(notFound.source.includes(en.notFoundTitle))
  assert.ok(notFound.source.includes('href="/"'))
  assert.doesNotMatch(notFound.source, /{{|%NESSO_VERSION%/)
})

test('the sitemap lists all localized pages and robots references it', () => {
  const sitemap = readFileSync(new URL('./public/sitemap.xml', import.meta.url), 'utf8')
  const robots = readFileSync(new URL('./public/robots.txt', import.meta.url), 'utf8')
  assert.match(robots, /Sitemap: https:\/\/nesso.how\/sitemap.xml/)
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, locales.length)
  for (const locale of locales) {
    const url = `https://nesso.how${locale === 'en' ? '/' : `/${locale}/`}`
    assert.ok(sitemap.includes(`<loc>${url}</loc>`))
    assert.equal([...sitemap.matchAll(new RegExp(`hreflang="${locale}"`, 'g'))].length, 3)
  }
})
