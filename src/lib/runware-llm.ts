import { Runware } from "@runware/sdk-js";

// Reuse a single Runware connection
let runwareInstance: InstanceType<typeof Runware> | null = null;
let runwareKey: string | null = null;

function getRunware(apiKey: string): InstanceType<typeof Runware> {
  if (runwareInstance && runwareKey === apiKey) return runwareInstance;
  runwareInstance = new Runware({ apiKey });
  runwareKey = apiKey;
  return runwareInstance;
}

/**
 * Call Runware's textInference API with a system prompt and user message.
 * Drop-in replacement for Claude API calls in prompt generation.
 */
export async function runwareTextInference(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 500
): Promise<string> {
  const runware = getRunware(apiKey);

  let result: any;
  try {
    result = await (runware as any).textInference({
      model,
      systemPrompt,
      messages: [{ role: "user" as const, content: userMessage }],
      maxTokens,
      temperature: 0.7,
    });
  } catch (err: any) {
    const msg =
      err?.message ??
      err?.error?.message ??
      (typeof err === "string" ? err : JSON.stringify(err));
    throw new Error(`Runware LLM error: ${msg}`);
  }

  // Response may be array or single object
  const item = Array.isArray(result) ? result[0] : result;
  const text = item?.text;
  if (!text) {
    throw new Error(
      `No text in Runware LLM response (keys: ${item ? Object.keys(item).join(", ") : "none"})`
    );
  }

  return text;
}

/**
 * Run Runware's Prompt Enhancer on an image generation prompt.
 * This is free and uses Llama 3.1 8B under the hood.
 */
export async function runwareEnhancePrompt(
  apiKey: string,
  prompt: string,
  maxLength = 500
): Promise<string> {
  const runware = getRunware(apiKey);

  let results: any;
  try {
    results = await runware.enhancePrompt({
      prompt,
      promptMaxLength: maxLength,
      promptVersions: 1,
    });
  } catch (err: any) {
    console.warn("[prompt-enhance] failed, using original prompt:", err);
    return prompt; // Graceful fallback
  }

  const enhanced = Array.isArray(results) ? results[0] : results;
  return enhanced?.text || prompt;
}
