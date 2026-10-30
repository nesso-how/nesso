import { execFileSync } from 'node:child_process'
import { NessoError } from '@nesso-how/errors'

export function fail(path: string, message: string): never {
  throw new NessoError([{ path, message }])
}

export function run(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : String(unknownError)
    return fail(`${command} ${args.join(' ')}`, message)
  }
}

export function guardRelease(tag: string): void {
  if (run('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main')
    fail('git', 'must release from main')
  if (run('git', ['status', '--porcelain']) !== '') fail('git', 'working tree is not clean')
  if (run('git', ['tag', '--list', tag]) !== '') fail('git', `tag ${tag} already exists`)
}

export function commitTagPush(files: string[], message: string, tag: string): void {
  run('git', ['add', ...files])
  run('git', ['commit', '-m', message])
  run('git', ['tag', tag])
  run('git', ['push', '--atomic', 'origin', 'main', tag])
  console.log(tag)
}
