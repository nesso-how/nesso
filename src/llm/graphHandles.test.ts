// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { createGraphIdHandles } from './graphHandles'

describe('createGraphIdHandles', () => {
  it('keeps a handle stable when a colliding item is added or removed', () => {
    const nodeId = 'shared'
    const edgeId = 'shared'
    const nodeBefore = createGraphIdHandles([{ id: nodeId }], [])
    const before = createGraphIdHandles([], [{ id: edgeId }])
    const nodeHandle = nodeBefore.nodeHandle(nodeId)
    const handle = before.edgeHandle(edgeId)

    const withCollidingNode = createGraphIdHandles([{ id: edgeId }], [{ id: edgeId }])
    const afterEdgeRemoval = createGraphIdHandles([{ id: nodeId }], [])
    const afterNodeRemoval = createGraphIdHandles([], [{ id: edgeId }])

    expect(nodeHandle).not.toBe(handle)
    expect(withCollidingNode.nodeHandle(nodeId)).toBe(nodeHandle)
    expect(withCollidingNode.resolveNodeHandle(nodeHandle)).toBe(nodeId)
    expect(afterEdgeRemoval.resolveNodeHandle(nodeHandle)).toBe(nodeId)
    expect(handle).toMatch(/^edge~/)
    expect(withCollidingNode.edgeHandle(edgeId)).toBe(handle)
    expect(withCollidingNode.resolveEdgeHandle(handle)).toBe(edgeId)
    expect(afterNodeRemoval.resolveEdgeHandle(handle)).toBe(edgeId)
  })

  it('uses distinct bounded namespaces and resolves long ids exactly', () => {
    const firstId = `${'same-prefix-'.repeat(30)}first`
    const secondId = `${'same-prefix-'.repeat(30)}second`
    const handles = createGraphIdHandles([{ id: firstId }, { id: secondId }], [{ id: firstId }])

    const firstNodeHandle = handles.nodeHandle(firstId)
    const secondNodeHandle = handles.nodeHandle(secondId)
    const firstEdgeHandle = handles.edgeHandle(firstId)

    expect(firstNodeHandle).toMatch(/^node~/)
    expect(firstEdgeHandle).toMatch(/^edge~/)
    expect(firstNodeHandle).not.toBe(firstEdgeHandle)
    expect(firstNodeHandle).not.toBe(secondNodeHandle)
    expect(firstNodeHandle.length).toBeLessThanOrEqual(200)
    expect(secondNodeHandle.length).toBeLessThanOrEqual(200)
    expect(handles.resolveNodeHandle(firstNodeHandle)).toBe(firstId)
    expect(handles.resolveNodeHandle(secondNodeHandle)).toBe(secondId)
    expect(handles.resolveEdgeHandle(firstEdgeHandle)).toBe(firstId)
  })

  it('uses the full kind-scoped SHA-256 digest for oversized ids', () => {
    const id = 'x'.repeat(200)
    const handles = createGraphIdHandles([{ id }], [])

    expect(handles.nodeHandle(id)).toBe(
      'node~h13aa9dd60128d6b6bc22f67dcd0fb48a768fd0643c81ff330cfaaa8ab0b15909',
    )
  })

  it('keeps lone UTF-16 surrogates distinct from replacement characters', () => {
    const loneSurrogate = '\uD800'
    const replacementCharacter = '\uFFFD'
    const handles = createGraphIdHandles([{ id: loneSurrogate }, { id: replacementCharacter }], [])

    const loneHandle = handles.nodeHandle(loneSurrogate)
    const replacementHandle = handles.nodeHandle(replacementCharacter)

    expect(loneHandle).not.toBe(replacementHandle)
    expect(handles.resolveNodeHandle(loneHandle)).toBe(loneSurrogate)
    expect(handles.resolveNodeHandle(replacementHandle)).toBe(replacementCharacter)
  })

  it('keeps oversized lone UTF-16 surrogates distinct in digest handles', () => {
    const loneSurrogate = `${'x'.repeat(200)}\uD800`
    const replacementCharacter = `${'x'.repeat(200)}\uFFFD`
    const handles = createGraphIdHandles([{ id: loneSurrogate }, { id: replacementCharacter }], [])

    const loneHandle = handles.nodeHandle(loneSurrogate)
    const replacementHandle = handles.nodeHandle(replacementCharacter)

    expect(loneHandle).toMatch(/^node~h[0-9a-f]{64}$/)
    expect(replacementHandle).toMatch(/^node~h[0-9a-f]{64}$/)
    expect(loneHandle).not.toBe(replacementHandle)
    expect(handles.resolveNodeHandle(loneHandle)).toBe(loneSurrogate)
    expect(handles.resolveNodeHandle(replacementHandle)).toBe(replacementCharacter)
  })

  it('prioritizes exact generated handles over reserved raw ids for nodes and edges', () => {
    const nodeSourceId = 'ab!'
    const nodeRawId = 'node~x006100620021'
    const edgeRawId = 'edge~x00650066'
    const nodeDigestSourceId = 'n'.repeat(200)
    const edgeDigestSourceId = 'e'.repeat(200)
    const sourceHandles = createGraphIdHandles([], [])
    const nodeDigestRawId = sourceHandles.nodeHandle(nodeDigestSourceId)
    const edgeDigestRawId = sourceHandles.edgeHandle(edgeDigestSourceId)
    const handles = createGraphIdHandles(
      [
        { id: nodeSourceId },
        { id: nodeRawId },
        { id: 'node~hdeadbeef' },
        { id: nodeDigestSourceId },
        { id: nodeDigestRawId },
      ],
      [
        { id: 'ef' },
        { id: edgeRawId },
        { id: 'edge~hdeadbeef' },
        { id: edgeDigestSourceId },
        { id: edgeDigestRawId },
      ],
    )

    expect(handles.nodeHandle(nodeSourceId)).toBe(nodeRawId)
    expect(handles.edgeHandle('ef')).toBe(edgeRawId)
    expect(handles.resolveNodeHandle(nodeRawId)).toBe(nodeSourceId)
    expect(handles.resolveEdgeHandle(edgeRawId)).toBe('ef')
    expect(handles.resolveNodeHandle(handles.nodeHandle(nodeRawId))).toBe(nodeRawId)
    expect(handles.resolveEdgeHandle(handles.edgeHandle(edgeRawId))).toBe(edgeRawId)
    expect(handles.resolveNodeHandle(nodeDigestRawId)).toBe(nodeDigestSourceId)
    expect(handles.resolveEdgeHandle(edgeDigestRawId)).toBe(edgeDigestSourceId)
    expect(handles.resolveNodeHandle(handles.nodeHandle(nodeDigestRawId))).toBe(nodeDigestRawId)
    expect(handles.resolveEdgeHandle(handles.edgeHandle(edgeDigestRawId))).toBe(edgeDigestRawId)
    expect(handles.resolveNodeHandle('node~hdeadbeef')).toBe('node~hdeadbeef')
    expect(handles.resolveEdgeHandle('edge~hdeadbeef')).toBe('edge~hdeadbeef')
  })

  it('keeps generated and raw compatibility lookup correct as membership changes', () => {
    const shadowedNodeId = createGraphIdHandles([], []).nodeHandle('node!')
    const shadowedEdgeId = createGraphIdHandles([], []).edgeHandle('edge')
    const both = createGraphIdHandles(
      [{ id: 'node!' }, { id: shadowedNodeId }],
      [{ id: 'edge' }, { id: shadowedEdgeId }],
    )

    expect(both.resolveNodeHandle(shadowedNodeId)).toBe('node!')
    expect(both.resolveNodeHandle(both.nodeHandle(shadowedNodeId))).toBe(shadowedNodeId)
    expect(both.resolveEdgeHandle(shadowedEdgeId)).toBe('edge')
    expect(both.resolveEdgeHandle(both.edgeHandle(shadowedEdgeId))).toBe(shadowedEdgeId)

    const afterShadowedRemoval = createGraphIdHandles(
      [{ id: shadowedNodeId }],
      [{ id: shadowedEdgeId }],
    )
    expect(afterShadowedRemoval.resolveNodeHandle(shadowedNodeId)).toBe(shadowedNodeId)
    expect(afterShadowedRemoval.resolveEdgeHandle(shadowedEdgeId)).toBe(shadowedEdgeId)
  })
})
