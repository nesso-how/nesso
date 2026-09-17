// SPDX-License-Identifier: MIT

/** Current on-disk graph document schema version. Bump only when the envelope shape changes. */
export const GRAPH_FORMAT_VERSION = 1 as const

type RawGraphDocument = Record<string, unknown>
type EnvelopeMigration = (document: RawGraphDocument) => RawGraphDocument

const ENVELOPE_MIGRATIONS: Partial<Record<number, EnvelopeMigration>> = {}

export class NewerGraphFormatError extends Error {
  readonly version: number

  constructor(version: number) {
    super(`This graph uses newer Nesso graph format version ${version}`)
    this.name = 'NewerGraphFormatError'
    this.version = version
  }
}

export class UnsupportedGraphFormatError extends Error {
  readonly version: number | undefined

  constructor(version: number | undefined) {
    super(
      version === undefined
        ? 'This graph does not declare a supported Nesso graph format version'
        : `Unsupported Nesso graph format version: ${version}`,
    )
    this.name = 'UnsupportedGraphFormatError'
    this.version = version
  }
}

function readEnvelopeVersion(document: RawGraphDocument): number {
  const version = document.version

  // Stryker disable next-line ConditionalExpression: typeof guard subsumed by !Number.isInteger and version < 0 — equivalent mutant
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new UnsupportedGraphFormatError(undefined)
  }

  return version
}

/**
 * Options for {@link migrateLadder}: one shared sequential-stepping loop for
 * every data-at-rest migration surface (graph envelope, vocabulary, graph
 * records). Each surface passes its own migration table and its own exact
 * error constructors; the ladder owns only the stepping mechanics: forward
 * guard, completion test, visited-set cycle detection, max-steps bound,
 * missing-step lookup, and the did-not-advance check.
 */
export interface MigrationLadderOptions<State, Version extends PropertyKey> {
  /** Version the ladder steps toward. */
  targetVersion: Version
  /** Migration table keyed by source version. */
  migrations: Partial<Record<Version, (state: State) => State>>
  /**
   * Read the version out of a (possibly migrated) state. May throw a
   * surface-specific error for malformed state; thrown errors propagate.
   */
  readVersion: (state: State) => Version
  /** True once stepping is done (exact match for discrete versions). */
  isComplete: (version: Version, target: Version) => boolean
  /** Optional forward guard: throw a surface-specific error for newer input. */
  assertNotNewer?: (version: Version, target: Version) => void
  /** Optional bound on applied steps; unbounded when omitted. */
  maxSteps?: number
  /** Error for a version with no migration step. */
  onMissingMigration: (version: Version) => Error
  /** Error for a migration that does not advance the version. */
  onStalledMigration: (version: Version, nextVersion: Version) => Error
  /** Error for a revisited version; defaults to a generic cycle error. */
  onCycle?: (version: Version) => Error
  /** Error for exceeding `maxSteps`; defaults to a generic steps error. */
  onTooManySteps?: (version: Version) => Error
  /**
   * Optional per-step strictness beyond advancement (e.g. numeric surfaces
   * requiring exactly version + 1). Throw a surface-specific error on
   * violation; thrown errors propagate.
   */
  assertStep?: (version: Version, nextVersion: Version) => void
}

function defaultMigrationCycleError<Version extends PropertyKey>(version: Version): Error {
  return new Error(`Migration cycle detected at version: ${String(version)}`)
}

function defaultTooManyMigrationStepsError<Version extends PropertyKey>(version: Version): Error {
  return new Error(`Migration exceeded the maximum number of steps at version: ${String(version)}`)
}

/**
 * Step a state through a migration table toward `targetVersion`, applying one
 * source-versioned migration at a time. Revisited versions throw (cycle),
 * versions with no step throw (missing migration), and migrations that do not
 * advance the version throw (stalled). Errors thrown by `readVersion`, by a
 * migration, or by the optional guards propagate unchanged.
 */
export function migrateLadder<State, Version extends PropertyKey>(
  input: State,
  options: MigrationLadderOptions<State, Version>,
): State {
  let current = input
  let version = options.readVersion(current)

  options.assertNotNewer?.(version, options.targetVersion)

  const maxSteps = options.maxSteps ?? Number.POSITIVE_INFINITY
  const visitedVersions = new Set<Version>()
  let migrationSteps = 0

  while (!options.isComplete(version, options.targetVersion)) {
    if (visitedVersions.has(version)) {
      throw (options.onCycle ?? defaultMigrationCycleError)(version)
    }
    if (migrationSteps >= maxSteps) {
      throw (options.onTooManySteps ?? defaultTooManyMigrationStepsError)(version)
    }
    visitedVersions.add(version)
    migrationSteps += 1

    const migrate = options.migrations[version]

    if (migrate === undefined) {
      throw options.onMissingMigration(version)
    }

    current = migrate(current)
    const nextVersion = options.readVersion(current)

    if (nextVersion === version) {
      throw options.onStalledMigration(version, nextVersion)
    }

    options.assertStep?.(version, nextVersion)

    version = nextVersion
  }

  return current
}

function migrateEnvelope(document: RawGraphDocument): RawGraphDocument {
  return migrateLadder(document, {
    targetVersion: GRAPH_FORMAT_VERSION,
    migrations: ENVELOPE_MIGRATIONS,
    readVersion: readEnvelopeVersion,
    isComplete: (version, target) => version === target,
    assertNotNewer: (version, target) => {
      if (version > target) {
        throw new NewerGraphFormatError(version)
      }
    },
    onMissingMigration: (version) => new UnsupportedGraphFormatError(version),
    /* c8 ignore start */ // envelope-step-checks are unreachable while ENVELOPE_MIGRATIONS is empty
    // Stryker disable next-line all: envelope-step-checks are unreachable while ENVELOPE_MIGRATIONS is empty
    onStalledMigration: (version) =>
      // Stryker disable next-line all: envelope-step-checks are unreachable while ENVELOPE_MIGRATIONS is empty
      new Error(`Envelope migration ${version} must produce version ${version + 1}`),
    // Stryker disable next-line all: envelope-step-checks are unreachable while ENVELOPE_MIGRATIONS is empty
    assertStep: (version, nextVersion) => {
      // Stryker disable next-line all: envelope-step-checks are unreachable while ENVELOPE_MIGRATIONS is empty
      if (nextVersion !== version + 1) {
        // Stryker disable next-line all: envelope-step-checks are unreachable while ENVELOPE_MIGRATIONS is empty
        throw new Error(`Envelope migration ${version} must produce version ${version + 1}`)
      }
    },
    /* c8 ignore stop */
  })
}

export interface GraphConcept<D extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  label: string
  x: number
  y: number
  data?: D
}

export interface GraphRelation<D extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  source: string
  target: string
  type?: string
  data?: D
}

export interface GraphDocument<
  NC extends Record<string, unknown> = Record<string, unknown>,
  RE extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
> {
  /** File format version — always {@link GRAPH_FORMAT_VERSION} for the current schema. */
  version: typeof GRAPH_FORMAT_VERSION
  /**
   * Vocabulary this graph was built with: its id (e.g. `@nesso-how/vocab-learning`)
   * and normative version. Opaque to schema, which only round-trips the reference.
   */
  vocabulary?: { id: string; version: string }
  /** Internal graph id (desktop sync); omitted in manual exports. */
  id?: string
  /** Last save time (Unix ms); desktop sync metadata. */
  updatedAt?: number
  name: string
  concepts: GraphConcept<NC>[]
  relations: GraphRelation<RE>[]
  meta?: M
}

/** Graph payload for {@link serialize} — format version is injected by the serializer. */
export type GraphDocumentInput<
  NC extends Record<string, unknown> = Record<string, unknown>,
  RE extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
> = Omit<GraphDocument<NC, RE, M>, 'version'>

/** Serialize a graph document to JSON with keys in a stable, human-readable order. */
export function serialize<
  NC extends Record<string, unknown>,
  RE extends Record<string, unknown>,
  M extends Record<string, unknown>,
>(doc: GraphDocumentInput<NC, RE, M>): string {
  const { vocabulary, id, updatedAt, name, concepts, relations, meta } = doc
  return JSON.stringify(
    {
      version: GRAPH_FORMAT_VERSION,
      // Stryker disable next-line ConditionalExpression: JSON.stringify drops undefined values, so always spreading {vocabulary:undefined} is equivalent
      ...(vocabulary !== undefined && { vocabulary }),
      // Stryker disable next-line ConditionalExpression: JSON.stringify drops undefined values, so always spreading {id:undefined} is equivalent
      ...(id !== undefined && { id }),
      // Stryker disable next-line ConditionalExpression: JSON.stringify drops undefined values, so always spreading {updatedAt:undefined} is equivalent
      ...(updatedAt !== undefined && { updatedAt }),
      name,
      concepts,
      relations,
      // Stryker disable next-line ConditionalExpression: JSON.stringify drops undefined values, so always spreading {meta:undefined} is equivalent
      ...(meta !== undefined && { meta }),
    },
    null,
    2,
  )
}

/**
 * Canonical plain-object guard shared across the monorepo: accepts only
 * objects with `Object.prototype` or a null prototype; rejects arrays,
 * class instances, and functions.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype: object | null = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Parse and structurally validate a graph document. Files are user-editable (and
 * importable from anywhere), so each element is checked before it can reach
 * the store: a concept without a valid id/position crashes the canvas and would
 * then be re-persisted. Vocabulary-specific normalization is the caller's responsibility.
 */
export function deserialize<
  NC extends Record<string, unknown> = Record<string, unknown>,
  RE extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
>(json: string): GraphDocument<NC, RE, M> {
  const parsed: unknown = JSON.parse(json)

  if (!isPlainObject(parsed)) {
    throw new Error('Invalid Nesso graph document')
  }

  const data = migrateEnvelope(parsed)

  if (!Array.isArray(data.concepts) || !Array.isArray(data.relations)) {
    throw new Error('Invalid Nesso graph document: missing concepts or relations array')
  }
  const rawConcepts: unknown[] = data.concepts
  const concepts: GraphConcept<NC>[] = rawConcepts.map((value: unknown, i: number) => {
    if (
      !isPlainObject(value) ||
      typeof value.id !== 'string' ||
      value.id === '' ||
      typeof value.label !== 'string' ||
      // Stryker disable next-line ConditionalExpression: typeof x guard subsumed by !Number.isFinite — equivalent mutant
      typeof value.x !== 'number' ||
      !Number.isFinite(value.x) ||
      // Stryker disable next-line ConditionalExpression: typeof y guard subsumed by !Number.isFinite — equivalent mutant
      typeof value.y !== 'number' ||
      !Number.isFinite(value.y)
    ) {
      throw new Error(
        `Invalid Nesso graph document: concept ${i} is missing a valid id, label, or position`,
      )
    }
    const conceptData: NC | undefined = value.data as NC | undefined
    return {
      id: value.id,
      label: value.label,
      x: value.x,
      y: value.y,
      ...(conceptData !== undefined && { data: conceptData }),
    } as GraphConcept<NC>
  })
  const rawRelations: unknown[] = data.relations
  const relations: GraphRelation<RE>[] = rawRelations.map((value: unknown, i: number) => {
    if (
      !isPlainObject(value) ||
      typeof value.id !== 'string' ||
      typeof value.source !== 'string' ||
      typeof value.target !== 'string'
    ) {
      throw new Error(`Invalid Nesso graph document: relation ${i} is missing id, source or target`)
    }
    const relationType: string | undefined = typeof value.type === 'string' ? value.type : undefined
    const relationData: RE | undefined = value.data as RE | undefined
    return {
      id: value.id,
      source: value.source,
      target: value.target,
      ...(relationType !== undefined && { type: relationType }),
      ...(relationData !== undefined && { data: relationData }),
    } as GraphRelation<RE>
  })
  const name: string = typeof data.name === 'string' ? data.name : ''
  const docId: string | undefined = typeof data.id === 'string' ? data.id : undefined
  const updatedAt: number | undefined =
    typeof data.updatedAt === 'number' ? data.updatedAt : undefined
  let vocabulary: { id: string; version: string } | undefined
  const vocabValue: unknown = data.vocabulary
  if (
    isPlainObject(vocabValue) &&
    typeof vocabValue.id === 'string' &&
    typeof vocabValue.version === 'string'
  ) {
    vocabulary = { id: vocabValue.id, version: vocabValue.version }
  }
  let meta: M | undefined
  if (isPlainObject(data.meta)) {
    meta = data.meta as M
  }
  return {
    version: GRAPH_FORMAT_VERSION,
    ...(vocabulary !== undefined && { vocabulary }),
    ...(docId !== undefined && { id: docId }),
    ...(updatedAt !== undefined && { updatedAt }),
    name,
    concepts,
    relations,
    ...(meta !== undefined && { meta }),
  }
}
