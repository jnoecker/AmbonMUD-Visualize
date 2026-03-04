import Anthropic from "@anthropic-ai/sdk";
import type { Entity, EntityType } from "../types/entities";

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

FORBIDDEN: photorealism, neon colors, high contrast, harsh edges, sharp geometric lines, perfect 90-degree angles, mechanical rigidity, brutalist silhouettes, harsh shadows, spotlight effects, rim lighting, chiaroscuro`;

const FORMAT_BY_TYPE: Record<EntityType, string> = {
  room: "16:9 landscape background illustration, wide establishing shot, no characters in foreground",
  mob: '1:1 square character portrait centered in frame, full body visible, solid pale lavender (#d8d0e8) background',
  item: '1:1 square item icon centered in frame, floating on solid pale lavender (#d8d0e8) background, no hands or characters',
};

export async function generateZoneVibe(
  apiKey: string,
  zoneName: string,
  allRoomDescriptions: string[]
): Promise<string> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 300,
    system:
      "You are an art director for a fantasy MUD game. Given a list of room descriptions from a zone, produce a 2-3 sentence atmosphere/vibe summary that captures the zone's overall visual identity. Focus on lighting, mood, dominant colors, and environmental feel. Be evocative but concise.",
    messages: [
      {
        role: "user",
        content: `Zone: ${zoneName}\n\nRoom descriptions:\n${allRoomDescriptions.join("\n\n")}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }
  throw new Error("Unexpected response format from Claude");
}

const DEFAULT_DESCRIPTION_BY_TYPE: Record<EntityType, string> = {
  room: "a generic room scene that captures the zone's atmosphere",
  mob: "a generic creature or character silhouette that fits the zone's atmosphere",
  item: "a generic magical item or artifact that fits the zone's atmosphere",
};

export async function generateDefaultImagePrompt(
  apiKey: string,
  entityType: EntityType,
  zoneName: string,
  zoneVibe: string
): Promise<string> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const formatSpec = FORMAT_BY_TYPE[entityType];
  const description = DEFAULT_DESCRIPTION_BY_TYPE[entityType];

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    system:
      "You are an expert image prompt engineer for AI image generators specializing in the Surreal Gentle Magic aesthetic. Generate a fallback/default image prompt for this zone. The image should be atmospheric and representative of the zone without depicting any specific named entity. Reimagine any modern or mundane elements as dreamy fantasy equivalents with ambient magical glow, organic curved forms, and painterly softness. Output ONLY the prompt text — no labels, no markdown, no commentary.",
    messages: [
      {
        role: "user",
        content: `Format: ${formatSpec}

Generate a default ${entityType} image: ${description}

Zone: ${zoneName}
Zone atmosphere: ${zoneVibe}

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

export async function generateEntityPrompt(
  apiKey: string,
  entity: Entity,
  zoneVibe: string
): Promise<string> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const formatSpec = FORMAT_BY_TYPE[entity.type];

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    system:
      "You are an expert image prompt engineer for AI image generators specializing in the Surreal Gentle Magic aesthetic. Given an entity from a fantasy MUD zone, write a single optimized image generation prompt. CRITICAL: You must actively transform the scene toward the style — even if the source description sounds modern, industrial, or mundane, reimagine it as a dreamy fantasy painting. Replace harsh lighting with ambient magical glow, replace straight geometric surfaces with gently curved organic forms, replace industrial materials with enchanted equivalents. Every scene must feel like a softly luminous storybook illustration. Output ONLY the prompt text — no labels, no markdown, no commentary.",
    messages: [
      {
        role: "user",
        content: `Format: ${formatSpec}

Entity type: ${entity.type}
Name: ${entity.title}
Description: ${entity.description}

Additional context:
${entity.extraContext}

Zone atmosphere: ${zoneVibe}

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
