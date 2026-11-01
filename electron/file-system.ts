import { open } from 'node:fs/promises'
import path from 'node:path'

export function containsPath(parent: string, child: string) {
  const relative = path.relative(parent, child)
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}

export async function syncDirectory(directory: string) {
  if (process.platform === 'win32') return
  try {
    const handle = await open(directory, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EOPNOTSUPP'].includes((error as NodeJS.ErrnoException).code ?? ''))
      throw error
  }
}

export async function writeFileData(file: string, data: Buffer | string, exclusive = true) {
  const handle = await open(file, exclusive ? 'wx' : 'w', 0o600)
  try {
    await handle.writeFile(data)
    await handle.sync()
  } finally {
    await handle.close()
  }
}
