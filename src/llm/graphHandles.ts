// SPDX-License-Identifier: MIT

type GraphItemKind = 'node' | 'edge'

export interface GraphIdHandles {
  nodeHandle(id: string): string
  edgeHandle(id: string): string
  resolveNodeHandle(handle: string): string | undefined
  resolveEdgeHandle(handle: string): string | undefined
}

const MAX_HANDLE_LENGTH = 200
const REVERSIBLE_HANDLE_PREFIX = 'x'
const DIGEST_HANDLE_PREFIX = 'h'
const HEX = '0123456789abcdef'
const SAFE_NODE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/

const SHA256_ROUNDS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const

const INITIAL_HASH = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const

function utf16Bytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length * 2)
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    bytes[index * 2] = codeUnit >>> 8
    bytes[index * 2 + 1] = codeUnit & 0xff
  }
  return bytes
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount))
}

/** SHA-256 keeps oversized handles bounded without truncating their source ids. */
function sha256(value: string): string {
  const source = utf16Bytes(value)
  const bitLength = source.length * 8
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(source)
  padded[source.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 2 ** 32), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  const hash = [...INITIAL_HASH] as number[]
  const schedule = new Uint32Array(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = view.getUint32(offset + index * 4, false)
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(schedule[index - 15]!, 7) ^
        rotateRight(schedule[index - 15]!, 18) ^
        (schedule[index - 15]! >>> 3)
      const s1 =
        rotateRight(schedule[index - 2]!, 17) ^
        rotateRight(schedule[index - 2]!, 19) ^
        (schedule[index - 2]! >>> 10)
      schedule[index] = (schedule[index - 16]! + s0 + schedule[index - 7]! + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = hash
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temp1 = (h + sum1 + choice + SHA256_ROUNDS[index]! + schedule[index]!) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }
    hash[0] = (hash[0]! + a) >>> 0
    hash[1] = (hash[1]! + b) >>> 0
    hash[2] = (hash[2]! + c) >>> 0
    hash[3] = (hash[3]! + d) >>> 0
    hash[4] = (hash[4]! + e) >>> 0
    hash[5] = (hash[5]! + f) >>> 0
    hash[6] = (hash[6]! + g) >>> 0
    hash[7] = (hash[7]! + h) >>> 0
  }

  return hash.map((word) => word.toString(16).padStart(8, '0')).join('')
}

function encodeHex(value: string): string {
  return Array.from(utf16Bytes(value), (byte) => HEX[byte >> 4]! + HEX[byte & 0x0f]!).join('')
}

function handlePrefix(kind: GraphItemKind): string {
  return `${kind}~`
}

function itemKey(kind: GraphItemKind, id: string): string {
  return `${kind}\u0000${id}`
}

function handleFor(kind: GraphItemKind, id: string): string {
  if (kind === 'node' && SAFE_NODE_ID.test(id)) return id
  const prefix = handlePrefix(kind)
  const encoded = `${prefix}${REVERSIBLE_HANDLE_PREFIX}${encodeHex(id)}`
  if (encoded.length <= MAX_HANDLE_LENGTH) return encoded
  return `${prefix}${DIGEST_HANDLE_PREFIX}${sha256(itemKey(kind, id))}`
}

function knownItems(
  nodes: readonly { id: string }[],
  edges: readonly { id: string }[],
): {
  nodeIds: Set<string>
  edgeIds: Set<string>
  nodeHandles: Map<string, string>
  edgeHandles: Map<string, string>
} {
  return {
    nodeIds: new Set(nodes.map(({ id }) => id)),
    edgeIds: new Set(edges.map(({ id }) => id)),
    nodeHandles: new Map(nodes.map(({ id }) => [handleFor('node', id), id])),
    edgeHandles: new Map(edges.map(({ id }) => [handleFor('edge', id), id])),
  }
}

function resolveHandle(
  handle: string,
  ids: Set<string>,
  generatedHandles: Map<string, string>,
): string | undefined {
  const generatedId = generatedHandles.get(handle)
  if (generatedId !== undefined) return generatedId
  return ids.has(handle) ? handle : undefined
}

export function createGraphIdHandles(
  nodes: readonly { id: string }[],
  edges: readonly { id: string }[],
): GraphIdHandles {
  const { nodeIds, edgeIds, nodeHandles, edgeHandles } = knownItems(nodes, edges)
  return {
    nodeHandle: (id) => handleFor('node', id),
    edgeHandle: (id) => handleFor('edge', id),
    resolveNodeHandle: (handle) => resolveHandle(handle, nodeIds, nodeHandles),
    resolveEdgeHandle: (handle) => resolveHandle(handle, edgeIds, edgeHandles),
  }
}
