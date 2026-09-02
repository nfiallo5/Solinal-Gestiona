/**
 * Thin wrapper around the Anthropic SDK for the `/documents/:code/ai/*`
 * routes (`src/routes/ai.ts`). The API key lives ONLY here, server-side —
 * never sent to or read from the browser.
 *
 * Model: claude-opus-5, non-streaming. A single request/response per action
 * matches the UI's existing "Pensando..." spinner pattern (AiToolbox.tsx)
 * and keeps these routes simple; revisit streaming only if draft/chat
 * latency becomes a real problem.
 */
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';

export const CLAUDE_MODEL = 'claude-sonnet-5';

let client: Anthropic | null = null;

export function isClaudeConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!client) {
    // isClaudeConfigured() must be checked by the caller (route) first, so
    // this only ever constructs once a key is confirmed present.
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface ClaudeTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Strips a ```/```json/```html fence Claude sometimes wraps output in
 * despite being told not to — defensive, not load-bearing. */
export function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/, '')
    .trim();
}

/**
 * One-shot or multi-turn call. Returns the concatenated text content.
 * Throws a plain `Error` on a non-text response or an empty reply — callers
 * (route handlers) translate that into an `HttpError`.
 */
export async function askClaude(
  system: string,
  messages: ClaudeTurn[],
  maxTokens = 3000,
): Promise<string> {
  const response = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error(`Claude respondió sin texto (stop_reason: ${response.stop_reason}).`);
  }
  return text;
}
