export type EntityType = "room" | "mob" | "item";

/** The full raw YAML object for an entity, preserving all fields including ones we don't explicitly type. */
export type RawYaml = Record<string, unknown>;

export interface Entity {
  id: string;
  type: EntityType;
  title: string;
  description: string;
  extraContext: string;
  /** The bare (un-normalized) key from the YAML file, e.g. "clearing" not "pbrae:clearing". */
  bareId: string;
  /** Complete raw YAML object for this entity — all fields preserved for round-trip editing. */
  rawYaml: RawYaml;
}

export interface ParsedZone {
  zoneName: string;
  entities: Entity[];
  allRoomDescriptions: string[];
  /** The entire parsed YAML document, preserving all top-level sections (shops, gatheringNodes, etc.). */
  rawZone: RawYaml;
}
