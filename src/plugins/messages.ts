import { parsePluginMessage, PluginError } from '@nesso-how/plugin/runtime'

export type PluginMessage = ReturnType<typeof parsePluginMessage>

export function listenPluginPort(port: MessagePort, closed: () => boolean, receive: (message: PluginMessage) => void | Promise<void>, failed: (error: PluginError) => void) {
  let sequence = 0
  let budget = { start: Date.now(), count: 0 }
  const reject = (error: unknown) => {
    if (!closed()) failed(error instanceof PluginError ? error : new PluginError('invalid-input', [{ path: 'channel', message: 'Invalid plugin message' }]))
  }
  port.onmessage = ({ data, ports }) => {
    if (closed()) return
    try {
      for (const transferred of ports) transferred.close()
      if (ports.length) throw new PluginError('invalid-input', [{ path: 'channel', message: 'Additional transferred ports are not allowed' }])
      if (Date.now() - budget.start >= 1000) budget = { start: Date.now(), count: 0 }
      if (++budget.count > 256) throw new PluginError('invalid-input', [{ path: 'channel', message: 'Request rate limit exceeded' }])
      const message = parsePluginMessage(data)
      if (message.type === 'request') {
        if (message.id <= sequence) throw new PluginError('invalid-input', [{ path: 'id', message: 'Request ID must increase' }])
        sequence = message.id
      }
      const result = receive(message)
      if (result) void result.catch(reject)
    } catch (error) { reject(error) }
  }
  port.onmessageerror = () => reject(new PluginError('invalid-input', [{ path: 'channel', message: 'Message could not be decoded' }]))
  port.start()
}
