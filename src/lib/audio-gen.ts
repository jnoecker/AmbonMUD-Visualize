import { Runware } from "@runware/sdk-js";
import type { MusicConfig } from "../types/music";

// Reuse a single Runware connection across calls
let runwareInstance: InstanceType<typeof Runware> | null = null;
let runwareKey: string | null = null;

function getRunware(apiKey: string): InstanceType<typeof Runware> {
  if (runwareInstance && runwareKey === apiKey) return runwareInstance;
  runwareInstance = new Runware({ apiKey });
  runwareKey = apiKey;
  return runwareInstance;
}

export interface GenerateAudioResult {
  bytes: Uint8Array;
  format: "mp3";
}

/**
 * Generate an ambient music track via Runware's audio inference API.
 * Uses positivePrompt + duration (the SDK's supported interface).
 */
export async function generateMusic(
  apiKey: string,
  config: MusicConfig
): Promise<GenerateAudioResult> {
  const runware = getRunware(apiKey);

  let results: any;
  try {
    results = await runware.audioInference({
      model: "elevenlabs:1@1",
      outputType: "base64Data",
      outputFormat: "MP3",
      numberResults: 1,
      positivePrompt: config.prompt,
      duration: config.duration,
      audioSettings: {
        sampleRate: 44100,
        bitrate: 128,
      },
    });
  } catch (err: any) {
    const msg =
      err?.message ??
      err?.error?.message ??
      (typeof err === "string" ? err : JSON.stringify(err));
    throw new Error(`Runware audio API error: ${msg}`);
  }

  console.log("[audio-gen] response type:", typeof results, Array.isArray(results) ? "array" : "");
  const result = Array.isArray(results) ? results[0] : results;
  if (result) {
    console.log("[audio-gen] response keys:", Object.keys(result).join(", "));
  }

  const b64: string | undefined =
    result?.audioBase64Data ??
    result?.audioDataURI?.replace(/^data:[^;]+;base64,/, "") ??
    result?.base64Data ??
    result?.dataURI?.replace(/^data:[^;]+;base64,/, "");

  if (!b64) {
    throw new Error(
      `No audio data in Runware response (keys: ${result ? Object.keys(result).join(", ") : "none"})`
    );
  }

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return { bytes, format: "mp3" };
}
