import Anthropic from "@anthropic-ai/sdk";
import { runwareTextInference } from "./runware-llm";
import type { PromptLlmProvider } from "../types/settings";

export interface LlmCallOptions {
  provider: PromptLlmProvider;
  anthropicApiKey?: string;
  runwareApiKey?: string;
  runwareLlmModel?: string;
}

/**
 * Unified LLM call — routes to Claude or Runware textInference based on provider setting.
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
