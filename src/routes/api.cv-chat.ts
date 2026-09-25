import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { createFileRoute } from '@tanstack/react-router'

import { claudeText, isClaudeConfigured } from '~/lib/ai/claude'
import { loopGuard } from '~/lib/ai/loop-guard'
import { getCv, searchPeople } from '~/lib/cv-tools'

const SYSTEM_PROMPT = `You help Kipinä salespeople find the right people and CV versions for client needs.

Use searchPeople to find candidates and getCv to read a CV version before you describe it. Base every claim about a person on what their CV says, and name the CV version (file and variant) you used. If nobody matches, say so and suggest nearby skills to search for instead.

Keep answers short and easy to skim. Reply in the language the user writes in.`

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status })
}

export const Route = createFileRoute('/api/cv-chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isClaudeConfigured()) {
          return jsonError(503, 'ANTHROPIC_API_KEY is not set on the server.')
        }

        const abortController = new AbortController()
        request.signal.addEventListener('abort', () => {
          abortController.abort()
        })

        try {
          const { messages } = (await request.json()) as Pick<Parameters<typeof chat>[0], 'messages'>
          const stream = chat({
            adapter: claudeText(),
            tools: [searchPeople, getCv],
            systemPrompts: [SYSTEM_PROMPT],
            agentLoopStrategy: loopGuard(),
            messages,
            abortController,
          })
          return toServerSentEventsResponse(stream, { abortController })
        } catch {
          return jsonError(500, 'Failed to process chat request')
        }
      },
    },
  },
})
