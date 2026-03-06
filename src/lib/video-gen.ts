import { Runware } from "@runware/sdk-js";
import type { VideoConfig } from "../types/video";
import type { VideoAssetType } from "../types/video";

// Reuse a single Runware connection across calls
let runwareInstance: InstanceType<typeof Runware> | null = null;
let runwareKey: string | null = null;

function getRunware(apiKey: string): InstanceType<typeof Runware> {
  if (runwareInstance && runwareKey === apiKey) return runwareInstance;
  runwareInstance = new Runware({ apiKey });
  runwareKey = apiKey;
  return runwareInstance;
}

export interface GenerateVideoResult {
  videoUrl: string;
  cost?: number;
}

// LTX 2.3 only supports standard broadcast resolutions (1080p, 1440p, 4K).
// All video types use 1080p landscape — cheapest option at $0.06/s.
const DIMENSIONS: Record<VideoAssetType, { width: number; height: number }> = {
  zone_intro: { width: 1920, height: 1080 },
  boss_reveal: { width: 1080, height: 1920 },
  item_reveal: { width: 1080, height: 1920 },
};

/**
 * Generate a video via Runware's videoInference API.
 * Uses image-to-video when a sourceImageUrl is provided (base64 data URI or URL).
 */
export async function generateVideo(
  apiKey: string,
  config: VideoConfig,
  videoType: VideoAssetType,
  sourceImageBase64: string | null,
  model: string = "lightricks:ltx@2.3"
): Promise<GenerateVideoResult> {
  const runware = getRunware(apiKey);
  const dims = DIMENSIONS[videoType];

  const payload: Record<string, unknown> = {
    model,
    positivePrompt: config.prompt,
    duration: 6,
    width: dims.width,
    height: dims.height,
    numberResults: 1,
    includeCost: true,
  };

  if (sourceImageBase64) {
    payload.inputs = { image: sourceImageBase64 };
  }

  let results: any;
  try {
    results = await runware.videoInference(payload as any);
  } catch (err: any) {
    const msg =
      err?.message ??
      err?.error?.message ??
      (typeof err === "string" ? err : JSON.stringify(err));
    throw new Error(`Runware video API error: ${msg}`);
  }

  const result = Array.isArray(results) ? results[0] : results;

  if (!result?.videoURL) {
    throw new Error(
      `No video URL in Runware response (keys: ${result ? Object.keys(result).join(", ") : "none"})`
    );
  }

  return {
    videoUrl: result.videoURL,
    cost: result.cost,
  };
}
