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

export interface MusicAssetEntry {
  id: string;
  title: string;
  status: MusicStatus;
  currentConfig: MusicConfig | null;
  variants: MusicVariant[];
  approvedVariantIndex: number | null;
}
