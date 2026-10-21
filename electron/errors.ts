import { NessoError } from '@nesso/errors'

export class ElectronError extends NessoError {
  override name = 'ElectronError'
}
