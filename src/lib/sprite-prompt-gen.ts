import Anthropic from "@anthropic-ai/sdk";
import { STYLE_SUFFIX } from "./prompt-gen";
import type { SpriteConfig, SpriteDimensions, SpritePromptTemplate } from "../types/sprites";

const FORMAT_SPEC =
  "1:1 square character portrait centered in frame, full body visible, solid pale lavender (#d8d0e8) background";

/**
 * Generate a sprite prompt template with a single Claude call.
 * Returns a template string with {race}, {class}, {tier_description} placeholders,
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
1. "template" — a single image generation prompt template using these exact placeholders: {race}, {class}, {tier_description}. The template must produce a genderless/androgynous fantasy character portrait. The character should look like the SAME person at different stages of their career across tiers — same racial features and build, but different equipment and aura of power.
2. "tierDescriptions" — an object mapping each tier number to a description string that captures that tier's power level, equipment quality, and visual presence.

The template, when filled in, should be a complete image generation prompt. Do NOT include the style suffix — it will be appended automatically.

Output ONLY valid JSON — no markdown fences, no commentary.`,
    messages: [
      {
        role: "user",
        content: `Format: ${FORMAT_SPEC}

Races: ${config.races.join(", ")}
Classes: ${config.classes.join(", ")}

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

  const prompt = template.template
    .replace(/\{race\}/g, dimensions.race)
    .replace(/\{class\}/g, dimensions.playerClass)
    .replace(/\{tier_description\}/g, tierDesc)
    .replace(/\{name\}/g, entityName);

  return `${prompt}\n\n${STYLE_SUFFIX}`;
}
