import type { ImageGenerator, GenerateOptions } from "./types";

export class SD3Generator implements ImageGenerator {
  name = "sd3";
  private apiKey: string;

  constructor() {
    const key = process.env.STABILITY_AI_API_KEY;
    if (!key) throw new Error("STABILITY_AI_API_KEY is not set");
    this.apiKey = key;
  }

  async generate(prompt: string, options: GenerateOptions): Promise<Buffer> {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("negative_prompt",
      "photorealistic, photograph, camera, lens, DSLR, stock photo, " +
      "neon colors, high contrast, harsh shadows, sharp edges, " +
      "pure black background, realistic lighting, HDR, " +
      "3D render, unreal engine, octane render"
    );
    formData.append("model", "sd3.5-large");
    formData.append("cfg_scale", "8");
    formData.append("aspect_ratio", options.aspectRatio);
    formData.append("output_format", "png");

    const response = await fetch(
      "https://api.stability.ai/v2beta/stable-image/generate/sd3",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "image/*",
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Stability AI API error ${response.status}: ${errorText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
