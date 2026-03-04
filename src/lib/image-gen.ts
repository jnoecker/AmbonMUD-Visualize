import OpenAI, { BadRequestError } from "openai";
import type { EntityType } from "../types/entities";

export class ContentPolicyError extends Error {
  constructor(entityDescription?: string) {
    const msg = entityDescription
      ? `Image generation was blocked by the safety filter for "${entityDescription}". Try editing the prompt to use less specific or suggestive language.`
      : "Image generation was blocked by the safety filter. Try editing the prompt to use less specific language.";
    super(msg);
    this.name = "ContentPolicyError";
  }
}

interface GenerateOptions {
  aspectRatio: "16:9" | "1:1";
  entityType: EntityType;
}

const SIZE_MAP: Record<string, "1792x1024" | "1024x1024"> = {
  "16:9": "1792x1024",
  "1:1": "1024x1024",
};

export function getAspectRatio(entityType: EntityType): "16:9" | "1:1" {
  return entityType === "room" ? "16:9" : "1:1";
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  options: GenerateOptions
): Promise<Uint8Array> {
  const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const size = SIZE_MAP[options.aspectRatio];

  let response;
  try {
    response = await client.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "standard",
      response_format: "b64_json",
    });
  } catch (err) {
    if (err instanceof BadRequestError && /content_policy/i.test(String(err.message))) {
      throw new ContentPolicyError();
    }
    throw err;
  }

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image data in DALL-E 3 response");
  }

  // Convert base64 to Uint8Array
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
