import { Runware } from "@runware/sdk-js";
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

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1024, height: 576 },
  "1:1": { width: 1024, height: 1024 },
};

export function getAspectRatio(entityType: EntityType): "16:9" | "1:1" {
  return entityType === "room" ? "16:9" : "1:1";
}

// Reuse a single Runware connection across calls
let runwareInstance: InstanceType<typeof Runware> | null = null;
let runwareKey: string | null = null;

function getRunware(apiKey: string): InstanceType<typeof Runware> {
  if (runwareInstance && runwareKey === apiKey) return runwareInstance;
  runwareInstance = new Runware({ apiKey });
  runwareKey = apiKey;
  return runwareInstance;
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  options: GenerateOptions,
  model = "runware:101@1"
): Promise<Uint8Array> {
  const runware = getRunware(apiKey);

  const { width, height } = SIZE_MAP[options.aspectRatio];

  let images;
  try {
    images = await runware.requestImages({
      positivePrompt: prompt,
      model,
      width,
      height,
      numberResults: 1,
      outputType: "base64Data",
      outputFormat: "PNG",
    });
  } catch (err: any) {
    if (/content.?policy|nsfw|safety/i.test(String(err.message))) {
      throw new ContentPolicyError();
    }
    throw err;
  }

  const image = images?.[0] as any;
  const b64: string | undefined = image?.imageBase64Data;
  if (!b64) {
    throw new Error("No image data in Runware response");
  }

  // Convert base64 to Uint8Array
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
