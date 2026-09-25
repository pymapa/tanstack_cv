import { type AgentLoopStrategy, combineStrategies, type ModelMessage, maxIterations } from '@tanstack/ai'

/**
 * Agent loop strategy that stops the agent before it can loop.
 *
 * The run stops after 8 model turns, after 12 tool calls, or once the same
 * tool has been called with the same arguments twice since the latest user
 * message. The last check catches a model stuck retrying the same lookup long
 * before the other caps.
 */
export function loopGuard(): AgentLoopStrategy {
  return combineStrategies([
    maxIterations(8),
    ({ toolCallCount }) => toolCallCount < 12,
    ({ messages }) => maxRepeatsInCurrentTurn(messages) < 2,
  ])
}

/** The highest count of identical tool calls since the latest user message. */
function maxRepeatsInCurrentTurn(messages: Array<ModelMessage>): number {
  let lastUser = messages.length - 1
  while (lastUser >= 0 && messages[lastUser]?.role !== 'user') lastUser--
  const counts = new Map<string, number>()
  let max = 0
  for (const message of messages.slice(lastUser + 1)) {
    for (const { function: fn } of message.toolCalls ?? []) {
      const key = `${fn.name}:${fn.arguments}`
      const count = (counts.get(key) ?? 0) + 1
      counts.set(key, count)
      max = Math.max(max, count)
    }
  }
  return max
}
