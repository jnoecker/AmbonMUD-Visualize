import type { EntityType } from "./entities";

export type EntityStatus = "pending" | "generated" | "approved";

export interface ImageVariant {
  filename: string;
  generatedAt: string;
  prompt: string;
}

export interface DefaultImageEntry {
  prompt: string | null;
  filename: string | null;
  generatedAt: string | null;
}

export interface AssetEntry {
  entityId: string;
  entityType: EntityType;
  title: string;
  status: EntityStatus;
  currentPrompt: string | null;
  variants: ImageVariant[];
  approvedVariantIndex: number | null;
}

export interface ZoneData {
  zoneName: string;
  sourceYamlPath: string;
  vibe: string | null;
  defaultImages: {
    room: DefaultImageEntry;
    mob: DefaultImageEntry;
    item: DefaultImageEntry;
  } | null;
  assets: Record<string, AssetEntry>;
}

export interface ProjectFile {
  version: 1;
  name: string;
  createdAt: string;
  zones: Record<string, ZoneData>;
}
