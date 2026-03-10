import type { Entity } from "../types/entities";
import type { PortraitConfig, PortraitDimensions } from "../types/portraits";

/**
 * Regex for portrait mob IDs: portrait_race_{race} or portrait_class_{class}
 * The ID may be zone-prefixed (e.g. "character_portraits:portrait_race_archae").
 */
const PORTRAIT_ID_RE = /(?:^|:)portrait_(race|class)_([a-z]+)$/;

/**
 * Parse a portrait entity ID into its dimensions.
 * Returns null if the ID doesn't match the portrait pattern.
 */
export function parsePortraitId(entityId: string): PortraitDimensions | null {
  const m = entityId.match(PORTRAIT_ID_RE);
  if (!m) return null;
  return {
    portraitType: m[1] as "race" | "class",
    key: m[2],
  };
}

/**
 * Auto-detect whether a set of entities represents a portrait zone.
 * If >80% of mobs match the portrait ID pattern, returns the extracted config.
 */
export function detectPortraitZone(entities: Entity[]): PortraitConfig | null {
  const mobs = entities.filter((e) => e.type === "mob");
  if (mobs.length < 4) return null;

  const races: string[] = [];
  const classes: string[] = [];
  let matched = 0;

  for (const mob of mobs) {
    const dims = parsePortraitId(mob.id);
    if (dims) {
      matched++;
      if (dims.portraitType === "race") races.push(dims.key);
      else classes.push(dims.key);
    }
  }

  if (matched / mobs.length < 0.8) return null;

  return {
    races: races.sort(),
    classes: classes.sort(),
  };
}
