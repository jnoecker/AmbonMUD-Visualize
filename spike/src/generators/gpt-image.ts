import OpenAI from "openai";
import type { ImageGenerator, GenerateOptions } from "./types";

const SIZE_MAP: Record<string, string> = {
  "16:9": "1536x1024",
  "1:1": "1024x1024",
};

export class GptImageGenerator implements ImageGenerator {
  name = "gpt-image-1";
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI();
  }

  async generate(prompt: string, options: GenerateOptions): Promise<Buffer> {
    const size = SIZE_MAP[options.aspectRatio] as "1536x1024" | "1024x1024";

    // Use transparent background for mobs and items (sprites/icons)
    const background = options.entityType === "room" ? "opaque" : "transparent";

    const response = await this.client.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
      quality: "high",
      background,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1 returned no image data");

    return Buffer.from(b64, "base64");
  }
}
