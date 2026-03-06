import YAML from "yaml";
import type { Entity } from "../types/entities";
import type { AbilityConfig, AbilityDefinition } from "../types/abilities";

interface AbilityFile {
  definitions?: Record<string, AbilityDefinition>;
  abilities?: {
    definitions?: Record<string, AbilityDefinition>;
  };
}

/**
 * Parse an ability definitions YAML file into entities.
 * Supports both top-level `definitions:` and nested `abilities.definitions:`.
 */
export function parseAbilities(yamlContent: string): {
  entities: Entity[];
  config: AbilityConfig;
} {
  const parsed = YAML.parse(yamlContent) as AbilityFile;

  const definitions =
    parsed.definitions ?? parsed.abilities?.definitions;

  if (!definitions || typeof definitions !== "object") {
    throw new Error("No ability definitions found in YAML");
  }

  const classes = new Set<string>();
  const targetTypes = new Set<string>();
  const effectTypes = new Set<string>();
  const entities: Entity[] = [];

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

  return {
    entities,
    config: {
      classes: [...classes].sort(),
      targetTypes: [...targetTypes].sort(),
      effectTypes: [...effectTypes].sort(),
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
    const parsed = YAML.parse(yamlContent) as AbilityFile;
    const definitions = parsed.definitions ?? parsed.abilities?.definitions;
    if (!definitions || typeof definitions !== "object") return false;

    // Check if entries look like abilities (have requiredClass, effect, manaCost)
    const entries = Object.values(definitions);
    if (entries.length < 2) return false;

    let abilityCount = 0;
    for (const entry of entries.slice(0, 5)) {
      if (
        entry &&
        typeof entry === "object" &&
        "requiredClass" in entry &&
        "effect" in entry &&
        "manaCost" in entry
      ) {
        abilityCount++;
      }
    }
    return abilityCount / Math.min(entries.length, 5) >= 0.6;
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
