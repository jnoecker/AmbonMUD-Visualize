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
- Use color cues matching the ability's class and effect:

  CLASS COLOR PALETTES:
  - Bulwark (defensive tank): warm golds, burnished steel, shield shapes, fortress silhouettes, heavy metallic tones
  - Warden (aggressive fighter): warm amber, rust reds, earthy brown, sharp weapon motifs, fur and leather textures
  - Arcanist (scholarly mage): deep purples, electric blues, crystalline whites, arcane sigils, glowing tomes
  - Faeweaver (nature mage): living greens, floral pinks, vine tendrils, petal formations, budding flowers
  - Necromancer (death + clockwork): sickly greens, clockwork brass, bone whites, ghostly teal, gear motifs
  - Veil (shadow assassin): deep indigos, midnight purples, smoky grays, dagger silhouettes, living shadow wisps
  - Binder (anti-magic enforcer): blazing amber, golden chains, rune circles, suppression barriers, dissolving spell fragments
  - Stormblade (lightning warrior): electric blues, white lightning, storm grays, zig-zag energy streaks, crackling arcs
  - Herald (divine cleric): warm whites, soft golds, holy radiance, sacred symbols, gentle divine glow
  - Starweaver (cosmic mage): cosmic purples, nebula pinks, stellar whites, constellation patterns, swirling galaxies

  EFFECT COLOR MODIFIERS:
  - Healing/regeneration: warm golden-white light, green life energy
  - Shields/protection: translucent barriers, dome shapes, soft glowing edges
  - Damage-over-time: smoldering embers, dripping venom, crackling energy
  - Stun/crowd-control: stars, shattered glass, frozen shards
  - Buffs: ascending arrows, radiant auras, empowering glows
  - Debuffs: descending spirals, dark mists, weakening auras
  - Area effects: radiating rings, expanding waves, ground sigils
  - Taunt/threat: blazing eye motifs, roaring silhouettes, magnetic pull

- Combine the class palette with the effect modifier — e.g., a Faeweaver heal uses living greens with golden-white life energy; a Veil damage-over-time uses deep indigos with smoldering shadow embers
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
