export interface VideoConfig {
  prompt: string;
  duration: number;
  sourceEntityId: string | null;
}

export interface VideoVariant {
  filename: string;
  generatedAt: string;
  config: VideoConfig;
}

export type VideoStatus = "pending" | "generated" | "approved";
export type VideoAssetType = "zone_intro" | "room_cinematic" | "boss_reveal" | "item_reveal";

export interface VideoAssetEntry {
  id: string;
  title: string;
  videoType: VideoAssetType;
  /** The entity whose approved image is used as the source frame. */
  sourceEntityId: string | null;
  status: VideoStatus;
  currentConfig: VideoConfig | null;
  variants: VideoVariant[];
  approvedVariantIndex: number | null;
}
