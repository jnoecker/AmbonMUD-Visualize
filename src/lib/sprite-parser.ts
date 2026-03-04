import type { Entity } from "../types/entities";
import type { SpriteConfig, SpriteDimensions, SpriteGroup } from "../types/sprites";

/**
 * Regex for sprite mob IDs: {race}_{class}_l{tier}
 * The ID may be zone-prefixed (e.g. "player_sprites:human_warrior_l1").
 */
const SPRITE_ID_RE = /(?:^|:)([a-z]+)_([a-z]+)_l(\d+)$/;

/**
 * Parse a sprite entity ID into its dimensions.
 * Returns null if the ID doesn't match the sprite pattern.
 */
export function parseSpriteId(entityId: string): SpriteDimensions | null {
  const m = entityId.match(SPRITE_ID_RE);
  if (!m) return null;
  return {
    race: m[1],
    playerClass: m[2],
    tier: Number(m[3]),
  };
}

/**
 * Auto-detect whether a set of entities represents a sprite zone.
 * If >80% of mobs match the sprite ID pattern, returns the extracted config.
 */
export function detectSpriteZone(entities: Entity[]): SpriteConfig | null {
  const mobs = entities.filter((e) => e.type === "mob");
  if (mobs.length < 4) return null;

  const races = new Set<string>();
  const classes = new Set<string>();
  const tiers = new Set<number>();
  let matched = 0;

  for (const mob of mobs) {
    const dims = parseSpriteId(mob.id);
    if (dims) {
      matched++;
      races.add(dims.race);
      classes.add(dims.playerClass);
      tiers.add(dims.tier);
    }
  }

  if (matched / mobs.length < 0.8) return null;

  return {
    races: [...races].sort(),
    classes: [...classes].sort(),
    tiers: [...tiers].sort((a, b) => a - b),
  };
}

/**
 * Group sprite entities by race + class, indexed by tier.
 */
export function groupSprites(
  entities: Entity[],
  config: SpriteConfig
): SpriteGroup[] {
  const groups: SpriteGroup[] = [];

  for (const race of config.races) {
    for (const cls of config.classes) {
      const group: SpriteGroup = {
        race,
        playerClass: cls,
        entityIds: {},
      };

      for (const entity of entities) {
        const dims = parseSpriteId(entity.id);
        if (dims && dims.race === race && dims.playerClass === cls) {
          group.entityIds[dims.tier] = entity.id;
        }
      }

      if (Object.keys(group.entityIds).length > 0) {
        groups.push(group);
      }
    }
  }

  return groups;
}
