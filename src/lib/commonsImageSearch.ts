// SPDX-License-Identifier: MIT
export interface WikiImage {
  title: string
  thumbUrl: string
  descriptionUrl: string
}

export async function searchCommonsImages(query: string): Promise<WikiImage[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url|thumburl|descriptionurl',
    iiurlwidth: '200',
    format: 'json',
    origin: '*',
  })
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`)
  if (!res.ok) throw new Error('Search failed')
  const data: {
    query?: {
      pages?: Record<
        string,
        { title: string; imageinfo?: Array<{ thumburl?: string; descriptionurl?: string }> }
      >
    }
  } = await res.json()
  const pages = data.query?.pages
  if (!pages) return []
  return Object.values(pages)
    .filter((p) => p.imageinfo?.[0]?.thumburl)
    .map((p) => {
      const info = p.imageinfo![0]
      const descriptionUrl =
        info.descriptionurl ??
        `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`
      return { title: p.title, thumbUrl: info.thumburl!, descriptionUrl }
    })
}
