import Anthropic from "@anthropic-ai/sdk";
import type { Entity } from "./generators/types";

const STYLE_SUFFIX = `Rendered in the Surreal Gentle Magic style (surreal_softmagic_v1), featuring:
- Soft lavender and pale blue undertones
- Ambient diffused lighting (no harsh shadows, no spotlighting)
- Gentle atmospheric haze with floating motes of light
- Subtle magical glow integrated naturally into the environment
- Slightly elongated organic forms (trees, towers, figures)
- NO neon colors, NO high contrast, NO harsh edges
- Dreamy, breathable, emotionally safe aesthetic`;

const FORMAT_BY_TYPE: Record<string, string> = {
  room: "16:9 landscape background illustration, wide establishing shot, no characters in foreground",
  mob: "1:1 square character portrait centered in frame, full body visible, solid pale lavender (#d8d0e8) background for later removal",
  item: "1:1 square item icon centered in frame, floating on solid pale lavender (#d8d0e8) background for later removal, no hands or characters",
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export async function generateZoneVibe(
  zoneName: string,
  allRoomDescriptions: string[]
): Promise<string> {
  const anthropic = getClient();
  const roomsText = allRoomDescriptions.join("\n\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 300,
    system:
      "You are an art director for a fantasy MUD game. Given all room descriptions from a zone, produce a 2-3 sentence atmosphere/vibe summary that captures the zone's overall mood, color palette tendencies, and emotional tone. This summary will be used as context when generating image prompts for individual entities in the zone. Be specific and evocative.",
    messages: [
      {
        role: "user",
        content: `Zone name: "${zoneName}"\n\nRoom descriptions:\n${roomsText}\n\nWrite a 2-3 sentence zone vibe summary.`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text.trim();
}

export async function generateEntityPrompt(
  entity: Entity,
  zoneVibe: string
): Promise<string> {
  const anthropic = getClient();
  const format = FORMAT_BY_TYPE[entity.type];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    system: `You are an expert image prompt engineer for a fantasy MUD game using the "Surreal Gentle Magic" art style. Your job is to write a single, detailed image generation prompt optimized for DALL-E 3 and Stable Diffusion.

Rules:
- Output ONLY the prompt text, no labels, no markdown, no explanation.
- Start with the format specification: "${format}"
- Include specific visual details: colors, materials, lighting, mood, composition.
- Draw from the entity's description and the zone's overall vibe.
- End every prompt with the standard style suffix (provided below).
- Keep the total prompt under 300 words.

Standard style suffix to append:
${STYLE_SUFFIX}`,
    messages: [
      {
        role: "user",
        content: `Zone vibe: ${zoneVibe}

Entity type: ${entity.type}
Entity name: "${entity.title}"
Description: ${entity.description}
Additional context: ${entity.extraContext}

Write the image generation prompt.`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text.trim();
}
