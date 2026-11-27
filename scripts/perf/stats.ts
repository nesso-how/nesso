const quantile = (sorted: readonly number[], q: number) => {
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

export function summarize(samples: readonly number[]) {
  const sorted = samples.toSorted((a, b) => a - b)
  const median = quantile(sorted, 0.5)
  return { median, spread: median ? (quantile(sorted, 0.75) - quantile(sorted, 0.25)) / median : 0 }
}

export function growth(points: readonly { size: number; median: number }[]) {
  const valid = points.filter(({ size, median }) => size > 0 && median > 0)
  if (valid.length < 2) return undefined
  const xs = valid.map(({ size }) => Math.log(size))
  const ys = valid.map(({ median }) => Math.log(median))
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const x = mean(xs)
  const y = mean(ys)
  const variance = xs.reduce((sum, value) => sum + (value - x) ** 2, 0)
  if (!variance) return undefined
  return xs.reduce((sum, value, index) => sum + (value - x) * (ys[index] - y), 0) / variance
}
