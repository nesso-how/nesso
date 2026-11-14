import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { toCanvas } from 'html-to-image'
import { defaultLocale } from '@nesso-how/i18n'
import { indexGraph } from './adapters'
import { presentedGraph } from './types'
import type { ConceptMapContext } from './store'
import type { ConceptMapPresentation } from './presentation'
import { ImageCanvas } from './ImageCanvas'
import { imageBounds, ConceptMapImageError } from './image-bounds'
import '@xyflow/react/dist/style.css'
import './styles.css'

export async function renderConceptMapImage({
  store,
  theme,
  scale = 2,
  signal,
  presentation,
}: {
  store: ConceptMapContext['store']
  theme: Readonly<Record<string, string>>
  scale?: 2 | 4
  signal: AbortSignal
  presentation?: ConceptMapPresentation
}): Promise<HTMLCanvasElement> {
  const fail = (message: string) => new ConceptMapImageError([{ path: 'image', message }])
  const state = store.getState()
  const graph = presentedGraph(state)
  if (signal.aborted) throw fail('Image rendering cancelled')
  if (!graph.concepts.length) throw fail('Cannot render an empty view')
  const element = document.createElement('div')
  element.className = 'graph-image-export'
  element.setAttribute('aria-hidden', 'true')
  element.inert = true
  Object.assign(element.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: '1024px',
    height: '768px',
    pointerEvents: 'none',
    fontFamily: theme['font-sans'],
    color: theme.foreground,
  })
  for (const [key, value] of Object.entries(theme)) element.style.setProperty(`--${key}`, value)
  const mount = document.createElement('div')
  Object.assign(mount.style, { width: '100%', height: '100%' })
  element.append(mount)
  document.body.append(element)
  const root = createRoot(mount)
  let abort: () => void = () => {}
  const check = () => {
    if (signal.aborted) throw fail('Image rendering cancelled')
  }
  const render = async () => {
    const texts = new Map<string, string[]>()
    for (const concept of graph.concepts) {
      const font = `${concept.italic ? 'italic' : 'normal'} ${concept.bold ? 600 : 400} 13.5px ${theme['font-sans']}`
      const labels = texts.get(font) ?? []
      labels.push(concept.label)
      texts.set(font, labels)
    }
    const indexed = indexGraph(graph, state.vocabs, state.preferences.locale ?? defaultLocale)
    texts.set(
      `11px ${theme['font-mono']}`,
      [...indexed.relationTypes.values()].map(({ label }) => label),
    )
    await Promise.all(
      [...texts].map(([font, labels]) => document.fonts.load(font, labels.join(''))),
    )
    await document.fonts.ready
    check()
    const edgeCount = await new Promise<number>((resolve) =>
      root.render(createElement(ImageCanvas, { store, presentation, ready: resolve })),
    )
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    check()
    const viewport = mount.querySelector<HTMLElement>('.react-flow__viewport')!
    if (viewport.querySelectorAll('.react-flow__edge-path').length !== edgeCount)
      throw fail('Could not render every relation')
    const origin = viewport.getBoundingClientRect()
    const rects = [
      ...viewport.querySelectorAll(
        '.react-flow__node, .react-flow__edge-path, .react-flow__edge-textwrapper',
      ),
    ].map((node) => {
      const rect = node.getBoundingClientRect()
      return {
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      }
    })
    const bounds = imageBounds(rects, scale)
    const canvas = await toCanvas(viewport, {
      width: bounds.width,
      height: bounds.height,
      pixelRatio: bounds.scale,
      skipAutoScale: true,
      backgroundColor: theme.canvas,
      style: {
        transform: `translate(${-bounds.x}px, ${-bounds.y}px) scale(1)`,
        transformOrigin: '0 0',
      },
    })
    check()
    if (
      canvas.width !== bounds.width * bounds.scale ||
      canvas.height !== bounds.height * bounds.scale
    )
      throw fail('Image dimensions changed during rendering')
    return canvas
  }
  try {
    return await Promise.race([
      render(),
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(fail('Image rendering cancelled'))
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      }),
    ])
  } finally {
    signal.removeEventListener('abort', abort)
    root.unmount()
    element.remove()
  }
}
