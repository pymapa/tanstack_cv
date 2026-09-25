import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from '@tanstack/ai'

import { claudeText, isClaudeConfigured } from '~/lib/ai/claude'
import { loopGuard } from '~/lib/ai/loop-guard'
import { checkAttachments } from '~/lib/ai/work-spec'

type ChatOptions = Parameters<typeof chat>[0]
type ChatMessages = ChatOptions['messages']

/** What makes one chat agent different from another: its instructions and its tools. */
export type ChatAgent = Readonly<{
  systemPrompt: string
  tools: ChatOptions['tools']
  /** Tools the agent may call again with the same arguments (see `loopGuard`). */
  repeatableTools?: ReadonlyArray<string>
}>

type RunParams = Readonly<Pick<ChatOptions, 'threadId' | 'runId' | 'parentRunId' | 'resume'>>

/**
 * The AG-UI run fields of a request: which run this is and, when a browser-side tool finished,
 * the `resume` that carries its result back to the paused run. Tools are left out on purpose:
 * they always come from the server's agent. Returns null when the body is not an agent run.
 */
export async function runParamsFrom(body: unknown): Promise<RunParams | null> {
  try {
    const { threadId, runId, parentRunId, resume } = await chatParamsFromRequestBody(body)
    return {
      threadId,
      runId,
      ...(parentRunId === undefined ? {} : { parentRunId }),
      ...(resume === undefined ? {} : { resume }),
    }
  } catch {
    return null
  }
}

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status })
}

async function readBody(request: Request): Promise<{ messages?: unknown } | null> {
  try {
    return (await request.json()) as { messages?: unknown }
  } catch {
    return null
  }
}

/**
 * Handles a chat POST for one agent: checks the body and attachments, then streams the
 * agent's run as server-sent events. The tools always come from `agent`, never from the client.
 */
export async function handleChatRequest(request: Request, agent: ChatAgent): Promise<Response> {
  const body = await readBody(request)
  if (body === null) return jsonError(400, 'The request body must be JSON.')
  const attachments = checkAttachments(body.messages)
  if (!attachments.ok) return jsonError(400, attachments.error)

  const run = await runParamsFrom(body)
  if (run === null) return jsonError(400, 'The request is not a chat run.')

  if (!isClaudeConfigured()) {
    return jsonError(503, 'ANTHROPIC_API_KEY is not set on the server.')
  }

  const abortController = new AbortController()
  request.signal.addEventListener('abort', () => {
    abortController.abort()
  })

  try {
    const stream = chat({
      adapter: claudeText(),
      tools: agent.tools,
      systemPrompts: [agent.systemPrompt],
      agentLoopStrategy: loopGuard({ repeatable: agent.repeatableTools ?? [] }),
      messages: body.messages as ChatMessages,
      ...run,
      abortController,
    })
    return toServerSentEventsResponse(stream, { abortController })
  } catch {
    return jsonError(500, 'Failed to process chat request')
  }
}
