import assert from 'node:assert/strict'
import test from 'node:test'
import { formatReport } from './ci-review.ts'

const events = (parts: { id: string; text: string }[]) =>
  parts
    .map(({ id, text }) => JSON.stringify({ type: 'text', part: { messageID: id, text } }))
    .join('\n')
const review = [
  '## Summary',
  'All green.',
  '## Findings',
  'No blocking issues were found.',
  '## Verdict',
  'approve',
].join('\n')

test('posts a finished review with the commit header', () => {
  const body = formatReport(events([{ id: 'm1', text: review }]), 'abc123')
  assert.equal(body, `## OpenCode advisory review\n\nCommit: abc123\n\n${review}\n`)
})

test('strips leaked thinking and markup instead of posting them', () => {
  const body = formatReport(
    events([
      {
        id: 'm1',
        text: `<think>Let me finalize findings.</think>\n${review}\n<!-- Sticky Pull Request Commentopencode-review -->`,
      },
    ]),
    'abc123',
  )
  assert.doesNotMatch(body, /finalize findings|Sticky Pull Request Comment/)
  assert.match(body, /## Verdict/)
})

test('rejects leaked tool calls instead of posting them', () => {
  assert.throws(
    () =>
      formatReport(
        events([{ id: 'm1', text: `<｜DSML｜ invoke name="read">\n${review}` }]),
        'abc123',
      ),
    /leaked internal reasoning/,
  )
})

test('rejects reasoning without a verdict', () => {
  assert.throws(
    () =>
      formatReport(
        events([{ id: 'm1', text: 'Candidate findings:\n\nA. Something looks off here.' }]),
        'abc123',
      ),
    /no verdict/,
  )
})

test('rejects failed and empty runs', () => {
  assert.throws(() => formatReport(JSON.stringify({ type: 'error' }), 'abc123'), /review failed/)
  assert.throws(() => formatReport('', 'abc123'), /no final text/)
})
