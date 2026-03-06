import { llmGenerate, type LlmCallOptions } from "./llm";
import type { Entity, EntityType } from "../types/entities";

/**
 * Condensed Surreal Gentle Magic design system reference, derived from
 * reference/STYLE_GUIDE.md. Included in Claude system prompts so it can
 * actively shape prompts toward the aesthetic.
 */
const STYLE_GUIDE_REFERENCE = `# Surreal Gentle Magic (surreal_softmagic_v1) — Design System Reference

## Core Philosophy
- Enchanted, not explosive — magic feels ambient and inevitable, never aggressive
- Dreamlike, not chaotic — softness enables focus and contemplation
- Softly luminous, never harsh — light is a character, not a weapon
- Otherworldly, but emotionally safe — viewers feel welcomed, not threatened
- KEY PRINCIPLE: Nothing feels industrial. Nothing feels sharp unless narratively intentional.

## Shapes
PREFERRED: Slight vertical elongation, gentle curves over hard angles, organic lived-in quality, micro-warping (nothing perfectly straight)
FORBIDDEN: Harsh geometric symmetry, perfect 90° realism, brutalist silhouettes, mechanical rigidity

## Color Palette
Primary tones: Lavender #a897d2, Pale Blue #8caec9, Dusty Rose #b88faa, Moss Green #8da97b, Soft Gold #bea873
Neutrals: Deep Mist #22293c (darkest), Soft Fog #6f7da1, Cloud #d8def1
Rules: No neon, no saturated primaries, no pure black. Cool undertones dominate, warm accents (dusty rose, soft gold) balance. Contrast is moderate, never stark.

## Light Behavior
Light sources feel: AMBIENT (no clear source point), DIFFUSED (edges fade softly), SOURCE-AMBIGUOUS (viewer unsure where glow originates)
Treatments: Ground-level glow (magical plants, glowing moss), halos around magical beings, soft bloom around windows and light sources, light threads connecting magical objects, atmospheric diffusion creating depth
FORBIDDEN: Sharp rim lights, hard shadows, spotlight effects, high-contrast chiaroscuro

## Text in Images
AI image generators cannot reliably render readable text. NEVER include signs, labels, plaques, book titles, inscriptions, or any readable words in prompts. Instead replace them with: mysterious glowing runes, arcane glyphs, softly luminous symbols, ancient mystical script, or indecipherable magical sigils. This applies to ALL references to writing, signs, banners with text, scrolls, etc.

## Emotional Check
Every image must feel: gentle, slow/breathable, enchanted but safe, welcoming.
If it feels intense, loud, sharp, or industrial — it's wrong. Revise.`;

export const STYLE_SUFFIX = `Rendered in the Surreal Gentle Magic style (surreal_softmagic_v1). Digital fantasy painting in the style of a dreamy storybook illustration — NOT a photograph, NOT a 3D render, NOT concept art. Visible painterly brushwork with soft textured rendering throughout.

Color and light:
- Soft lavender and pale blue undertones suffusing every surface — cool undertones dominate, warm accents (dusty rose, soft gold) used sparingly for balance
- Ambient diffused lighting with NO clear source point — light feels source-ambiguous and magical, never like realistic sunlight or artificial lamps
- Gentle atmospheric haze with floating motes of light and faint magical particles drifting in the air
- Soft bloom around windows and light sources, ground-level magical glow (glowing moss, luminous plants)
- Even mundane spaces feel quietly enchanted — a kitchen has faintly glowing herbs, a patio has drifting light motes

Shape and form:
- Gentle curves over hard angles — nothing perfectly straight, micro-warping on all edges
- Slightly elongated organic forms (trees, towers, figures, architecture, furniture)
- Organic lived-in quality — nothing feels industrial, nothing feels mechanical

NO readable text, words, letters, or legible writing — replace all signs, plaques, and inscriptions with glowing runes or arcane glyphs.

FORBIDDEN: photorealism, neon colors, high contrast, harsh edges, sharp geometric lines, perfect 90-degree angles, mechanical rigidity, brutalist silhouettes, harsh shadows, spotlight effects, rim lighting, chiaroscuro`;

const FORMAT_BY_TYPE: Record<EntityType, string> = {
  room: "16:9 landscape background illustration, wide establishing shot, no characters in foreground",
  mob: '1:1 square character portrait centered in frame, full body visible, solid pale lavender (#d8d0e8) background',
  item: '1:1 square item icon centered in frame, floating on solid pale lavender (#d8d0e8) background, no hands or characters',
  ability: '1:1 square ability icon centered in frame, symbolic/iconic representation, solid pale lavender (#d8d0e8) background',
};

export async function generateZoneVibe(
  llmOpts: LlmCallOptions,
  zoneName: string,
  allRoomDescriptions: string[]
): Promise<string> {
  const systemPrompt = `You are an art director for a fantasy MUD game working within the Surreal Gentle Magic design system.

${STYLE_GUIDE_REFERENCE}

Given a list of room descriptions from a zone, produce a 2-3 sentence atmosphere/vibe summary that captures the zone's overall visual identity AS IT WOULD APPEAR in the Surreal Gentle Magic style. Focus on lighting, mood, dominant colors from the approved palette, and environmental feel. Even if the zone descriptions reference modern or mundane settings, describe the vibe as it would look after being transformed into this dreamy, painterly aesthetic. Be evocative but concise.`;

  const userMessage = `Zone: ${zoneName}\n\nRoom descriptions:\n${allRoomDescriptions.join("\n\n")}`;

  return llmGenerate(llmOpts, systemPrompt, userMessage, 300);
}

const DEFAULT_DESCRIPTION_BY_TYPE: Record<EntityType, string> = {
  room: "a generic room scene that captures the zone's atmosphere",
  mob: "a generic creature or character silhouette that fits the zone's atmosphere",
  item: "a generic magical item or artifact that fits the zone's atmosphere",
  ability: "a generic magical ability icon with glowing arcane energy",
};

export async function generateDefaultImagePrompt(
  llmOpts: LlmCallOptions,
  entityType: EntityType,
  zoneName: string,
  zoneVibe: string
): Promise<string> {
  const formatSpec = FORMAT_BY_TYPE[entityType];
  const description = DEFAULT_DESCRIPTION_BY_TYPE[entityType];

  const systemPrompt = `You are an expert image prompt engineer for AI image generators. You work exclusively within the Surreal Gentle Magic design system.

${STYLE_GUIDE_REFERENCE}

Generate a fallback/default image prompt for this zone. The image should be atmospheric and representative of the zone without depicting any specific named entity. You must actively reimagine any modern or mundane elements as dreamy fantasy equivalents — replace fluorescent lights with ambient magical glow, replace concrete with weathered enchanted stone, replace sharp angles with gently curved organic forms. The result must look like a painterly storybook illustration, never a photograph. Output ONLY the prompt text — no labels, no markdown, no commentary.`;

  const userMessage = `Format: ${formatSpec}

Generate a default ${entityType} image: ${description}

Zone: ${zoneName}
Zone atmosphere: ${zoneVibe}

Required style suffix (include verbatim at the end):
${STYLE_SUFFIX}`;

  return llmGenerate(llmOpts, systemPrompt, userMessage, 500);
}

export async function generateEntityPrompt(
  llmOpts: LlmCallOptions,
  entity: Entity,
  zoneVibe: string
): Promise<string> {
  const formatSpec = FORMAT_BY_TYPE[entity.type];

  const systemPrompt = `You are an expert image prompt engineer for AI image generators. You work exclusively within the Surreal Gentle Magic design system.

${STYLE_GUIDE_REFERENCE}

Given an entity from a fantasy MUD zone, write a single optimized image generation prompt. CRITICAL: You must actively transform the scene toward the Surreal Gentle Magic aesthetic. Even if the source description sounds modern, industrial, or mundane:
- Replace harsh/artificial lighting with ambient magical glow and source-ambiguous diffused light
- Replace straight geometric surfaces with gently curved, micro-warped organic forms
- Replace industrial materials (metal panels, concrete, glass) with enchanted equivalents (weathered stone, living wood, crystalline surfaces)
- Add subtle magical elements: floating motes, faint luminous particles, glowing vegetation, atmospheric haze
- Ensure the palette stays within the approved tones (lavender, pale blue, dusty rose, moss green, soft gold on deep dark backgrounds)
- Replace any references to readable text, signs, plaques, banners, or inscriptions with glowing runes, arcane glyphs, or mysterious luminous symbols — AI cannot render legible text

Every scene must feel like a softly luminous storybook illustration — gentle, breathable, and quietly enchanted. Output ONLY the prompt text — no labels, no markdown, no commentary.`;

  const userMessage = `Format: ${formatSpec}

Entity type: ${entity.type}
Name: ${entity.title}
Description: ${entity.description}

Additional context:
${entity.extraContext}

Zone atmosphere: ${zoneVibe}

Required style suffix (include verbatim at the end):
${STYLE_SUFFIX}`;

  return llmGenerate(llmOpts, systemPrompt, userMessage, 500);
}

export async function generateCustomAssetPrompt(
  llmOpts: LlmCallOptions,
  description: string,
  entityType: EntityType,
  zoneVibe: string | null
): Promise<string> {
  const formatSpec = FORMAT_BY_TYPE[entityType];
  const vibeContext = zoneVibe
    ? `\n\nZone atmosphere (use as additional context for mood/palette): ${zoneVibe}`
    : "";

  const systemPrompt = `You are an expert image prompt engineer for AI image generators. You work exclusively within the Surreal Gentle Magic design system.

${STYLE_GUIDE_REFERENCE}

The user will provide a free-form description of an image they want generated. Transform it into an optimized image generation prompt that fully conforms to the Surreal Gentle Magic aesthetic. Apply the same transformation rules as for zone entities:
- Replace harsh/artificial elements with ambient magical equivalents
- Add subtle magical elements: floating motes, faint luminous particles, atmospheric haze
- Ensure the palette stays within approved tones
- Replace any references to readable text with glowing runes or arcane glyphs

Output ONLY the prompt text — no labels, no markdown, no commentary.`;

  const userMessage = `Format: ${formatSpec}

User description: ${description}${vibeContext}

Required style suffix (include verbatim at the end):
${STYLE_SUFFIX}`;

  return llmGenerate(llmOpts, systemPrompt, userMessage, 500);
}
