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

// Model-specific configurations: resolution and supported durations.
// Defaults (1080p) apply to LTX and most models.
export interface ModelSpec {
  dims: Record<VideoAssetType, { width: number; height: number }>;
  /** Supported durations in seconds (first is default). */
  durations: number[];
}

const DEFAULT_MODEL_SPEC: ModelSpec = {
  dims: {
    zone_intro: { width: 1920, height: 1080 },
    room_cinematic: { width: 1920, height: 1080 },
    boss_reveal: { width: 1080, height: 1920 },
    item_reveal: { width: 1080, height: 1920 },
  },
  durations: [6, 8, 10],
};

const DIMS_720P: ModelSpec["dims"] = {
  zone_intro: { width: 1280, height: 720 },
  room_cinematic: { width: 1280, height: 720 },
  boss_reveal: { width: 720, height: 1280 },
  item_reveal: { width: 720, height: 1280 },
};

const DIMS_768P: ModelSpec["dims"] = {
  zone_intro: { width: 1366, height: 768 },
  room_cinematic: { width: 1366, height: 768 },
  boss_reveal: { width: 768, height: 1366 },
  item_reveal: { width: 768, height: 1366 },
};

const MODEL_SPECS: Record<string, Partial<ModelSpec>> = {
  "bytedance:seedance@1.5-pro": { dims: DIMS_720P, durations: [5, 10] },
  "pixverse:1@7": { dims: DIMS_720P, durations: [5, 8] },
  "vidu:3@2": { dims: DIMS_720P, durations: [4, 8] },
  "vidu:4@1": { durations: [4, 8] },
  "vidu:4@2": { dims: DIMS_720P, durations: [4, 8] },
  "minimax:4@1": { dims: DIMS_768P, durations: [6, 10] },
  "klingai:kling-video@3-standard": { durations: [5, 10] },
  "klingai:kling-video@3-pro": { durations: [5, 10] },
};

export function getModelSpec(model: string): ModelSpec {
  const override = MODEL_SPECS[model];
  if (!override) return DEFAULT_MODEL_SPEC;
  return {
    dims: override.dims ?? DEFAULT_MODEL_SPEC.dims,
    durations: override.durations ?? DEFAULT_MODEL_SPEC.durations,
  };
}

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
  const spec = getModelSpec(model);
  const dims = spec.dims[videoType];
  // Use the duration from config (user's choice), falling back to model default
  const duration = config.duration && spec.durations.includes(config.duration)
    ? config.duration
    : spec.durations[0];

  const payload: Record<string, unknown> = {
    model,
    positivePrompt: config.prompt,
    duration,
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
