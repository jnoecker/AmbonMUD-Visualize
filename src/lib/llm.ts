import Anthropic from "@anthropic-ai/sdk";
import { runwareTextInference } from "./runware-llm";
import type { PromptLlmProvider } from "../types/settings";

export interface LlmCallOptions {
  provider: PromptLlmProvider;
  anthropicApiKey?: string;
  runwareApiKey?: string;
  runwareLlmModel?: string;
  openRouterApiKey?: string;
  openRouterModel?: string;
}

/**
 * Unified LLM call — routes to Claude, Runware, or OpenRouter based on provider setting.
 */
export async function llmGenerate(
  opts: LlmCallOptions,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 500
): Promise<string> {
  if (opts.provider === "runware") {
    if (!opts.runwareApiKey) throw new Error("Runware API key not set");
    if (!opts.runwareLlmModel) throw new Error("Runware LLM model not set. Enter a model ID in Settings.");
    return runwareTextInference(
      opts.runwareApiKey,
      opts.runwareLlmModel,
      systemPrompt,
      userMessage,
      maxTokens
    );
  }

  if (opts.provider === "openrouter") {
    if (!opts.openRouterApiKey) throw new Error("OpenRouter API key not set");
    if (!opts.openRouterModel) throw new Error("OpenRouter model not set. Pick a model in Settings.");
    return openRouterGenerate(
      opts.openRouterApiKey,
      opts.openRouterModel,
      systemPrompt,
      userMessage,
      maxTokens
    );
  }

  // Default: Claude
  if (!opts.anthropicApiKey) throw new Error("Anthropic API key not set");
  const client = new Anthropic({
    apiKey: opts.anthropicApiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }
  throw new Error("Unexpected response format from Claude");
}

/**
 * Call OpenRouter's OpenAI-compatible chat completions API.
 */
async function openRouterGenerate(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text) {
    throw new Error(`No text in OpenRouter response: ${JSON.stringify(data)}`);
  }
  return text;
}
