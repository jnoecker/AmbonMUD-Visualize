import Anthropic from "@anthropic-ai/sdk";
import { STYLE_SUFFIX } from "./prompt-gen";
import type { PortraitConfig, PortraitPromptTemplate, PortraitDimensions } from "../types/portraits";
import { RACE_DEFINITIONS, CLASS_DEFINITIONS } from "../types/sprites";

const PORTRAIT_STYLE_PREAMBLE =
  "Digital fantasy painting in the Surreal Gentle Magic style — dreamy storybook illustration with visible painterly brushwork and soft textured rendering throughout. Soft lavender and pale blue undertones, ambient diffused lighting with NO clear source point, gentle atmospheric haze with floating motes of light. Gentle curves over hard angles, slightly elongated organic forms. FORBIDDEN: photorealism, 3D render look, neon colors, high contrast, harsh edges, sharp shadows, spotlight effects.";

const RACE_FORMAT_SPEC =
  `2:3 portrait orientation character portrait. ${PORTRAIT_STYLE_PREAMBLE} Close-up to mid-shot framing, richly detailed painterly environment background with soft atmospheric depth`;

const CLASS_FORMAT_SPEC =
  `2:3 portrait orientation action portrait of an Archae (androgynous humanoid with angular features, warm skin tones, ageless face). ${PORTRAIT_STYLE_PREAMBLE} Mid-shot framing, dynamic or atmospheric pose, richly detailed painterly environment background`;

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
    max_tokens: 5000,
    system: `You are an expert image prompt engineer for AI image generators. You work EXCLUSIVELY within the Surreal Gentle Magic (surreal_softmagic_v1) design system.

## CRITICAL STYLE RULES — every portrait MUST follow these:
- DIGITAL FANTASY PAINTING — visible painterly brushwork, soft textured rendering. Think dreamy storybook illustration.
- NEVER photorealistic, NEVER 3D-rendered, NEVER concept art, NEVER anime/manga
- Soft lavender and pale blue undertones suffusing every surface — cool undertones dominate
- Ambient diffused lighting with NO clear source point — light feels magical and source-ambiguous
- Gentle atmospheric haze with floating motes of light and faint magical particles
- Gentle curves over hard angles, slightly elongated organic forms, micro-warping on edges
- NO neon colors, NO saturated primaries, NO pure black, NO high contrast
- NO harsh shadows, NO spotlight effects, NO rim lighting, NO chiaroscuro
- Every scene must feel: gentle, breathable, enchanted, emotionally safe, welcoming
- Color palette: lavender #a897d2, pale blue #8caec9, dusty rose #b88faa, moss green #8da97b, soft gold #bea873

These portraits appear on a character creation screen. They should be visually stunning and evocative — selling the fantasy of each race and class. They are 2:3 portrait orientation. The overall feeling must be DREAMY and PAINTERLY, like an illustrated fantasy book cover, NOT like a video game screenshot or CGI render.

Your task: produce a JSON object with these fields:

1. "raceTemplate" — a prompt template for RACE portraits using the placeholder {race_description}. The template MUST begin with "Digital fantasy painting in the Surreal Gentle Magic style, dreamy storybook illustration with visible painterly brushwork," followed by the portrait description. The race portrait shows the race in a fitting atmospheric environment. Close-up to mid-shot framing. No class outfit — just the race's natural form.

2. "classTemplate" — a prompt template for CLASS portraits using placeholders {race_description} and {class_outfit}. The template MUST begin with "Digital fantasy painting in the Surreal Gentle Magic style, dreamy storybook illustration with visible painterly brushwork," followed by the portrait description. Class portraits depict an Archae in the class outfit in an atmospheric scene. Mid-shot framing.

3. "raceDescriptions" — an object mapping each race key to an optimized prompt-fragment for that race's appearance. Lean into alien/fantastical. All androgynous. For humanoid races, explicitly note angular androgynous features, no gendered body features.

4. "classOutfits" — an object mapping each class key to a vivid prompt-fragment for the class outfit, weapons, and magical effects at their most impressive (Legendary tier).

IMPORTANT: The templates must explicitly include phrases like "soft ambient diffused lighting", "gentle atmospheric haze", "painterly brushwork", "dreamy softly luminous" to steer the image generator toward the right aesthetic. Do NOT leave style enforcement to the suffix alone.

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

  let jsonText = block.text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  // Fix unescaped newlines inside JSON string values — Claude sometimes
  // outputs multi-line strings without escaping the newlines.
  jsonText = jsonText.replace(/(?<=:\s*"(?:[^"\\]|\\.)*)(\r?\n)(?=[^"]*")/g, "\\n");

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    // Log the raw text for debugging, then rethrow with context
    console.error("[portrait-prompt-gen] Failed to parse JSON response. Raw text:", jsonText.slice(0, 500));
    throw new Error(`Failed to parse template JSON: ${(e as Error).message}. The LLM response may have been truncated or malformed. Try regenerating.`);
  }
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
 * Style preamble prepended to every filled portrait prompt to ensure
 * the image generator receives strong style steering at the very start.
 */
const PORTRAIT_PROMPT_PREFIX =
  "Digital fantasy painting in the Surreal Gentle Magic style (surreal_softmagic_v1), dreamy storybook illustration with visible soft painterly brushwork and textured rendering throughout, soft lavender and pale blue undertones, ambient diffused magical lighting with no clear source, gentle atmospheric haze with floating motes of light. NOT a photograph, NOT a 3D render, NOT concept art. 2:3 portrait orientation. All figures are fully clothed and androgynous with completely flat chests — no breasts, no cleavage, no exposed skin on the torso. All figures have a humanoid body shape with two arms and two legs.";

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

    const filled = template.raceTemplate
      .replace(/\{race\}/g, dimensions.key)
      .replace(/\{race_description\}/g, raceDesc);

    return `${PORTRAIT_PROMPT_PREFIX}\n\n${filled}\n\n${STYLE_SUFFIX}`;
  }

  // Class portrait — always uses Archae as the showcase race
  const archaeDesc = RACE_DEFINITIONS["archae"]?.bodyDescription || "androgynous humanoid";
  const classOutfit = CLASS_DEFINITIONS[dimensions.key]?.outfitDescription
    || template.classOutfits[dimensions.key]
    || dimensions.key;

  const filled = template.classTemplate
    .replace(/\{race\}/g, "archae")
    .replace(/\{race_description\}/g, archaeDesc)
    .replace(/\{class\}/g, dimensions.key)
    .replace(/\{class_outfit\}/g, classOutfit);

  return `${PORTRAIT_PROMPT_PREFIX}\n\n${filled}\n\n${STYLE_SUFFIX}`;
}
