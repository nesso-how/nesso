import { aiMcpTools, type AiToolResults } from '@nesso-how/ai'
import { NessoError } from '@nesso-how/errors'
import type { PluginPackageInput } from '@nesso-how/plugin/package'
import { z } from 'zod'
import type { InstalledPlugin } from '../../shared/plugins.ts'

export type AiPlugins = {
  readonly list: () => AiToolResults['plugins']['items']
  readonly propose: (
    input: PluginPackageInput,
    replacing: string | undefined,
    signal: AbortSignal,
  ) => Promise<Pick<InstalledPlugin, 'name' | 'version' | 'contentId'> | null>
}

const proposal = z.strictObject({
  package: z.strictObject({
    manifest: z.unknown(),
    files: z.array(
      z.strictObject({
        path: z.string(),
        bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
      }),
    ),
  }),
  replacing: aiMcpTools.propose_plugin.inputSchema.shape.replacing,
})

export async function executeAiPluginTool(
  plugins: AiPlugins,
  name: keyof typeof aiMcpTools,
  input: unknown,
  signal: AbortSignal,
): Promise<AiToolResults['plugins'] | AiToolResults['propose_plugin']> {
  if (name === 'plugins') {
    aiMcpTools.plugins.inputSchema.parse(input)
    return { items: plugins.list() }
  }
  const { package: received, replacing } = proposal.parse(input)
  try {
    const installed = await plugins.propose(received, replacing, signal)
    if (!installed) return { status: 'cancelled' }
    const { name, version, contentId } = installed
    return { status: 'installed', name, version, contentId }
  } catch (error) {
    if (signal.aborted) return { status: 'cancelled' }
    return {
      status: 'failed',
      issues:
        error instanceof NessoError
          ? error.issues
          : [{ path: 'plugins', message: 'Plugin proposal failed' }],
    }
  }
}
