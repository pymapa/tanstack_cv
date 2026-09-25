type Part = Readonly<{ type: string; name?: string; content?: unknown }>

const isShown = (part: Part) => part.type === 'tool-call' || (part.type === 'text' && Boolean(part.content))

export const withoutRepeatedToolCalls = <T extends Part>(parts: ReadonlyArray<T>): T[] => {
  let lastShown: T | undefined
  return parts.filter((part) => {
    const repeated = part.type === 'tool-call' && lastShown?.type === 'tool-call' && lastShown.name === part.name
    if (isShown(part)) lastShown = part
    return !repeated
  })
}

type Message = Readonly<{ role: string; parts: ReadonlyArray<Part> }>

/**
 * True when the latest answer ends at a tool call with no text after it: the run stopped
 * (a limit, an error or a lost connection) before the assistant replied.
 */
export const endedBeforeAnswer = (messages: ReadonlyArray<Message>): boolean => {
  const last = messages.at(-1)
  if (last?.role !== 'assistant') return false
  return last.parts.filter(isShown).at(-1)?.type === 'tool-call'
}
