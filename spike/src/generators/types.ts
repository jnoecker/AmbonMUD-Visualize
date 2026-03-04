export interface ImageGenerator {
  name: string;
  generate(prompt: string, options: GenerateOptions): Promise<Buffer>;
}

export interface GenerateOptions {
  aspectRatio: "16:9" | "1:1";
  entityType: EntityType;
}

export type EntityType = "room" | "mob" | "item";

export interface Entity {
  id: string;
  type: EntityType;
  title: string;
  description: string;
  extraContext: string;
}
