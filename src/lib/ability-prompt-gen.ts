import { llmGenerate, type LlmCallOptions } from "./llm";
import { STYLE_SUFFIX } from "./prompt-gen";
import type { Entity } from "../types/entities";
import type { AbilityDefinition, StatusEffectDefinition } from "../types/abilities";

const FORMAT_SPEC =
  "1:1 square ability icon centered in frame, symbolic/iconic representation, solid pale lavender (#d8d0e8) background";

const SYSTEM_PROMPT = `You are an expert image prompt engineer for AI image generators. You create prompts for fantasy RPG ability/spell/status-effect icons in the Surreal Gentle Magic design system.

Your task: given a game ability or status effect definition, create an image generation prompt for a symbolic icon. The icon should:
- Be a single centered symbolic/iconic illustration (NOT a scene, NOT a character portrait)
- Visually represent the ability's effect and flavor through symbolic imagery
- Use color cues matching the ability's school/type:
  - Warrior/physical: warm golds, amber, burnished bronze tones
  - Mage/arcane: deep purples, electric blues, crystalline whites
  - Mage/fire: warm oranges, deep reds, ember glows (but soft, not harsh)
  - Mage/ice: pale blues, silver-whites, frost tones
  - Cleric/holy: warm whites, soft golds, gentle radiance
  - Rogue/shadow: deep indigos, smoky grays, midnight purples
  - Rogue/poison: sickly greens, violet undertones
  - Healing/regeneration: warm golden-white light, green life energy
  - Shields/protection: translucent barriers, dome shapes, soft glowing edges
  - Damage-over-time: smoldering embers, dripping venom, crackling energy
  - Stun/crowd-control: stars, shattered glass, frozen shards
  - Buffs: ascending arrows, radiant auras, empowering glows
  - Debuffs: descending spirals, dark mists, weakening auras
- AVOID depicting full characters, hands, or faces — keep it iconic and symbolic
- The icon should read clearly at small sizes (256x256)

Output ONLY the prompt text — no labels, no markdown, no commentary.`;

/**
 * Generate an image prompt for an ability/spell icon.
 */
export async function generateAbilityPrompt(
  llmOpts: LlmCallOptions,
  entity: Entity
): Promise<string> {
  const raw = entity.rawYaml as Record<string, unknown>;

  // Determine if this is an ability (has requiredClass) or a status effect
  const isAbility = "requiredClass" in raw && "effect" in raw;

  let userContent: string;
  if (isAbility) {
    const ability = raw as unknown as AbilityDefinition;
    userContent = `Format: ${FORMAT_SPEC}

Ability: ${ability.displayName}
Description: ${ability.description}
Class: ${ability.requiredClass}
Target: ${ability.targetType}
Effect type: ${ability.effect.type}
Level: ${ability.levelRequired}

Required style suffix (include verbatim at the end):
${STYLE_SUFFIX}`;
  } else {
    const status = raw as unknown as StatusEffectDefinition;
    const details = [
      `Effect type: ${status.effectType}`,
      status.durationMs ? `Duration: ${(status.durationMs / 1000).toFixed(0)}s` : null,
      status.shieldAmount ? `Shield amount: ${status.shieldAmount}` : null,
      status.tickMinValue != null ? `Tick damage/heal: ${status.tickMinValue}-${status.tickMaxValue}` : null,
      status.stackBehavior ? `Stacking: ${status.stackBehavior}` : null,
    ].filter(Boolean).join("\n");

    userContent = `Format: ${FORMAT_SPEC}

Status Effect: ${status.displayName}
${details}

Required style suffix (include verbatim at the end):
${STYLE_SUFFIX}`;
  }

  return llmGenerate(llmOpts, SYSTEM_PROMPT, userContent, 500);
}
