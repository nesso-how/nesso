import type { Plugin, VocabDefinition } from '@nesso/plugin'

export const relationIds = {
  linksTo: 'urn:uuid:c7aeeb73-f438-5bc6-a02b-87c06755a15d',
  partOf: 'urn:uuid:6e17da14-65d3-5752-a73b-c9be499e7dc1',
  causes: 'urn:uuid:d0804bfa-37bc-507b-a469-8e0c4d694314',
  kindOf: 'urn:uuid:5fc5360c-cc6d-5f1b-919b-460f1aebb2c1',
} as const

export const defaultRelationId = relationIds.linksTo

export const defaultRelationTypes: VocabDefinition['relationTypes'] =
  Object.entries(relationIds).map(([label, id]) => ({ id, label }))

export const vocabPlugin: Plugin = {
  operations: [],
  create: () => ({
    vocabs: [{
      id: 'nesso-default',
      label: 'Nesso',
      relationTypes: defaultRelationTypes,
      defaultTypeId: defaultRelationId,
    }],
  }),
}
