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
    const unordered = line.match(UNORDERED_ITEM)
    const ordered = unordered ? null : line.match(ORDERED_ITEM)
    if (!unordered && !ordered) {
      // Blank lines end a paragraph; other lines join it so single line
      // breaks survive via the pre-wrapped parent bubble.
      if (line.trim() === '') flushPara()
      else para.push(line)
      continue
    }
    flushPara()
    const item = (unordered ?? ordered)![1]
    const last = blocks[blocks.length - 1]
    const kind = unordered ? 'ul' : 'ol'
    if (last && last.kind === kind) last.items.push(item)
    else blocks.push({ kind, items: [item] })
  }
  flushPara()
  return blocks
}

/** Split inline markdown into bold/italic/code elements; the rest stays literal. */
function renderInline(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 6) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 3) {
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
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={key}>{part}</Fragment>
  })
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

function renderBlocks(text: string): React.ReactNode {
  const blocks = parseBlocks(text)
  return blocks.map((block, i) => {
    const last = i === blocks.length - 1
    const spacing = last ? undefined : { marginBottom: 8 }
    if (block.kind === 'para') {
      return (
        <div key={i} style={spacing}>
          {renderParagraphLines(block.lines, `p${i}`)}
        </div>
      )
    }
    const List = block.kind
    return (
      <List key={i} style={{ margin: '4px 0', paddingLeft: 20, ...spacing }}>
        {block.items.map((item, j) => (
          <li key={j}>{renderInline(item, `l${i}-${j}`)}</li>
        ))}
      </List>
    )
  })
}
