import assert from 'node:assert/strict'
import test from 'node:test'
import { NessoError } from './index.ts'

test('structured errors retain issues and format paths consistently', () => {
  const issues = [
    { path: 'document.label', message: 'Required' },
    { path: '', message: 'Invalid document' },
  ]
  const error = new NessoError(issues)
  assert.ok(error instanceof Error)
  assert.equal(error.name, 'NessoError')
  assert.equal(error.issues, issues)
  assert.equal(error.message, 'document.label: Required\nInvalid document')
})
