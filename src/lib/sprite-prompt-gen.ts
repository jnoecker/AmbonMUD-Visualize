import Anthropic from "@anthropic-ai/sdk";
import { STYLE_SUFFIX } from "./prompt-gen";
import type { SpriteConfig, SpriteDimensions, SpritePromptTemplate } from "../types/sprites";
import {
  RACE_DEFINITIONS,
  CLASS_DEFINITIONS,
  TIER_DEFINITIONS,
  STAFF_RACE_PROMPTS,
} from "../types/sprites";

const FORMAT_SPEC =
  "1:1 square character portrait, full body front-facing neutral standing pose, centered on 512x512 canvas, head to feet visible with padding, solid pale lavender (#d8d0e8) background, character sheet even lighting from front";

/**
 * Generate a sprite prompt template with a single Claude call.
 * Returns a template string with {race_description}, {class_outfit}, {tier_visual} placeholders,
 * plus per-race, per-class, and per-tier description strings.
 */
export async function generateSpriteTemplate(
  apiKey: string,
  config: SpriteConfig,
  _sampleNames: Record<string, string>,
  zoneVibe: string
): Promise<SpritePromptTemplate> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const raceList = config.races
    .map((r) => {
      const def = RACE_DEFINITIONS[r];
      return `- ${r}: ${def?.bodyDescription || r}`;
    })
    .join("\n");

  const classList = config.classes
    .filter((c) => c !== "base")
    .map((c) => {
      const def = CLASS_DEFINITIONS[c];
      return `- ${c}: ${def?.outfitDescription || c}`;
    })
    .join("\n");

  const tierList = config.tiers
    .map((t) => {
      const def = TIER_DEFINITIONS[t];
      return `- ${t}: ${def?.visualDescription || t}`;
    })
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2500,
    system: `You are an expert image prompt engineer for AI image generators. You create prompts for fantasy RPG character sprites in the Surreal Gentle Magic aesthetic.

Your task: produce a JSON object with these fields:

1. "template" — a single image generation prompt template using these exact placeholders: {race_description}, {class_outfit}, {tier_visual}. The template should produce a fantasy character portrait. All figures must be ANDROGYNOUS — no gender signifiers (no breasts, no beards, no gendered body shapes). The body is defined entirely by the race, the outfit by the class, and the power level by the tier.

For the "base" class (tier t0), {class_outfit} will be "simple wrapped linen clothing, no armor, no weapons" — the template must work with this too.

2. "raceDescriptions" — an object mapping each race key to an optimized prompt-fragment describing that race's body. Lean into the alien/fantastical aspects. All descriptions must be androgynous. For humanoid races (archae, kitsarae, lustriae), explicitly describe narrow shoulders, no chest definition, smooth featureless torso, ageless angular face.

3. "classOutfits" — an object mapping each class key to a prompt-fragment describing that class's signature outfit, weapons, and accessories. Include "base" as a key with simple wrapped linen clothing.

4. "tierDescriptions" — an object mapping each tier key (t0, t10, t25, t50, tstaff) to a prompt-fragment describing the power level, material quality, and magical effects appropriate for that tier.

The template, when its placeholders are filled with the fragments above, should be a complete image generation prompt. Do NOT include the style suffix — it will be appended automatically.

Output ONLY valid JSON — no markdown fences, no commentary.`,
    messages: [
      {
        role: "user",
        content: `Format: ${FORMAT_SPEC}

Races:
${raceList}

Classes:
- base: simple wrapped linen clothing, no armor, no weapons, new arrival
${classList}

Tier progression:
${tierList}

Zone atmosphere: ${zoneVibe}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  // Strip markdown code fences if present
  const jsonText = block.text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const parsed = JSON.parse(jsonText);
  if (!parsed.template || !parsed.tierDescriptions || !parsed.raceDescriptions || !parsed.classOutfits) {
    throw new Error("Invalid template response: missing required fields (template, raceDescriptions, classOutfits, tierDescriptions)");
  }

  return {
    template: parsed.template,
    tierDescriptions: parsed.tierDescriptions,
    raceDescriptions: parsed.raceDescriptions,
    classOutfits: parsed.classOutfits,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Fill a sprite template for a specific entity. Pure string substitution, no API call.
 */
export function fillSpriteTemplate(
  template: SpritePromptTemplate,
  dimensions: SpriteDimensions,
  _entityName: string
): string {
  // Staff tier uses unique per-race god-tier prompts, bypassing the template entirely.
  if (dimensions.tier === "tstaff" && STAFF_RACE_PROMPTS[dimensions.race]) {
    const staffPrompt = `${FORMAT_SPEC}. ${STAFF_RACE_PROMPTS[dimensions.race]}`;
    return `${staffPrompt}\n\n${STYLE_SUFFIX}`;
  }

  // Canonical race descriptions always win — they're curated in code,
  // while Claude's template versions may drift or soften the descriptions.
  const raceDesc = RACE_DEFINITIONS[dimensions.race]?.bodyDescription
    || template.raceDescriptions[dimensions.race]
    || dimensions.race;

  // Canonical class outfits always win for the same reason.
  const classOutfit = (dimensions.playerClass === "base"
      ? template.classOutfits["base"]
      : CLASS_DEFINITIONS[dimensions.playerClass]?.outfitDescription)
    || template.classOutfits[dimensions.playerClass]
    || "simple wrapped linen clothing";

  const tierVisual = template.tierDescriptions[dimensions.tier]
    || TIER_DEFINITIONS[dimensions.tier]?.visualDescription
    || "adventurer";

  const prompt = template.template
    .replace(/\{race\}/g, dimensions.race)
    .replace(/\{race_description\}/g, raceDesc)
    .replace(/\{class\}/g, dimensions.playerClass)
    .replace(/\{class_outfit\}/g, classOutfit)
    .replace(/\{tier\}/g, dimensions.tier)
    .replace(/\{tier_visual\}/g, tierVisual);

  return `${prompt}\n\n${STYLE_SUFFIX}`;
}
