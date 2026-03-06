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
 */
export async function generateMusic(
  apiKey: string,
  config: MusicConfig
): Promise<GenerateAudioResult> {
  const runware = getRunware(apiKey);

  const results = await (runware as any).audioInference({
    model: "elevenlabs:1@1",
    outputType: "base64Data",
    outputFormat: "MP3",
    numberResults: 1,
    music: {
      positiveGlobalStyles: config.positiveGlobalStyles,
      negativeGlobalStyles: config.negativeGlobalStyles,
      sections: config.sections.map((s) => ({
        sectionName: s.sectionName,
        positiveLocalStyles: s.positiveLocalStyles,
        negativeLocalStyles: s.negativeLocalStyles,
        duration: s.duration,
        lines: s.lines,
      })),
    },
  });

  const result = Array.isArray(results) ? results[0] : results;
  const b64: string | undefined =
    result?.audioBase64Data ?? result?.audioDataURI?.replace(/^data:[^;]+;base64,/, "");

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
