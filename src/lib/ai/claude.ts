/**
 * Claude Platform API adapter for TanStack AI.
 *
 * Server-only: reads the API key from the environment, so never import this
 * from client code. Configure it with the variables in `.env.example`.
 */
import { ANTHROPIC_MODELS, createAnthropicChat } from "@tanstack/ai-anthropic";

export type ClaudeModel = (typeof ANTHROPIC_MODELS)[number];

export const DEFAULT_CLAUDE_MODEL: ClaudeModel = "claude-haiku-4-5";

function isClaudeModel(value: string): value is ClaudeModel {
	return (ANTHROPIC_MODELS as ReadonlyArray<string>).includes(value);
}

/** The model from `CLAUDE_MODEL`, or the default when it is unset. */
export function getClaudeModel(): ClaudeModel {
	const model = process.env.CLAUDE_MODEL?.trim();
	if (!model) return DEFAULT_CLAUDE_MODEL;
	if (!isClaudeModel(model)) {
		throw new Error(
			`CLAUDE_MODEL "${model}" is not a supported model. Use one of: ${ANTHROPIC_MODELS.join(", ")}`,
		);
	}
	return model;
}

export function isClaudeConfigured(): boolean {
	return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Creates a TanStack AI text adapter for the Claude Platform API.
 * Pass it as `adapter` to `chat()` from `@tanstack/ai`.
 */
export function claudeText(model: ClaudeModel = getClaudeModel()) {
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
