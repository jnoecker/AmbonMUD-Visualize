export interface MusicConfig {
  prompt: string;
  duration: number;
}

export interface MusicVariant {
  filename: string;
  generatedAt: string;
  config: MusicConfig;
}

export type MusicStatus = "pending" | "generated" | "approved";
export type AudioTrackType = "music" | "ambient";

export interface MusicAssetEntry {
  id: string;
  title: string;
  trackType: AudioTrackType;
  /** If set, this track overrides at the room level instead of zone level. */
  roomId?: string | null;
  status: MusicStatus;
  currentConfig: MusicConfig | null;
  variants: MusicVariant[];
  approvedVariantIndex: number | null;
}
