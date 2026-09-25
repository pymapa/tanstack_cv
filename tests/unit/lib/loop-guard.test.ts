import type { AgentLoopState, ModelMessage } from '@tanstack/ai'
import { describe, expect, it } from 'vitest'
import { loopGuard } from '~/lib/ai/loop-guard'

const user = (content = 'Fill in my CV'): ModelMessage => ({ role: 'user', content })

const call = (name: string, args = '{}'): ModelMessage => ({
  role: 'assistant',
  content: null,
  toolCalls: [{ id: `${name}-${args}`, type: 'function', function: { name, arguments: args } }],
})

/** A fresh server run, as after each browser-side tool result: the run's own counters are 0. */
const freshRun = (messages: ModelMessage[]): AgentLoopState => ({
  iterationCount: 0,
  messages,
  finishReason: 'tool_calls',
  toolCallCount: 0,
  lastTurnToolCallCount: 0,
})

describe('loopGuard', () => {
  it('should stop when the same tool is called with the same arguments twice in a turn', () => {
    expect(loopGuard()(freshRun([user(), call('getCv', '{"file":"a"}'), call('getCv', '{"file":"a"}')]))).toBe(false)
  })

  it('should allow repeated calls to tools marked as repeatable', () => {
    const guard = loopGuard({ repeatable: ['readDraft'] })

    expect(guard(freshRun([user(), call('readDraft'), call('readDraft')]))).toBe(true)
  })

  it('should stop a turn with too many tool calls even when every run starts fresh', () => {
    const calls = Array.from({ length: 20 }, (_, i) => call('updateDraft', `{"i":${String(i)}}`))

    expect(loopGuard()(freshRun([user(), ...calls]))).toBe(false)
  })

  it('should count only the tool calls since the latest user message', () => {
    const earlier = Array.from({ length: 19 }, (_, i) => call('updateDraft', `{"i":${String(i)}}`))

    expect(loopGuard()(freshRun([user(), ...earlier, user('Now the projects'), call('updateDraft')]))).toBe(true)
  })
})
