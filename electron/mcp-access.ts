import { randomBytes } from 'node:crypto'
import { ElectronError } from './errors.ts'

export function createMcpAccess(storage: { read: () => string | null; write: (value: string) => void }) {
  const renew = () => {
    const token = randomBytes(32).toString('hex')
    storage.write(token)
    return token
  }
  return {
    get: () => {
      const token = storage.read()
      if (token === null) return renew()
      if (!/^[a-f0-9]{64}$/.test(token)) throw new ElectronError([{ path: 'mcp.access', message: 'Stored MCP access is invalid. Regenerate the token to replace it' }])
      return token
    },
    revoke: renew,
  }
}
