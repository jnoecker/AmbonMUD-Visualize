export interface MusicSection {
  sectionName: string;
  positiveLocalStyles: string[];
  negativeLocalStyles: string[];
  duration: number;
  lines: string[];
}

export interface MusicConfig {
  positiveGlobalStyles: string[];
  negativeGlobalStyles: string[];
  sections: MusicSection[];
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
