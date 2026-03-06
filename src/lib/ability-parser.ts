import YAML from "yaml";
import type { Entity } from "../types/entities";
import type { AbilityConfig, AbilityDefinition, StatusEffectDefinition } from "../types/abilities";

/**
 * Walk an arbitrary nested object looking for ability definitions.
 * Supports:
 *   - top-level `definitions:`
 *   - `abilities.definitions:`
 *   - `ambonmud.engine.abilities.definitions:` (full application.yaml)
 */
function findAbilityDefinitions(
  root: Record<string, unknown>
): Record<string, AbilityDefinition> | null {
  // Direct
  if (root.definitions && looksLikeAbilities(root.definitions)) {
    return root.definitions as Record<string, AbilityDefinition>;
  }

  // abilities.definitions
  const abilities = root.abilities as Record<string, unknown> | undefined;
  if (abilities?.definitions && looksLikeAbilities(abilities.definitions)) {
    return abilities.definitions as Record<string, AbilityDefinition>;
  }

  // Deep walk: ambonmud.engine.abilities.definitions
  const ambonmud = root.ambonmud as Record<string, unknown> | undefined;
  const engine = ambonmud?.engine as Record<string, unknown> | undefined;
  const deepAbilities = engine?.abilities as Record<string, unknown> | undefined;
  if (deepAbilities?.definitions && looksLikeAbilities(deepAbilities.definitions)) {
    return deepAbilities.definitions as Record<string, AbilityDefinition>;
  }

  return null;
}

/**
 * Walk an arbitrary nested object looking for status effect definitions.
 */
function findStatusEffectDefinitions(
  root: Record<string, unknown>
): Record<string, StatusEffectDefinition> | null {
  // Direct
  if (root.statusEffects) {
    const se = root.statusEffects as Record<string, unknown>;
    if (se.definitions && typeof se.definitions === "object") {
      return se.definitions as Record<string, StatusEffectDefinition>;
    }
  }

  // Deep walk: ambonmud.engine.statusEffects.definitions
  const ambonmud = root.ambonmud as Record<string, unknown> | undefined;
  const engine = ambonmud?.engine as Record<string, unknown> | undefined;
  const statusEffects = engine?.statusEffects as Record<string, unknown> | undefined;
  if (statusEffects?.definitions && typeof statusEffects.definitions === "object") {
    return statusEffects.definitions as Record<string, StatusEffectDefinition>;
  }

  return null;
}

/**
 * Extract class names from classStartRooms if present.
 */
function findClassStartRooms(root: Record<string, unknown>): string[] | null {
  // Direct
  if (root.classStartRooms && typeof root.classStartRooms === "object") {
    return Object.keys(root.classStartRooms as Record<string, unknown>);
  }

  // Deep walk: ambonmud.classStartRooms
  const ambonmud = root.ambonmud as Record<string, unknown> | undefined;
  if (ambonmud?.classStartRooms && typeof ambonmud.classStartRooms === "object") {
    return Object.keys(ambonmud.classStartRooms as Record<string, unknown>);
  }

  return null;
}

/**
 * Extract a string array from various YAML shapes:
 *   - A plain array of strings: ["human", "elf"]
 *   - An object whose keys are the values: { HUMAN: {...}, ELF: {...} }
 */
function extractStringList(val: unknown): string[] | null {
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
    return val as string[];
  }
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return Object.keys(val as Record<string, unknown>);
  }
  return null;
}

/**
 * Find races list from various nesting levels.
 */
function findRaces(root: Record<string, unknown>): string[] | null {
  if (root.races) return extractStringList(root.races);
  const ambonmud = root.ambonmud as Record<string, unknown> | undefined;
  if (ambonmud?.races) return extractStringList(ambonmud.races);
  return null;
}

/**
 * Find genders list from various nesting levels.
 */
function findGenders(root: Record<string, unknown>): string[] | null {
  if (root.genders) return extractStringList(root.genders);
  const ambonmud = root.ambonmud as Record<string, unknown> | undefined;
  if (ambonmud?.genders) return extractStringList(ambonmud.genders);
  return null;
}

function looksLikeAbilities(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const entries = Object.values(obj as Record<string, unknown>);
  if (entries.length < 2) return false;
  let count = 0;
  for (const entry of entries.slice(0, 5)) {
    if (
      entry &&
      typeof entry === "object" &&
      "requiredClass" in entry &&
      "effect" in entry &&
      "manaCost" in entry
    ) {
      count++;
    }
  }
  return count / Math.min(entries.length, 5) >= 0.6;
}

/**
 * Parse an ability definitions YAML file into entities.
 * Handles the full application.yaml structure (ambonmud.engine.abilities.definitions)
 * as well as simpler formats.
 *
 * Also parses status effect definitions and extracts class config.
 */
export function parseAbilities(yamlContent: string): {
  entities: Entity[];
  config: AbilityConfig;
} {
  const parsed = YAML.parse(yamlContent) as Record<string, unknown>;

  const definitions = findAbilityDefinitions(parsed);
  if (!definitions) {
    throw new Error("No ability definitions found in YAML");
  }

  const statusDefs = findStatusEffectDefinitions(parsed);
  const classStartRoomClasses = findClassStartRooms(parsed);
  const races = findRaces(parsed);
  const genders = findGenders(parsed);

  const classes = new Set<string>();
  const targetTypes = new Set<string>();
  const effectTypes = new Set<string>();
  const entities: Entity[] = [];

  // Add classes from classStartRooms
  if (classStartRoomClasses) {
    for (const cls of classStartRoomClasses) {
      // Filter out debug/test classes
      if (cls !== "SWARM") classes.add(cls);
    }
  }

  // Parse ability definitions
  for (const [id, ability] of Object.entries(definitions)) {
    if (!ability.displayName || !ability.requiredClass) continue;

    classes.add(ability.requiredClass);
    targetTypes.add(ability.targetType);
    effectTypes.add(ability.effect.type);

    const effectDesc = formatEffect(ability);

    const extra = [
      `Class: ${ability.requiredClass}`,
      `Level: ${ability.levelRequired}`,
      `Mana: ${ability.manaCost}`,
      ability.cooldownMs > 0 ? `Cooldown: ${(ability.cooldownMs / 1000).toFixed(0)}s` : null,
      `Target: ${ability.targetType}`,
      `Effect: ${effectDesc}`,
    ]
      .filter(Boolean)
      .join("\n");

    entities.push({
      id: `abilities:${id}`,
      bareId: id,
      type: "ability",
      title: ability.displayName,
      description: ability.description,
      extraContext: extra,
      rawYaml: ability as unknown as Record<string, unknown>,
    });
  }

  // Parse status effect definitions
  if (statusDefs) {
    for (const [id, statusEffect] of Object.entries(statusDefs)) {
      if (!statusEffect.displayName) continue;

      const extra = [
        `Effect type: ${statusEffect.effectType}`,
        statusEffect.durationMs ? `Duration: ${(statusEffect.durationMs / 1000).toFixed(0)}s` : null,
        statusEffect.stackBehavior ? `Stacking: ${statusEffect.stackBehavior}` : null,
        statusEffect.shieldAmount ? `Shield: ${statusEffect.shieldAmount}` : null,
        statusEffect.tickMinValue != null
          ? `Tick: ${statusEffect.tickMinValue}-${statusEffect.tickMaxValue} every ${((statusEffect.tickIntervalMs ?? 0) / 1000).toFixed(0)}s`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      entities.push({
        id: `statusEffects:${id}`,
        bareId: id,
        type: "ability",
        title: statusEffect.displayName,
        description: `${statusEffect.displayName} (${statusEffect.effectType})`,
        extraContext: extra,
        rawYaml: statusEffect as unknown as Record<string, unknown>,
      });
    }
  }

  return {
    entities,
    config: {
      classes: [...classes].sort(),
      targetTypes: [...targetTypes].sort(),
      effectTypes: [...effectTypes].sort(),
      races: races ?? undefined,
      genders: genders ?? undefined,
    },
  };
}

function formatEffect(ability: AbilityDefinition): string {
  const e = ability.effect;
  switch (e.type) {
    case "DIRECT_DAMAGE":
      return `${e.minDamage}-${e.maxDamage} damage`;
    case "DIRECT_HEAL":
      return `${(e as any).minHeal}-${(e as any).maxHeal} healing`;
    case "AREA_DAMAGE":
      return `${e.minDamage}-${e.maxDamage} AoE damage`;
    case "APPLY_STATUS":
      return `Apply ${(e as any).statusEffectId}`;
    case "TAUNT":
      return `Taunt (${(e as any).flatThreat} threat)`;
    default:
      return e.type;
  }
}

/**
 * Detect whether a YAML string contains ability definitions.
 */
export function detectAbilityYaml(yamlContent: string): boolean {
  try {
    const parsed = YAML.parse(yamlContent) as Record<string, unknown>;
    return findAbilityDefinitions(parsed) !== null;
  } catch {
    return false;
  }
}

/**
 * Get the AbilityDefinition for a given entity, extracted from rawYaml.
 */
export function getAbilityFromEntity(entity: Entity): AbilityDefinition {
  return entity.rawYaml as unknown as AbilityDefinition;
}

/**
 * Get the YAML document paths to the ability/statusEffect definitions sections.
 * Returns paths that can be used with YAML.Document navigation.
 */
export function getDefinitionPaths(yamlContent: string): {
  abilitiesPath: string[];
  statusEffectsPath: string[];
} {
  const parsed = YAML.parse(yamlContent) as Record<string, unknown>;

  let abilitiesPath: string[] = [];
  let statusEffectsPath: string[] = [];

  // Check ability paths
  if (parsed.definitions && looksLikeAbilities(parsed.definitions)) {
    abilitiesPath = ["definitions"];
  } else {
    const abilities = (parsed as any).abilities;
    if (abilities?.definitions && looksLikeAbilities(abilities.definitions)) {
      abilitiesPath = ["abilities", "definitions"];
    } else {
      const engine = (parsed as any).ambonmud?.engine;
      if (engine?.abilities?.definitions && looksLikeAbilities(engine.abilities.definitions)) {
        abilitiesPath = ["ambonmud", "engine", "abilities", "definitions"];
      }
    }
  }

  // Check status effect paths
  if ((parsed as any).statusEffects?.definitions) {
    statusEffectsPath = ["statusEffects", "definitions"];
  } else if ((parsed as any).ambonmud?.engine?.statusEffects?.definitions) {
    statusEffectsPath = ["ambonmud", "engine", "statusEffects", "definitions"];
  }

  return { abilitiesPath, statusEffectsPath };
}
