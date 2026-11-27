import assert from 'node:assert/strict'
import test from 'node:test'
import { sessionMetrics } from './entropy.ts'

const tool = (name: string, input: object, extra: object = {}) => ({
  type: 'tool',
  name,
  state: { status: 'completed', input, ...extra },
})

test('sessionMetrics counts interventions, failures, edits, and created PRs', () => {
  const edit = tool('edit', { path: 'a.ts' })
  const metrics = sessionMetrics({
    info: {
      id: 'ses_fixture',
      title: 'Fixture',
      time: { created: 1 },
      tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 4, write: 5 } },
    },
    messages: [
      { type: 'user', metadata: { displayText: 'start', comments: [] } },
      {
        type: 'assistant',
        content: [
          { type: 'text', text: 'Done?' },
          tool('question', { questions: [] }),
          tool(
            'shell',
            { command: 'gh pr create --fill' },
            {
              content: [{ type: 'text', text: 'https://github.com/o/r/pull/12' }],
              metadata: { exit: 0 },
            },
          ),
          tool('shell', { command: 'false' }, { metadata: { exit: 1 } }),
          { ...tool('read', { path: 'b.ts' }), state: { status: 'error' } },
          edit,
          edit,
          edit,
          tool('write', { path: 'b.ts' }),
          tool('write', { path: 'b.ts' }),
        ],
      },
      { type: 'user', text: 'Options: auto' },
      {
        type: 'user',
        metadata: {
          displayText: '',
          comments: [
            { type: 'quote', text: 'Proceed?', comment: 'yes' },
            { path: 'a.ts', comment: 'shorter', origin: 'review' },
          ],
        },
      },
      { type: 'user', metadata: { displayText: 'next', comments: [] } },
      { type: 'compaction' },
      { type: 'model-switched' },
    ],
  })
  assert.deepEqual(metrics, {
    id: 'ses_fixture',
    title: 'Fixture',
    created: 1,
    prompts: 1,
    replies: 1,
    diffComments: 1,
    questions: 1,
    compactions: 1,
    toolErrors: 1,
    shellFailures: 1,
    modelSwitches: 1,
    repeatedEdits: 1,
    tokens: 15,
    prs: [12],
  })
  assert.throws(() => sessionMetrics({ info: {}, messages: [] }), /unexpected export format/)
})
