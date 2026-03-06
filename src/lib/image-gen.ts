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

// Generation sizes — generate at higher resolution for quality, then downscale
const GEN_SIZE_MAP: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1024, height: 576 },
  "1:1": { width: 1024, height: 1024 },
};

// Final output sizes per entity type
const OUTPUT_SIZE_MAP: Record<EntityType, { width: number; height: number }> = {
  room: { width: 1024, height: 576 },
  mob: { width: 512, height: 512 },
  item: { width: 256, height: 256 },
};

// Rooms use JPEG (no transparency needed, ~20x smaller than PNG)
const ROOM_JPEG_QUALITY = 0.85;

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

export interface GenerateImageResult {
  bytes: Uint8Array;
  bgRemovalFailed: boolean;
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  options: GenerateOptions,
  model = "runware:101@1"
): Promise<GenerateImageResult> {
  const runware = getRunware(apiKey);

  const { width, height } = GEN_SIZE_MAP[options.aspectRatio];

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
  if (image) {
    console.log("[image-gen] response keys:", Object.keys(image).join(", "));
  } else {
    console.error("[image-gen] empty response array:", images);
  }
  const b64: string | undefined = image?.imageBase64Data;
  if (!b64) {
    throw new Error(`No image data in Runware response (keys: ${image ? Object.keys(image).join(", ") : "none"})`);
  }

  // Convert base64 to Uint8Array
  let bytes = base64ToBytes(b64);

  // Post-process: remove background for mobs/items if requested
  let bgRemovalFailed = false;
  if (options.removeBackground && options.entityType !== "room") {
    try {
      bytes = await _removeBackground(runware, bytes);
    } catch (err) {
      console.warn("[image-gen] background removal failed, saving image without it:", err);
      bgRemovalFailed = true;
    }
  }

  // Downscale to target output size and compress (JPEG for rooms, PNG for others)
  bytes = await recompressForEntityType(bytes, options.entityType);

  return { bytes, bgRemovalFailed };
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
  imageBytes: Uint8Array,
  entityType?: EntityType
): Promise<Uint8Array> {
  // Reuse the shared Runware connection — creating fresh connections per request
  // triggers server-side rate limiting on new WebSocket handshakes. Serial
  // processing (enforced by BatchRemoveBgDialog) keeps the shared connection
  // healthy since only one request is in flight at a time.
  const runware = getRunware(apiKey);
  const t0 = performance.now();
  console.log(`[BG removal] starting — payload ${(imageBytes.length / 1024).toFixed(0)}KB`);
  try {
    let result = await _removeBackground(runware, imageBytes);
    // Re-encode at target size if entity type provided
    if (entityType) {
      result = await recompressForEntityType(result, entityType);
    }
    console.log(`[BG removal] done in ${((performance.now() - t0) / 1000).toFixed(1)}s — output ${(result.length / 1024).toFixed(0)}KB`);
    return result;
  } catch (err) {
    console.error(`[BG removal] failed after ${((performance.now() - t0) / 1000).toFixed(1)}s:`, err);
    throw err;
  }
}

/**
 * Check if a PNG image already has transparent pixels by sampling the edges.
 * Decodes onto an offscreen canvas and checks corner regions + edge samples.
 */
export function imageHasTransparency(imageBytes: Uint8Array): Promise<boolean> {
  return new Promise((resolve) => {
    const blob = new Blob([imageBytes], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const w = img.width;
      const h = img.height;

      // Sample corner 8×8 regions and edge midpoints — if any pixel has
      // alpha < 250, the image already has transparency (BG removed).
      const regions: Array<[number, number, number, number]> = [
        [0, 0, 8, 8],               // top-left
        [w - 8, 0, 8, 8],           // top-right
        [0, h - 8, 8, 8],           // bottom-left
        [w - 8, h - 8, 8, 8],       // bottom-right
        [Math.floor(w / 2) - 4, 0, 8, 8],         // top-center
        [Math.floor(w / 2) - 4, h - 8, 8, 8],     // bottom-center
        [0, Math.floor(h / 2) - 4, 8, 8],         // left-center
        [w - 8, Math.floor(h / 2) - 4, 8, 8],     // right-center
      ];

      for (const [x, y, rw, rh] of regions) {
        const data = ctx.getImageData(x, y, rw, rh).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 250) {
            resolve(true);
            return;
          }
        }
      }
      resolve(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false); // can't decode → assume opaque
    };
    img.src = url;
  });
}

interface RecompressOptions {
  targetWidth: number;
  targetHeight: number;
  format?: "image/png" | "image/jpeg";
  quality?: number;
}

/**
 * Resize/recompress an image using canvas.
 * Skips if already at or below target size and format is PNG.
 */
function recompressImage(
  imageBytes: Uint8Array,
  opts: RecompressOptions
): Promise<Uint8Array> {
  const { targetWidth, targetHeight, format = "image/png", quality } = opts;
  return new Promise((resolve, reject) => {
    const blob = new Blob([imageBytes], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);

      // Skip if already at or below target size and staying PNG
      if (
        format === "image/png" &&
        img.width <= targetWidth &&
        img.height <= targetHeight
      ) {
        resolve(imageBytes);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.min(img.width, targetWidth);
      canvas.height = Math.min(img.height, targetHeight);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (b) => {
          if (!b) {
            reject(new Error("Canvas toBlob failed"));
            return;
          }
          b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
        },
        format,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(imageBytes);
    };
    img.src = url;
  });
}

/**
 * Recompress an image to the appropriate format/size for its entity type.
 * Rooms → JPEG at quality 85, mobs → 512px PNG, items → 256px PNG.
 */
export function recompressForEntityType(
  imageBytes: Uint8Array,
  entityType: EntityType
): Promise<Uint8Array> {
  const outputSize = OUTPUT_SIZE_MAP[entityType];
  if (entityType === "room") {
    return recompressImage(imageBytes, {
      targetWidth: outputSize.width,
      targetHeight: outputSize.height,
      format: "image/jpeg",
      quality: ROOM_JPEG_QUALITY,
    });
  }
  return recompressImage(imageBytes, {
    targetWidth: outputSize.width,
    targetHeight: outputSize.height,
  });
}

/**
 * Flip an image horizontally (mirror). Preserves format based on filename extension.
 */
export function flipImageHorizontally(
  imageBytes: Uint8Array,
  filename: string
): Promise<Uint8Array> {
  const isJpeg = filename.endsWith(".jpg") || filename.endsWith(".jpeg");
  const format = isJpeg ? "image/jpeg" : "image/png";
  const quality = isJpeg ? ROOM_JPEG_QUALITY : undefined;

  return new Promise((resolve, reject) => {
    const blob = new Blob([imageBytes], { type: format });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (b) => {
          if (!b) { reject(new Error("Canvas toBlob failed")); return; }
          b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
        },
        format,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for flip"));
    };
    img.src = url;
  });
}

async function _removeBackground(
  runware: InstanceType<typeof Runware>,
  imageBytes: Uint8Array
): Promise<Uint8Array> {
  const inputBase64 = bytesToBase64(imageBytes);
  const dataUri = `data:image/png;base64,${inputBase64}`;

  const t0 = performance.now();
  console.log(`[BG removal] sending request — base64 ${(inputBase64.length / 1024).toFixed(0)}KB`);

  const result = await runware.removeImageBackground({
    inputImage: dataUri,
    model: "runware:110@1",
    outputType: "base64Data",
    outputFormat: "PNG",
  });

  console.log(`[BG removal] SDK returned in ${((performance.now() - t0) / 1000).toFixed(1)}s — keys: ${Object.keys(result ?? {}).join(", ")}`);

  const resultAny = result as any;
  const outputB64: string | undefined =
    resultAny?.imageBase64Data ?? resultAny?.base64Data;
  if (!outputB64) {
    console.error(`[BG removal] unexpected response shape:`, JSON.stringify(result).substring(0, 500));
    throw new Error("No image data in background removal response");
  }

  return base64ToBytes(outputB64);
}
