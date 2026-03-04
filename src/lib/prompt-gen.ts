import Anthropic from "@anthropic-ai/sdk";
import type { Entity, EntityType } from "../types/entities";

const STYLE_SUFFIX = `Rendered in the Surreal Gentle Magic style (surreal_softmagic_v1), featuring:
- Soft lavender and pale blue undertones
- Ambient diffused lighting (no harsh shadows, no spotlighting)
- Gentle atmospheric haze with floating motes of light
- Subtle magical glow integrated naturally into the environment
- Slightly elongated organic forms (trees, towers, figures)
- NO neon colors, NO high contrast, NO harsh edges
- Dreamy, breathable, emotionally safe aesthetic`;

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
      "You are an expert image prompt engineer for AI image generators. Generate a fallback/default image prompt for this zone. The image should be atmospheric and representative of the zone without depicting any specific named entity. Output ONLY the prompt text — no labels, no markdown, no commentary.",
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
      "You are an expert image prompt engineer for AI image generators. Given an entity from a fantasy MUD zone, write a single optimized image generation prompt. Output ONLY the prompt text — no labels, no markdown, no commentary.",
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
