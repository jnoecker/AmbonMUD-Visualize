import Anthropic from "@anthropic-ai/sdk";
import { STYLE_SUFFIX } from "./prompt-gen";
import type { Entity } from "../types/entities";
import type { AbilityDefinition } from "../types/abilities";

const FORMAT_SPEC =
  "1:1 square ability icon centered in frame, symbolic/iconic representation, solid pale lavender (#d8d0e8) background";

/**
 * Generate an image prompt for an ability/spell icon.
 */
export async function generateAbilityPrompt(
  apiKey: string,
  _entity: Entity,
  ability: AbilityDefinition
): Promise<string> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    system: `You are an expert image prompt engineer for AI image generators. You create prompts for fantasy RPG ability/spell icons in the Surreal Gentle Magic design system.

Your task: given a game ability definition, create an image generation prompt for a symbolic icon representing that ability. The icon should:
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
- Healing abilities should use warm, inviting golden-white light
- Damage abilities should show the element/weapon stylized as a glowing symbol
- Status/buff abilities should show abstract auras or symbolic shields/enhancements
- AVOID depicting full characters, hands, or faces — keep it iconic and symbolic
- The icon should read clearly at small sizes (256x256)

Output ONLY the prompt text — no labels, no markdown, no commentary.`,
    messages: [
      {
        role: "user",
        content: `Format: ${FORMAT_SPEC}

Ability: ${ability.displayName}
Description: ${ability.description}
Class: ${ability.requiredClass}
Target: ${ability.targetType}
Effect type: ${ability.effect.type}
Level: ${ability.levelRequired}

Required style suffix (include verbatim at the end):
${STYLE_SUFFIX}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }
  throw new Error("Unexpected response format from Claude");
}
