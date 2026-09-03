import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Plugin } from '@opencode-ai/plugin'

const MODEL_FILE = '.opencode/models.json'
const DEFAULT_MODEL = 'opencode/big-pickle'
const ROLES = ['architect', 'general', 'explore'] as const

type Role = (typeof ROLES)[number]
type RoleOverrides = { model?: string; reasoningEffort?: string }
type Overrides = Partial<Record<Role, RoleOverrides>>

const STARTER_DEFAULTS: Record<Role, RoleOverrides> = {
  architect: { model: DEFAULT_MODEL, reasoningEffort: 'xhigh' },
  general: { model: DEFAULT_MODEL, reasoningEffort: 'max' },
  explore: { model: DEFAULT_MODEL, reasoningEffort: 'max' },
}
const DEFAULT_FILE = `${JSON.stringify(STARTER_DEFAULTS, null, 2)}\n`
const MODEL_ID = /^[^/\s]+\/\S+$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value)

const isMissingFile = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT'

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const parseModel = (name: Role, value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${MODEL_FILE}: model for role "${name}" must be a string`)
  }
  if (!MODEL_ID.test(value)) {
    throw new Error(
      `Invalid ${MODEL_FILE}: model for role "${name}" must be a provider/model reference`,
    )
  }
  return value
}

const parseReasoningEffort = (name: Role, value: unknown): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Invalid ${MODEL_FILE}: reasoningEffort for role "${name}" must be a non-empty string`,
    )
  }
  return value.trim()
}

const parseRole = (name: Role, value: unknown): RoleOverrides => {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${MODEL_FILE}: role "${name}" must be an object`)
  }

  const entry: RoleOverrides = {}
  for (const [field, fieldValue] of Object.entries(value)) {
    if (field === 'model') {
      entry.model = parseModel(name, fieldValue)
    } else if (field === 'reasoningEffort') {
      entry.reasoningEffort = parseReasoningEffort(name, fieldValue)
    } else {
      throw new Error(`Invalid ${MODEL_FILE}: unknown field "${field}" for role "${name}"`)
    }
  }
  return entry
}

const parseOverrides = (contents: string): Overrides => {
  let value: unknown
  try {
    value = JSON.parse(contents)
  } catch {
    throw new Error(`Invalid ${MODEL_FILE}: malformed JSON`)
  }

  if (!isRecord(value)) {
    throw new Error(`Invalid ${MODEL_FILE}: expected a JSON object`)
  }

  const overrides: Overrides = {}
  for (const [name, roleValue] of Object.entries(value)) {
    if (!isRole(name)) {
      throw new Error(`Invalid ${MODEL_FILE}: unknown role "${name}"`)
    }
    overrides[name] = parseRole(name, roleValue)
  }
  return overrides
}

const loadOverrides = async (filePath: string): Promise<Overrides> => {
  let contents: string
  try {
    contents = await readFile(filePath, 'utf8')
  } catch (error) {
    if (!isMissingFile(error)) {
      throw new Error(`Unable to read ${MODEL_FILE}: ${errorMessage(error)}`)
    }

    try {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, DEFAULT_FILE, { encoding: 'utf8', flag: 'wx' })
    } catch (createError) {
      throw new Error(`Unable to create ${MODEL_FILE}: ${errorMessage(createError)}`)
    }
    return { ...STARTER_DEFAULTS }
  }

  return parseOverrides(contents)
}

export default (async ({ directory, worktree }) => {
  const root = worktree && worktree !== '/' ? worktree : directory
  const overrides = await loadOverrides(join(root, MODEL_FILE))

  return {
    config: async (config) => {
      const agents = { ...(config.agent ?? {}) }
      for (const role of ROLES) {
        const override = overrides[role]
        if (override === undefined) continue
        const entry = { ...(agents[role] ?? {}) }
        if (override.model !== undefined) {
          entry.model = override.model
        }
        if (override.reasoningEffort !== undefined) {
          // `variant` is what opencode surfaces in the model picker and records
          // on the session; `options.reasoningEffort` is the request-level
          // fallback when no variant is resolved. Keep both aligned.
          entry.variant = override.reasoningEffort
          const options = (entry.options ?? {}) as Record<string, unknown>
          entry.options = {
            ...options,
            reasoningEffort: override.reasoningEffort,
          }
        }
        agents[role] = entry
      }
      config.agent = agents
    },
  }
}) satisfies Plugin
