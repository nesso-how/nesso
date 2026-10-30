import type { VocabDefinition } from '@nesso-how/plugin'

export const relationIds = {
  linksTo: 'urn:uuid:c7aeeb73-f438-5bc6-a02b-87c06755a15d',
  partOf: 'urn:uuid:6e17da14-65d3-5752-a73b-c9be499e7dc1',
  causes: 'urn:uuid:d0804bfa-37bc-507b-a469-8e0c4d694314',
  kindOf: 'urn:uuid:5fc5360c-cc6d-5f1b-919b-460f1aebb2c1',
  dependsOn: 'urn:uuid:c397889b-cd8c-5ecb-ace8-2c64eb08b68e',
  exampleOf: 'urn:uuid:5dc6fba9-f6d9-5c8a-b8b0-4c2cab405d7a',
  contradicts: 'urn:uuid:3370d2fa-93d4-546f-a673-40fecc6ece5c',
  defines: 'urn:uuid:5c410d1e-66bf-5b83-ae3f-ee6b1516dd16',
  enables: 'urn:uuid:d0b446ba-f3c9-514b-a046-9611c1af18b5',
  precedes: 'urn:uuid:2f232a4b-1ea4-55fc-a2df-eafad150c655',
} as const

export const defaultRelationId = relationIds.linksTo

export const defaultRelationTypes: VocabDefinition['relationTypes'] = Object.entries(
  relationIds,
).map(([label, id]) => ({ id, label }))

export const create = (): VocabDefinition => ({
  id: 'base-vocab',
  relationTypes: defaultRelationTypes,
  defaultTypeId: defaultRelationId,
})
