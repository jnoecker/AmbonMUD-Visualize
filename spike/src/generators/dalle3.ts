import OpenAI from "openai";
import type { ImageGenerator, GenerateOptions } from "./types";

const SIZE_MAP: Record<string, string> = {
  "16:9": "1792x1024",
  "1:1": "1024x1024",
};

export class DallE3Generator implements ImageGenerator {
  name = "dalle3";
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI();
  }

  async generate(prompt: string, options: GenerateOptions): Promise<Buffer> {
    const size = SIZE_MAP[options.aspectRatio] as
      | "1792x1024"
      | "1024x1024";

    const response = await this.client.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "hd",
      response_format: "b64_json",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("DALL-E 3 returned no image data");

    return Buffer.from(b64, "base64");
  }
}
