export const viewportKey = (rendererId: string, viewId: string | null): string =>
  JSON.stringify([rendererId, viewId])
