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
