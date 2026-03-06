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

// Model-specific configurations: resolution and duration constraints.
// Defaults (1080p) apply to LTX and most models.
interface ModelSpec {
  dims: Record<VideoAssetType, { width: number; height: number }>;
  duration: number;
}

const DEFAULT_MODEL_SPEC: ModelSpec = {
  dims: {
    zone_intro: { width: 1920, height: 1080 },
    room_cinematic: { width: 1920, height: 1080 },
    boss_reveal: { width: 1080, height: 1920 },
    item_reveal: { width: 1080, height: 1920 },
  },
  duration: 10,
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
  // Seedance 1.5 Pro: 720p, 5s per-video
  "bytedance:seedance@1.5-pro": { dims: DIMS_720P, duration: 5 },
  // PixVerse v5.6: 720p, 5s per-video
  "pixverse:1@7": { dims: DIMS_720P, duration: 5 },
  // Vidu Q2 Turbo: 720p, 8s per-video
  "vidu:3@2": { dims: DIMS_720P, duration: 8 },
  // Vidu Q3 Turbo: 720p, 10s per-second
  "vidu:4@2": { dims: DIMS_720P, duration: 10 },
  // MiniMax Hailuo 2.3: 768p, 10s per-video
  "minimax:4@1": { dims: DIMS_768P, duration: 10 },
};

function getModelSpec(model: string): ModelSpec {
  const override = MODEL_SPECS[model];
  if (!override) return DEFAULT_MODEL_SPEC;
  return {
    dims: override.dims ?? DEFAULT_MODEL_SPEC.dims,
    duration: override.duration ?? DEFAULT_MODEL_SPEC.duration,
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

  const payload: Record<string, unknown> = {
    model,
    positivePrompt: config.prompt,
    duration: spec.duration,
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
