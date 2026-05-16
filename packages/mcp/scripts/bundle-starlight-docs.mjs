#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/** Builds dist/starlight-docs.pages.json from all .md files under docs/src/content/docs/docs/. */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MCP_ROOT = join(__dirname, '..')
const DIST = join(MCP_ROOT, 'dist')

function docsSourceRoot() {
  if (process.env.NESSO_STARLIGHT_DOCS_ROOT) return process.env.NESSO_STARLIGHT_DOCS_ROOT
  return join(MCP_ROOT, '..', '..', 'docs', 'src', 'content', 'docs', 'docs')
}

/** Recursively collect all .md files under `dir`, sorted by path. */
function collectMarkdownFiles(dir, base = dir) {
  const entries = readdirSync(dir).sort()
  /** @type {string[]} */
  const files = []
  for (const entry of entries) {
    const abs = join(dir, entry)
    if (statSync(abs).isDirectory()) {
      files.push(...collectMarkdownFiles(abs, base))
    } else if (entry.endsWith('.md')) {
      files.push(relative(base, abs))
    }
  }
  return files
}

function stripYamlFrontmatter(source) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
}

function extractFrontmatterField(source, field) {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!m) return null
  const line = m[1].match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
  if (!line) return null
  let v = line[1].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  return v
}

function fallbackTitle(rel) {
  const seg = rel.replace(/\.md$/i, '').split(/[/\\]/).pop() ?? rel
  return seg.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function main() {
  const root = docsSourceRoot()
  const files = collectMarkdownFiles(root)
  console.error(`found ${files.length} Markdown files in ${root}`)

  const pages = files.map((rel) => {
    const raw = readFileSync(join(root, rel), 'utf8')
    return {
      slug: rel.replace(/\.md$/i, '').replace(/\\/g, '/'),
      title: extractFrontmatterField(raw, 'title') ?? fallbackTitle(rel),
      description: extractFrontmatterField(raw, 'description') ?? '',
      markdown: stripYamlFrontmatter(raw).trim(),
    }
  })

  mkdirSync(DIST, { recursive: true })
  const out = join(DIST, 'starlight-docs.pages.json')
  writeFileSync(out, `${JSON.stringify({ pages }, null, 2)}\n`, 'utf8')
  console.error(`bundled ${pages.length} doc pages → ${out}`)
}

main()
