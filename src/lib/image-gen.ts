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
  removeBackground?: boolean;
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
  let bytes = base64ToBytes(b64);

  // Post-process: remove background for mobs/items if requested
  if (options.removeBackground && options.entityType !== "room") {
    bytes = await _removeBackground(runware, bytes);
  }

  return bytes;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}

export async function removeImageBackground(
  apiKey: string,
  imageBytes: Uint8Array
): Promise<Uint8Array> {
  // Fresh connection per BG removal: avoids WebSocket degradation from large
  // base64 payloads. Short timeout (20s) + single attempt prevents the SDK from
  // silently making extra billed API calls on timeout (default is 60s × 2 retries).
  // Note: SDK retry loop uses `for(;s;)` so maxRetries=1 means 1 attempt (0 retries).
  const runware = new Runware({
    apiKey,
    globalMaxRetries: 1,
    timeoutDuration: 20000,
  });
  try {
    return await _removeBackground(runware, imageBytes);
  } finally {
    runware.disconnect();
  }
}

async function _removeBackground(
  runware: InstanceType<typeof Runware>,
  imageBytes: Uint8Array
): Promise<Uint8Array> {
  const inputBase64 = bytesToBase64(imageBytes);
  const dataUri = `data:image/png;base64,${inputBase64}`;

  const result = await runware.removeImageBackground({
    inputImage: dataUri,
    model: "runware:110@1",
    outputType: "base64Data",
    outputFormat: "PNG",
  });

  const resultAny = result as any;
  const outputB64: string | undefined =
    resultAny?.imageBase64Data ?? resultAny?.base64Data;
  if (!outputB64) {
    throw new Error("No image data in background removal response");
  }

  return base64ToBytes(outputB64);
}
