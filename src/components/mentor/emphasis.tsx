// SPDX-License-Identifier: MIT

/** Render `*word*` segments as italic emphasis (Socrates reply styling). */
export function renderWithEmphasis(text: string): React.ReactNode {
  const parts = text.split(/(\*[^*\n]+\*)/g)
  return parts.map((p, i) => {
    if (p.length >= 3 && p.startsWith('*') && p.endsWith('*')) {
      return <em key={i}>{p.slice(1, -1)}</em>
    }
    return p
  })
}
