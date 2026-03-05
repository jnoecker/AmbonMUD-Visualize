import Anthropic from "@anthropic-ai/sdk";
import { STYLE_SUFFIX } from "./prompt-gen";
import type { SpriteConfig, SpriteDimensions, SpritePromptTemplate } from "../types/sprites";

const FORMAT_SPEC =
  "1:1 square character portrait centered in frame, full body visible, solid pale lavender (#d8d0e8) background";

/**
 * Generate a sprite prompt template with a single Claude call.
 * Returns a template string with {race}, {gender}, {class}, {tier_description} placeholders,
 * plus per-tier description strings.
 */
export async function generateSpriteTemplate(
  apiKey: string,
  config: SpriteConfig,
  sampleNames: Record<number, string>,
  zoneVibe: string
): Promise<SpritePromptTemplate> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const tierList = config.tiers
    .map((t) => `Level ${t}: "${sampleNames[t] || `tier ${t}`}"`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1500,
    system: `You are an expert image prompt engineer for AI image generators. You create prompts for fantasy RPG character sprites.

Your task: produce a JSON object with two fields:
1. "template" — a single image generation prompt template using these exact placeholders: {race}, {gender}, {class}, {tier_description}. The template must produce a fantasy character portrait matching the specified gender. Each unique race+gender+class combination is its own character — a dwarf female warrior and a human male warrior should look completely different. Consistency only matters WITHIN a single progression path (the same race+gender+class across tiers should look like the same person at different career stages, with different equipment and aura of power). Use {gender} to describe the character's presentation (e.g. "a {gender} {race} {class}").

IMPORTANT: The {gender} placeholder will be filled with "male", "female", or "androgynous, gender-ambiguous" for nonbinary characters. Your template MUST work well with all three values. For nonbinary characters the filled prompt should naturally produce a character with androgynous features, ambiguous build, and a mysterious quality — consider incorporating visual cues like a partially shrouded or veiled face, fluid body proportions that blend masculine and feminine traits, and enigmatic presence.
2. "tierDescriptions" — an object mapping each tier number to a description string that captures that tier's power level, equipment quality, and visual presence.

The template, when filled in, should be a complete image generation prompt. Do NOT include the style suffix — it will be appended automatically.

Output ONLY valid JSON — no markdown fences, no commentary.`,
    messages: [
      {
        role: "user",
        content: `Format: ${FORMAT_SPEC}

Races: ${config.races.join(", ")}
Classes: ${config.classes.join(", ")}
Genders: ${config.genders.join(", ")}

Tier progression (with sample names):
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
  if (!parsed.template || !parsed.tierDescriptions) {
    throw new Error("Invalid template response: missing template or tierDescriptions");
  }

  // Ensure tier descriptions are keyed by number
  const tierDescriptions: Record<number, string> = {};
  for (const [key, value] of Object.entries(parsed.tierDescriptions)) {
    tierDescriptions[Number(key)] = value as string;
  }

  return {
    template: parsed.template,
    tierDescriptions,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Fill a sprite template for a specific entity. Pure string substitution, no API call.
 */
export function fillSpriteTemplate(
  template: SpritePromptTemplate,
  dimensions: SpriteDimensions,
  entityName: string
): string {
  const tierDesc = template.tierDescriptions[dimensions.tier] || `level ${dimensions.tier} adventurer`;

  // Map gender IDs to image-gen-friendly descriptors
  const genderDesc = dimensions.gender === "enby"
    ? "androgynous, gender-ambiguous"
    : dimensions.gender;

  const prompt = template.template
    .replace(/\{race\}/g, dimensions.race)
    .replace(/\{gender\}/g, genderDesc)
    .replace(/\{class\}/g, dimensions.playerClass)
    .replace(/\{tier_description\}/g, tierDesc)
    .replace(/\{name\}/g, entityName);

  return `${prompt}\n\n${STYLE_SUFFIX}`;
}
