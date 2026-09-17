// SPDX-License-Identifier: MIT
import { Fragment } from 'react'

/**
 * Render a small safe subset of markdown for Socrates replies: `**bold**`,
 * `*italic*`, `` `code` ``, `-`/`*` unordered lists, `1.` ordered lists, and
 * paragraphs. Output is React elements only (no
 * `dangerouslySetInnerHTML`), so echoed graph content stays inert text.
 * Unclosed markers render literally, which keeps streamed partial replies
 * stable until the closing marker arrives.
 */
export function renderWithEmphasis(text: string): React.ReactNode {
  return renderBlocks(text)
}

type Block = { kind: 'para'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] }

const UNORDERED_ITEM = /^\s*[-*•]\s+(.*)$/
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/

type ListMatch = { kind: 'ul' | 'ol'; item: string }

function matchListItem(line: string): ListMatch | null {
  const unordered = line.match(UNORDERED_ITEM)
  if (unordered) return { kind: 'ul', item: unordered[1] }
  const ordered = line.match(ORDERED_ITEM)
  if (ordered) return { kind: 'ol', item: ordered[1] }
  return null
}

function appendListItem(blocks: Block[], match: ListMatch): void {
  const last = blocks[blocks.length - 1]
  if (last && last.kind === match.kind) last.items.push(match.item)
  else blocks.push({ kind: match.kind, items: [match.item] })
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ kind: 'para', lines: para })
      para = []
    }
  }

  for (const line of text.split('\n')) {
    const match = matchListItem(line)
    if (!match) {
      // Blank lines end a paragraph; other lines join it so single line
      // breaks survive via the pre-wrapped parent bubble.
      if (line.trim() === '') flushPara()
      else para.push(line)
      continue
    }
    flushPara()
    appendListItem(blocks, match)
  }
  flushPara()
  return blocks
}

function isWrapped(part: string, marker: string): boolean {
  return part.startsWith(marker) && part.endsWith(marker) && part.length >= marker.length * 2 + 1
}

function renderInlinePart(part: string, key: string): React.ReactNode {
  if (isWrapped(part, '**')) {
    return <strong key={key}>{part.slice(2, -2)}</strong>
  }
  if (isWrapped(part, '`')) {
    return (
      <code
        key={key}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.86em',
          background: 'var(--paper-deep)',
          borderRadius: 'var(--radius-sm)',
          padding: '0 4px',
        }}
      >
        {part.slice(1, -1)}
      </code>
    )
  }
  if (isWrapped(part, '*')) {
    return <em key={key}>{part.slice(1, -1)}</em>
  }
  return <Fragment key={key}>{part}</Fragment>
}

/** Split inline markdown into bold/italic/code elements; the rest stays literal. */
function renderInline(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
  return parts.map((part, i) => renderInlinePart(part, `${keyPrefix}-${i}`))
}

/** Join paragraph lines with their original single newlines. */
function renderParagraphLines(lines: string[], keyPrefix: string): React.ReactNode {
  return lines.map((line, i) =>
    i === 0 ? (
      <Fragment key={`${keyPrefix}-${i}`}>{renderInline(line, `${keyPrefix}-${i}`)}</Fragment>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>
        {'\n'}
        {renderInline(line, `${keyPrefix}-${i}`)}
      </Fragment>
    ),
  )
}

function renderListItems(items: string[], keyPrefix: string): React.ReactNode {
  return items.map((item, j) => <li key={j}>{renderInline(item, `${keyPrefix}-${j}`)}</li>)
}

function renderBlock(block: Block, index: number, isLast: boolean): React.ReactNode {
  const spacing = isLast ? undefined : { marginBottom: 8 }
  if (block.kind === 'para') {
    return (
      <div key={index} style={spacing}>
        {renderParagraphLines(block.lines, `p${index}`)}
      </div>
    )
  }
  const List = block.kind
  return (
    <List key={index} style={{ margin: '4px 0', paddingLeft: 20, ...spacing }}>
      {renderListItems(block.items, `l${index}`)}
    </List>
  )
}

function renderBlocks(text: string): React.ReactNode {
  const blocks = parseBlocks(text)
  return blocks.map((block, i) => renderBlock(block, i, i === blocks.length - 1))
}
