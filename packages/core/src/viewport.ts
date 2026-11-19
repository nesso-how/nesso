export const viewportKey = (rendererId: string, mapId: string | null): string =>
  JSON.stringify([rendererId, mapId])
