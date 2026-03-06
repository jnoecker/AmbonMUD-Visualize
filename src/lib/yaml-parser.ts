import YAML from "yaml";
import type { Entity, EntityType, ParsedZone } from "../types/entities";

interface RoomFile {
  title: string;
  description: string;
  exits?: Record<string, string | { target: string }>;
  mobs?: string[];
  items?: string[];
}

interface MobFile {
  name: string;
  room?: string;
  tier?: string;
  level?: number;
  behavior?: {
    template?: string;
    params?: Record<string, unknown>;
  };
  aggroMessages?: string[];
}

interface ItemFile {
  displayName?: string;
  description?: string;
  keyword?: string[];
  slot?: string;
  damage?: number;
  armor?: number;
  consumable?: boolean;
  onUse?: Record<string, unknown>;
  room?: string;
  basePrice?: number;
}

interface WorldFile {
  zone: string;
  startRoom?: string;
  rooms?: Record<string, RoomFile>;
  mobs?: Record<string, MobFile>;
  items?: Record<string, ItemFile>;
}

function normalizeId(zone: string, id: string): string {
  return id.includes(":") ? id : `${zone}:${id}`;
}

export function parseZone(yamlContent: string): ParsedZone {
  const world = YAML.parse(yamlContent) as WorldFile;
  const rawZone = world as unknown as Record<string, unknown>;
  const zoneName = world.zone;
  const entities: Entity[] = [];
  const allRoomDescriptions: string[] = [];

  // Parse rooms
  if (world.rooms) {
    for (const [id, room] of Object.entries(world.rooms)) {
      const fullId = normalizeId(zoneName, id);
      allRoomDescriptions.push(`${room.title}: ${room.description}`);

      const exitDirs = room.exits
        ? Object.keys(room.exits).join(", ")
        : "none";

      const inhabitants: string[] = [];
      if (room.mobs) {
        for (const mobRef of room.mobs) {
          const mobId = normalizeId(zoneName, mobRef);
          const mob = world.mobs?.[mobRef] || world.mobs?.[mobId];
          if (mob) inhabitants.push(mob.name);
        }
      }

      const extra = [
        `Exits: ${exitDirs}`,
        inhabitants.length > 0
          ? `Inhabitants: ${inhabitants.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      entities.push({
        id: fullId,
        bareId: id,
        type: "room",
        title: room.title,
        description: room.description,
        extraContext: extra,
        rawYaml: room as unknown as Record<string, unknown>,
      });
    }
  }

  // Parse mobs
  if (world.mobs) {
    for (const [id, mob] of Object.entries(world.mobs)) {
      const fullId = normalizeId(zoneName, id);

      const roomTitle =
        mob.room && world.rooms?.[mob.room]
          ? world.rooms[mob.room].title
          : mob.room || "unknown";

      const extra = [
        `Tier: ${mob.tier || "standard"}`,
        mob.level ? `Level: ${mob.level}` : null,
        mob.behavior?.template
          ? `Behavior: ${mob.behavior.template}`
          : null,
        `Found in: ${roomTitle}`,
        mob.aggroMessages?.length
          ? `Aggro: "${mob.aggroMessages[0]}"`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      entities.push({
        id: fullId,
        bareId: id,
        type: "mob",
        title: mob.name,
        description: mob.name,
        extraContext: extra,
        rawYaml: mob as unknown as Record<string, unknown>,
      });
    }
  }

  // Parse items
  if (world.items) {
    for (const [id, item] of Object.entries(world.items)) {
      const fullId = normalizeId(zoneName, id);

      const desc = item.description || item.displayName || id;
      const roomTitle =
        item.room && world.rooms?.[item.room]
          ? world.rooms[item.room].title
          : item.room || "loot/shop";

      const extra = [
        item.slot ? `Slot: ${item.slot}` : null,
        item.damage ? `Damage: ${item.damage}` : null,
        item.armor ? `Armor: ${item.armor}` : null,
        item.consumable ? "Consumable" : null,
        item.basePrice ? `Price: ${item.basePrice}g` : null,
        `Location: ${roomTitle}`,
      ]
        .filter(Boolean)
        .join("\n");

      entities.push({
        id: fullId,
        bareId: id,
        type: "item",
        title: item.displayName || id,
        description: desc,
        extraContext: extra,
        rawYaml: item as unknown as Record<string, unknown>,
      });
    }
  }

  return { zoneName, entities, allRoomDescriptions, rawZone };
}

export function getEntitiesByType(
  entities: Entity[],
  type: EntityType
): Entity[] {
  return entities.filter((e) => e.type === type);
}
