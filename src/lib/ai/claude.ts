/**
 * Claude Platform API adapter for TanStack AI.
 *
 * Server-only: reads the API key from the environment, so never import this
 * from client code. Configure it with the variables in `.env.example`.
 */
import {
	type ANTHROPIC_MODELS,
	createAnthropicChat,
} from "@tanstack/ai-anthropic";

export type ClaudeModel = (typeof ANTHROPIC_MODELS)[number];

/** Set in code, not from the environment. Pass another model to `claudeText` to override. */
export const DEFAULT_CLAUDE_MODEL: ClaudeModel = "claude-haiku-4-5";

export function isClaudeConfigured(): boolean {
	return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Creates a TanStack AI text adapter for the Claude Platform API.
 * Pass it as `adapter` to `chat()` from `@tanstack/ai`.
 */
export function claudeText(model: ClaudeModel = DEFAULT_CLAUDE_MODEL) {
	const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
	if (!apiKey) {
		throw new Error(
			"ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
		);
	}
	return createAnthropicChat(model, apiKey, {
		baseURL: process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
	});
}
