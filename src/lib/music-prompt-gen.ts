import Anthropic from "@anthropic-ai/sdk";
import type { MusicConfig } from "../types/music";

const SYSTEM_PROMPT = `You are a music director for a fantasy RPG that uses the "Surreal Gentle Magic" aesthetic. Given a zone description and its atmosphere, produce a JSON music configuration for ambient background music.

The music should feel: gentle, atmospheric, dreamlike, enchanted but safe, slow and breathable. It should evoke the specific mood and environment of the zone.

Instrument guidelines:
- FAVOR: harp, lute, soft strings, flute, pan pipes, chimes, celeste, distant choir, finger-picked acoustic guitar, bowed glass, ambient pads
- SITUATIONAL: light hand drums for taverns/markets, low brass drones for underground/caves, wind sounds for high places
- AVOID: heavy percussion, electric guitar, synth bass, EDM elements, distorted sounds, aggressive rhythms

Style guidelines:
- Keep it ambient and atmospheric — this plays on loop while exploring
- Single section tracks work best for seamless looping
- Duration of 30-60 seconds is ideal for looping ambient tracks
- Instrumental only (empty lines array) unless there's a strong narrative reason for vocals

Output ONLY valid JSON matching this structure (no markdown, no commentary):
{
  "positiveGlobalStyles": ["style1", "style2", ...],
  "negativeGlobalStyles": ["style1", "style2", ...],
  "sections": [
    {
      "sectionName": "name",
      "positiveLocalStyles": ["style1", "style2", ...],
      "negativeLocalStyles": ["style1", "style2", ...],
      "duration": 45,
      "lines": []
    }
  ]
}`;

/**
 * Use Claude to generate a structured music config from zone context.
 */
export async function generateMusicConfig(
  apiKey: string,
  zoneName: string,
  vibe: string | null,
  roomDescriptions: string[]
): Promise<MusicConfig> {
  const roomContext =
    roomDescriptions.length > 0
      ? `\n\nRoom descriptions:\n${roomDescriptions.slice(0, 10).join("\n")}`
      : "";

  const userContent = `Zone: ${zoneName}
${vibe ? `Atmosphere: ${vibe}` : "No atmosphere summary available."}${roomContext}

Generate a music configuration for ambient background music for this zone.`;

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  // Strip markdown code fences if present
  let jsonText = block.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const config = JSON.parse(jsonText) as MusicConfig;

  // Validate basic structure
  if (
    !Array.isArray(config.positiveGlobalStyles) ||
    !Array.isArray(config.negativeGlobalStyles) ||
    !Array.isArray(config.sections) ||
    config.sections.length === 0
  ) {
    throw new Error("Invalid music config structure from Claude");
  }

  return config;
}
