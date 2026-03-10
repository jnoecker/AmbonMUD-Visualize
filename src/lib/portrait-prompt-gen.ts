import Anthropic from "@anthropic-ai/sdk";
import { STYLE_SUFFIX } from "./prompt-gen";
import type { PortraitConfig, PortraitPromptTemplate, PortraitDimensions } from "../types/portraits";
import { RACE_DEFINITIONS, CLASS_DEFINITIONS } from "../types/sprites";

const RACE_FORMAT_SPEC =
  "2:3 portrait orientation, cinematic character portrait, dramatic close-up to mid-shot framing, richly detailed environment background, painterly fantasy illustration lighting";

const CLASS_FORMAT_SPEC =
  "2:3 portrait orientation, cinematic action portrait of an Archae (androgynous humanoid with angular features, warm skin tones, ageless face), dramatic mid-shot framing, richly detailed environment background, dynamic or atmospheric pose, painterly fantasy illustration lighting";

/**
 * Generate a portrait prompt template with a single Claude call.
 * Returns separate templates for race and class portraits,
 * plus per-race and per-class description strings.
 */
export async function generatePortraitTemplate(
  apiKey: string,
  config: PortraitConfig,
  zoneVibe: string
): Promise<PortraitPromptTemplate> {
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
    .map((c) => {
      const def = CLASS_DEFINITIONS[c];
      return `- ${c}: ${def?.outfitDescription || c}`;
    })
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 3000,
    system: `You are an expert image prompt engineer for AI image generators. You create prompts for cinematic character creation portraits in the Surreal Gentle Magic aesthetic.

These portraits appear on a character creation screen. They should be visually stunning, cinematic, and evocative — selling the fantasy of each race and class to the player. They are 2:3 portrait orientation, NOT square sprites.

Your task: produce a JSON object with these fields:

1. "raceTemplate" — a prompt template for RACE portraits using the placeholder {race_description}. The race portrait shows the race in a fitting atmospheric environment that evokes their nature. Close-up to mid-shot framing. Cinematic, dramatic, beautiful. The scene should feel like a movie poster for that race. No class outfit — just the race's natural form in an environment that suits them.

2. "classTemplate" — a prompt template for CLASS portraits using placeholders {race_description} and {class_outfit}. Class portraits always depict an Archae (the vanilla humanoid race) wearing the class outfit. Show them in an atmospheric scene that evokes the class fantasy — a battlefield, a mystical library, a shadowy alley, etc. Mid-shot framing, dynamic or atmospheric pose. The scene should sell the class fantasy.

3. "raceDescriptions" — an object mapping each race key to an optimized, vivid prompt-fragment for that race's appearance. Lean into the alien/fantastical. All descriptions must be androgynous. For humanoid races, explicitly note angular androgynous features.

4. "classOutfits" — an object mapping each class key to a vivid prompt-fragment for the class outfit, weapons, and magical effects at their most impressive (think Legendary tier). These should look stunning and powerful.

Both templates, when filled, should produce complete image generation prompts (without the style suffix — it will be appended automatically).

Output ONLY valid JSON — no markdown fences, no commentary.`,
    messages: [
      {
        role: "user",
        content: `Race portrait format: ${RACE_FORMAT_SPEC}
Class portrait format: ${CLASS_FORMAT_SPEC}

Races:
${raceList}

Classes:
${classList}

Zone atmosphere: ${zoneVibe}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  const jsonText = block.text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const parsed = JSON.parse(jsonText);
  if (!parsed.raceTemplate || !parsed.classTemplate || !parsed.raceDescriptions || !parsed.classOutfits) {
    throw new Error("Invalid template response: missing required fields");
  }

  return {
    raceTemplate: parsed.raceTemplate,
    classTemplate: parsed.classTemplate,
    raceDescriptions: parsed.raceDescriptions,
    classOutfits: parsed.classOutfits,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Fill a portrait template for a specific entity. Pure string substitution, no API call.
 */
export function fillPortraitTemplate(
  template: PortraitPromptTemplate,
  dimensions: PortraitDimensions
): string {
  if (dimensions.portraitType === "race") {
    const raceDesc = RACE_DEFINITIONS[dimensions.key]?.bodyDescription
      || template.raceDescriptions[dimensions.key]
      || dimensions.key;

    const prompt = template.raceTemplate
      .replace(/\{race\}/g, dimensions.key)
      .replace(/\{race_description\}/g, raceDesc);

    return `${prompt}\n\n${STYLE_SUFFIX}`;
  }

  // Class portrait — always uses Archae as the showcase race
  const archaeDesc = RACE_DEFINITIONS["archae"]?.bodyDescription || "androgynous humanoid";
  const classOutfit = CLASS_DEFINITIONS[dimensions.key]?.outfitDescription
    || template.classOutfits[dimensions.key]
    || dimensions.key;

  const prompt = template.classTemplate
    .replace(/\{race\}/g, "archae")
    .replace(/\{race_description\}/g, archaeDesc)
    .replace(/\{class\}/g, dimensions.key)
    .replace(/\{class_outfit\}/g, classOutfit);

  return `${prompt}\n\n${STYLE_SUFFIX}`;
}
