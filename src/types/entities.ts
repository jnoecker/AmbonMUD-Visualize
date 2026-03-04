export type EntityType = "room" | "mob" | "item";

export interface Entity {
  id: string;
  type: EntityType;
  title: string;
  description: string;
  extraContext: string;
}

export interface ParsedZone {
  zoneName: string;
  entities: Entity[];
  allRoomDescriptions: string[];
}
