// SPDX-License-Identifier: MIT

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

export function runNodeCli(script, { env, input, cwd = ROOT } = {}) {
  return spawnSync(process.execPath, [fileURLToPath(script)], {
    cwd,
    env: { ...process.env, ...env },
    input,
    encoding: 'utf8',
  })
}
