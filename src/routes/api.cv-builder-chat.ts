import { createFileRoute } from '@tanstack/react-router'

import { handleChatRequest } from '~/lib/ai/chat-request'
import { CV_BUILDER_SYSTEM_PROMPT } from '~/lib/ai/cv-builder-prompt'
import { CV_BUILDER_REPEATABLE_TOOLS, CV_BUILDER_TOOL_DEFS } from '~/lib/ai/cv-builder-tools'

/**
 * The CV builder agent: fills in the new-CV form from an old CV and the user's answers.
 * Its tools only have definitions here; they run in the browser on the form's draft.
 *
 * SECURITY TODO (spec M2): no sign-in yet, like /api/cv-chat; the dev server is localhost-only.
 */
export const Route = createFileRoute('/api/cv-builder-chat')({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleChatRequest(request, {
          systemPrompt: CV_BUILDER_SYSTEM_PROMPT,
          tools: [...CV_BUILDER_TOOL_DEFS],
          repeatableTools: CV_BUILDER_REPEATABLE_TOOLS,
        }),
    },
  },
})
