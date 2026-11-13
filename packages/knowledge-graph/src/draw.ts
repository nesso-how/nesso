import { resolveRelationTypeLabel, type NessoState } from '@nesso-how/core'
import { defaultLocale } from '@nesso-how/i18n'
import type { Bubble, Line } from './layout.ts'

export type Theme = Readonly<
  Record<
    | 'canvas'
    | 'foreground'
    | 'muted-foreground'
    | 'edge'
    | 'primary'
    | 'selection-halo'
    | 'node-border'
    | 'background'
    | 'font-sans'
    | 'font-mono',
    string
  >
>
export type Transform = { readonly x: number; readonly y: number; readonly k: number }
export type Highlight = {
  readonly concepts: ReadonlySet<string>
  readonly relations: ReadonlySet<string>
  readonly hovered: string | null
}

const labelGap = 14

export const readTheme = (value: (token: keyof Theme) => string): Theme =>
  Object.fromEntries(
    (
      [
        'canvas',
        'foreground',
        'muted-foreground',
        'edge',
        'primary',
        'selection-halo',
        'node-border',
        'background',
        'font-sans',
        'font-mono',
      ] as const
    ).map((token) => [token, value(token)]),
  ) as Theme

export const relationLabels = ({
  graph,
  vocabs,
  preferences,
}: Pick<NessoState, 'graph' | 'vocabs' | 'preferences'>) => {
  const locale = preferences.locale ?? defaultLocale
  const fallback = vocabs.find(({ id }) => id === preferences.activeVocabId)?.defaultTypeId
  return new Map(
    graph.relationTypes.map((type) => [
      type.id,
      type.id === fallback ? undefined : resolveRelationTypeLabel(type, vocabs, locale),
    ]),
  )
}

export const bounds = (bubbles: readonly Bubble[]) => {
  const xs = bubbles.flatMap(({ x, radius }) => [x! - radius - 120, x! + radius + 120])
  const ys = bubbles.flatMap(({ y, radius }) => [y! - radius, y! + radius + labelGap + 12])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export function draw(
  context: CanvasRenderingContext2D,
  {
    bubbles,
    lines,
    labels,
  }: {
    bubbles: readonly Bubble[]
    lines: readonly Line[]
    labels: ReadonlyMap<string, string | undefined>
  },
  theme: Theme,
  { x: tx, y: ty, k }: Transform,
  { concepts, relations, hovered }: Highlight,
) {
  const labelScale = Math.min(k, 1)
  const border = `color-mix(in srgb, ${theme['node-border']} 80%, ${theme['muted-foreground']})`
  const point = ({ x, y }: Bubble) => ({ x: x! * k + tx, y: y! * k + ty })
  const near = new Set(concepts)
  for (const { source, target } of lines) {
    if (concepts.has(source.id)) near.add(target.id)
    if (concepts.has(target.id)) near.add(source.id)
  }
  const dim = (...ids: string[]) =>
    concepts.size > 0 && !ids.some((id) => concepts.has(id)) ? 0.2 : 1
  const lit = (id: string) => relations.has(id) || id === hovered
  const shown = lines.filter(
    ({ id, source, target }) =>
      lit(id) || [source.id, target.id].some((end) => end === hovered || concepts.has(end)),
  )
  context.fillStyle = theme.canvas
  context.fillRect(0, 0, context.canvas.width, context.canvas.height)
  context.lineCap = 'round'
  for (const line of lines) {
    const from = point(line.source)
    const to = point(line.target)
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const clearance = line.target.radius * k + 1.5
    const end = {
      x: to.x - Math.cos(angle) * clearance,
      y: to.y - Math.sin(angle) * clearance,
    }
    const active = shown.includes(line)
    context.globalAlpha = lit(line.id) ? 1 : dim(line.source.id, line.target.id)
    context.strokeStyle = context.fillStyle = active ? theme.foreground : theme.edge
    context.lineWidth = active ? 1.25 : 0.75
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(end.x, end.y)
    context.stroke()
    context.fillStyle = active ? theme.foreground : theme['muted-foreground']
    context.beginPath()
    context.moveTo(end.x, end.y)
    for (const side of [-1, 1])
      context.lineTo(
        end.x - Math.cos(angle + side * 0.45) * 6 * labelScale,
        end.y - Math.sin(angle + side * 0.45) * 6 * labelScale,
      )
    context.fill()
  }
  context.textAlign = 'center'
  context.textBaseline = 'top'
  for (const bubble of bubbles) {
    const { x, y } = point(bubble)
    const radius = bubble.radius * k
    const selected = concepts.has(bubble.id)
    context.globalAlpha = 1
    context.fillStyle = theme.canvas
    context.beginPath()
    context.arc(x, y, radius + 0.75, 0, 2 * Math.PI)
    context.fill()
    context.globalAlpha = near.has(bubble.id) || concepts.size === 0 ? 1 : 0.2
    if (selected) {
      context.fillStyle = theme['selection-halo']
      context.beginPath()
      context.arc(x, y, radius + 5, 0, 2 * Math.PI)
      context.fill()
    }
    context.fillStyle = selected ? theme.primary : theme.background
    context.strokeStyle = selected || bubble.id === hovered ? theme.primary : border
    context.lineWidth = selected || bubble.id === hovered ? 1.5 : 1
    context.beginPath()
    context.arc(x, y, radius, 0, 2 * Math.PI)
    context.fill()
    context.stroke()
    if (k < 0.45 && !selected && bubble.id !== hovered && !near.has(bubble.id)) continue
    context.fillStyle = theme.foreground
    context.font = `${selected ? 600 : 400} ${12 * labelScale}px ${theme['font-sans']}`
    const label = bubble.label.length > 32 ? `${bubble.label.slice(0, 31)}…` : bubble.label
    context.strokeStyle = theme.canvas
    context.lineWidth = 4 * labelScale
    context.lineJoin = 'round'
    context.strokeText(label, x, y + radius + 4 * labelScale)
    context.fillText(label, x, y + radius + 4 * labelScale)
  }
  context.font = `${11 * labelScale}px ${theme['font-mono']}`
  context.textBaseline = 'middle'
  for (const line of shown) {
    const label = labels.get(line.predicate)
    if (!label) continue
    const from = point(line.source)
    const to = point(line.target)
    const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    const width = context.measureText(label).width + 12 * labelScale
    context.globalAlpha = 0.94
    context.fillStyle = theme.background
    context.fillRect(middle.x - width / 2, middle.y - 9 * labelScale, width, 18 * labelScale)
    context.globalAlpha = 1
    context.fillStyle = theme['muted-foreground']
    context.fillText(label, middle.x, middle.y)
  }
  context.globalAlpha = 1
}
