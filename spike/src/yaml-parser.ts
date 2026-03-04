import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import type { Entity, EntityType } from "./generators/types";

interface RoomFile {
  title: string;
  description: string;
  exits?: Record<string, string>;
}

interface MobFile {
  name: string;
  room: string;
  tier?: string;
  level?: number;
  behavior?: {
    template: string;
    params?: {
      aggroMessage?: string;
      fleeMessage?: string;
    };
  };
}

interface ItemFile {
  displayName: string;
  description?: string;
  keyword?: string;
  slot?: string;
  damage?: number;
  armor?: number;
  consumable?: boolean;
  onUse?: {
    healHp?: number;
    grantXp?: number;
  };
  room?: string;
  basePrice?: number;
}

interface WorldFile {
  zone: string;
  rooms: Record<string, RoomFile>;
  mobs?: Record<string, MobFile>;
  items?: Record<string, ItemFile>;
}

export interface ParsedZone {
  zoneName: string;
  entities: Entity[];
  allRoomDescriptions: string[];
}

export function parseZone(yamlPath: string, entityIds: string[]): ParsedZone {
  const raw = readFileSync(yamlPath, "utf-8");
  const world: WorldFile = parseYaml(raw);
  const zoneName = world.zone;
  const rooms = world.rooms ?? {};
  const mobs = world.mobs ?? {};
  const items = world.items ?? {};

  const allRoomDescriptions = Object.values(rooms).map(
    (r) => `${r.title}: ${r.description}`
  );

  const entities: Entity[] = [];

  for (const id of entityIds) {
    if (rooms[id]) {
      const room = rooms[id];
      const exitDirs = room.exits
        ? Object.keys(room.exits).join(", ")
        : "none";
      const mobsInRoom = Object.entries(mobs)
        .filter(([, m]) => m.room === id)
        .map(([, m]) => m.name);
      const extraParts = [`Exits: ${exitDirs}`];
      if (mobsInRoom.length > 0) {
        extraParts.push(`Inhabitants: ${mobsInRoom.join(", ")}`);
      }
      entities.push({
        id,
        type: "room",
        title: room.title,
        description: room.description,
        extraContext: extraParts.join(". "),
      });
    } else if (mobs[id]) {
      const mob = mobs[id];
      const tier = mob.tier ?? "standard";
      const level = mob.level ?? 1;
      const behavior = mob.behavior?.template ?? "none";
      const roomDesc = rooms[mob.room]
        ? `Found in: ${rooms[mob.room].title} — ${rooms[mob.room].description}`
        : "";
      const extraParts = [
        `Tier: ${tier}, Level: ${level}, Behavior: ${behavior}`,
      ];
      if (mob.behavior?.params?.aggroMessage) {
        extraParts.push(`Aggro: "${mob.behavior.params.aggroMessage}"`);
      }
      if (roomDesc) {
        extraParts.push(roomDesc);
      }
      entities.push({
        id,
        type: "mob",
        title: mob.name,
        description: mob.name,
        extraContext: extraParts.join(". "),
      });
    } else if (items[id]) {
      const item = items[id];
      const extraParts: string[] = [];
      if (item.slot) extraParts.push(`Equipment slot: ${item.slot}`);
      if (item.damage) extraParts.push(`Damage: ${item.damage}`);
      if (item.armor) extraParts.push(`Armor: ${item.armor}`);
      if (item.consumable) extraParts.push("Consumable");
      if (item.onUse?.healHp) extraParts.push(`Heals ${item.onUse.healHp} HP`);
      if (item.basePrice) extraParts.push(`Value: ${item.basePrice} gold`);
      if (item.room && rooms[item.room]) {
        extraParts.push(`Found in: ${rooms[item.room].title}`);
      }
      entities.push({
        id,
        type: "item",
        title: item.displayName,
        description: item.description ?? item.displayName,
        extraContext: extraParts.join(". "),
      });
    } else {
      console.warn(`  [WARN] Entity "${id}" not found in zone "${zoneName}"`);
    }
  }

  return { zoneName, entities, allRoomDescriptions };
}
