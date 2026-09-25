/**
 * Claude Platform API adapter for TanStack AI.
 *
 * Server-only: reads the API key from the environment, so never import this
 * from client code. Configure it with the variables in `.env.example`.
 */
import { chat } from '@tanstack/ai'
import { ANTHROPIC_MODELS, createAnthropicChat } from '@tanstack/ai-anthropic'
import type { z } from 'zod'
import { err, ok, type Result } from '~/lib/result'

export type ClaudeModel = (typeof ANTHROPIC_MODELS)[number]

export const DEFAULT_CLAUDE_MODEL: ClaudeModel = 'claude-sonnet-5'

function isClaudeModel(value: string): value is ClaudeModel {
  return (ANTHROPIC_MODELS as ReadonlyArray<string>).includes(value)
}

/** The model from `CLAUDE_MODEL`, or the default when it is unset. */
export function getClaudeModel(): ClaudeModel {
  const model = process.env.CLAUDE_MODEL?.trim()
  if (!model) return DEFAULT_CLAUDE_MODEL
  if (!isClaudeModel(model)) {
    throw new Error(`CLAUDE_MODEL "${model}" is not a supported model. Use one of: ${ANTHROPIC_MODELS.join(', ')}`)
  }
  return model
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

/**
 * Creates a TanStack AI text adapter for the Claude Platform API.
 * Pass it as `adapter` to `chat()` from `@tanstack/ai`.
 */
export function claudeText(model: ClaudeModel = getClaudeModel()) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.')
  }
  return createAnthropicChat(model, apiKey, {
    baseURL: process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
  })
}

/** Longest a structured call may take before it is cancelled. */
const STRUCTURED_TIMEOUT_MS = 120_000

/**
 * One non-streaming Claude call that returns output matching `schema` (as JSON).
 * Any failure (no key, network, API error, refusal, output that doesn't parse) is `AI_UNAVAILABLE`,
 * and the error itself is never logged or returned, since it may quote CV text.
 * Callers still validate the returned value.
 */
export async function claudeStructured(
  request: Readonly<{ system: string; user: string; schema: z.ZodType; signal: AbortSignal }>,
): Promise<Result<unknown, 'AI_UNAVAILABLE'>> {
  if (request.signal.aborted) return err('AI_UNAVAILABLE')
  const abortController = new AbortController()
  const abort = () => {
    abortController.abort()
  }
  const timer = setTimeout(abort, STRUCTURED_TIMEOUT_MS)
  request.signal.addEventListener('abort', abort)
  try {
    const value: unknown = await chat({
      adapter: claudeText(),
      systemPrompts: [request.system],
      messages: [{ role: 'user', content: request.user }],
      outputSchema: request.schema,
      stream: false,
      abortController,
      // The library logs errors to the console by default, and they can quote model output.
      debug: false,
    })
    return ok(value)
  } catch {
    return err('AI_UNAVAILABLE')
  } finally {
    clearTimeout(timer)
    request.signal.removeEventListener('abort', abort)
  }
}
