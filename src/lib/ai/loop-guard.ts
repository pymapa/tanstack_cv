import { type AgentLoopStrategy, combineStrategies, type ModelMessage, maxIterations } from '@tanstack/ai'

/** Tool calls allowed between two user messages, counted across runs. */
const MAX_TOOL_CALLS_PER_TURN = 20

type Options = Readonly<{
  /**
   * Tools whose result changes between calls with the same arguments, such as reading a form
   * the user is editing. They are left out of the repeated-call check.
   */
  repeatable?: ReadonlyArray<string>
}>

/**
 * Agent loop strategy that stops the agent before it can loop.
 *
 * The run stops after 8 model turns, after 12 tool calls, or once the same
 * tool has been called with the same arguments twice since the latest user
 * message. The last check catches a model stuck retrying the same lookup long
 * before the other caps.
 *
 * Browser-side tools end the server run on every call, and the next run starts
 * with its counters at 0. So the tool calls since the latest user message are
 * also counted from the messages, which cover every run of the turn.
 */
export function loopGuard({ repeatable = [] }: Options = {}): AgentLoopStrategy {
  const skip = new Set(repeatable)
  return combineStrategies([
    maxIterations(8),
    ({ toolCallCount }) => toolCallCount < 12,
    ({ messages }) => toolCallsInCurrentTurn(messages).length < MAX_TOOL_CALLS_PER_TURN,
    ({ messages }) => maxRepeats(toolCallsInCurrentTurn(messages).filter(({ name }) => !skip.has(name))) < 2,
  ])
}

/** The tool calls since the latest user message. */
function toolCallsInCurrentTurn(messages: Array<ModelMessage>) {
  let lastUser = messages.length - 1
  while (lastUser >= 0 && messages[lastUser]?.role !== 'user') lastUser--
  return messages.slice(lastUser + 1).flatMap((message) => (message.toolCalls ?? []).map(({ function: fn }) => fn))
}

/** The highest count of identical calls (same tool, same arguments). */
function maxRepeats(calls: ReadonlyArray<{ name: string; arguments: string }>): number {
  const counts = new Map<string, number>()
  let max = 0
  for (const { name, arguments: args } of calls) {
    const key = `${name}:${args}`
    const count = (counts.get(key) ?? 0) + 1
    counts.set(key, count)
    max = Math.max(max, count)
  }
  return max
}
