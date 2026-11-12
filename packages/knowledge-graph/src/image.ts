import type { NessoState } from '@nesso-how/core'
import { NessoError } from '@nesso-how/errors'
import { bounds, draw, readTheme, relationLabels } from './draw.ts'
import { settle, type KnowledgeGraphLayout } from './layout.ts'

class KnowledgeGraphImageError extends NessoError {
  override name = 'KnowledgeGraphImageError'
}

const margin = 32

export async function renderKnowledgeGraphImage({
  state,
  layout,
  theme,
  scale = 2,
  signal,
}: {
  state: Pick<NessoState, 'graph' | 'vocabs' | 'preferences'>
  layout: KnowledgeGraphLayout
  theme: Readonly<Record<string, string>>
  scale?: 2 | 4
  signal: AbortSignal
}): Promise<{ mediaType: 'image/png'; base64: string }> {
  const fail = (message: string) => new KnowledgeGraphImageError([{ path: 'image', message }])
  const check = () => {
    if (signal.aborted) throw fail('Image rendering cancelled')
  }
  check()
  const { bubbles, lines } = settle(state.graph, layout)
  if (!bubbles.length) throw fail('Cannot render an empty graph')
  const colors = readTheme((token) => theme[token] ?? '')
  await document.fonts.load(`12px ${colors['font-sans']}`)
  await document.fonts.ready
  check()
  const box = bounds(bubbles)
  const width = Math.ceil(box.width + margin * 2)
  const height = Math.ceil(box.height + margin * 2)
  const ratio = [4, 2, 1].find(
    (value) =>
      value <= scale &&
      width * value <= 8192 &&
      height * value <= 8192 &&
      width * height * value * value <= 16_777_216,
  )
  if (!ratio) throw fail('Image exceeds the dimension or pixel budget')
  const canvas = document.createElement('canvas')
  canvas.width = width * ratio
  canvas.height = height * ratio
  const context = canvas.getContext('2d')!
  context.scale(ratio, ratio)
  draw(
    context,
    { bubbles, lines, labels: relationLabels(state) },
    colors,
    { x: margin - box.x, y: margin - box.y, k: 1 },
    { concepts: new Set(), relations: new Set(), hovered: null },
  )
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(fail('Could not encode PNG'))),
      'image/png',
    ),
  )
  if (blob.size > 16 * 1024 * 1024) throw fail('Image exceeds the file byte budget')
  check()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return { mediaType: 'image/png', base64: btoa(binary) }
}
