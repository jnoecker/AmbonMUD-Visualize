import type { EntityType, RawYaml } from "./entities";
import type { SpriteConfig, SpritePromptTemplate } from "./sprites";
import type { AbilityConfig } from "./abilities";
import type { MusicAssetEntry } from "./music";
import type { VideoAssetEntry } from "./video";

/** Partial edits for a single entity — only fields the user has changed. */
export type EntityEdits = RawYaml;

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

export type DefaultImageEntityType = "room" | "mob" | "item";

export interface DefaultImageMap {
  room: DefaultImageEntry;
  mob: DefaultImageEntry;
  item: DefaultImageEntry;
}

export interface AssetEntry {
  entityId: string;
  entityType: EntityType;
  title: string;
  status: EntityStatus;
  currentPrompt: string | null;
  variants: ImageVariant[];
  approvedVariantIndex: number | null;
  /** Present only on user-created custom assets (not from zone YAML). */
  customDescription?: string;
}

export interface ZoneData {
  zoneName: string;
  sourceYamlPath: string;
  vibe: string | null;
  defaultImages: DefaultImageMap | null;
  assets: Record<string, AssetEntry>;
  /** User edits to entity fields, keyed by entity ID. Merged onto rawYaml at export. */
  entityEdits?: Record<string, EntityEdits>;
  spriteConfig?: SpriteConfig | null;
  spriteTemplate?: SpritePromptTemplate | null;
  abilityConfig?: AbilityConfig | null;
  musicAssets?: MusicAssetEntry[];
  videoAssets?: VideoAssetEntry[];
}

export interface ProjectFile {
  version: 1;
  name: string;
  createdAt: string;
  zones: Record<string, ZoneData>;
}
