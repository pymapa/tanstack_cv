import { describe, expect, it } from 'vitest'
import { runParamsFrom } from '~/lib/ai/chat-request'

const body = (extra: Record<string, unknown> = {}) => ({
  threadId: 'thread-1',
  runId: 'run-2',
  state: {},
  messages: [{ id: 'm1', role: 'user', content: 'Hello' }],
  tools: [{ name: 'injected', description: 'x', parameters: {} }],
  context: [],
  forwardedProps: {},
  ...extra,
})

describe('runParamsFrom', () => {
  it('should pass the resume of a paused run on, so a browser-side tool result reaches the model', async () => {
    const resume = [{ interruptId: 'client_tool_t1', status: 'resolved', payload: { ok: true } }]

    const params = await runParamsFrom(body({ resume, parentRunId: 'run-1' }))

    expect(params).toMatchObject({ threadId: 'thread-1', runId: 'run-2', parentRunId: 'run-1', resume })
  })

  it('should never take tools from the request', async () => {
    const params = await runParamsFrom(body())

    expect(params).not.toHaveProperty('tools')
  })

  it('should return null for a body that is not an agent run', async () => {
    expect(await runParamsFrom({ messages: 'nope' })).toBeNull()
  })
})
