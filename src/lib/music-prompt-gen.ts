import Anthropic from "@anthropic-ai/sdk";
import type { MusicConfig } from "../types/music";

const SYSTEM_PROMPT = `You are a music director for a fantasy RPG that uses the "Surreal Gentle Magic" aesthetic. Given a zone description and its atmosphere, produce a concise text prompt for an AI music generator.

The music should feel: gentle, atmospheric, dreamlike, enchanted but safe, slow and breathable. It should evoke the specific mood and environment of the zone.

Instrument guidelines:
- FAVOR: harp, lute, soft strings, flute, pan pipes, chimes, celeste, distant choir, finger-picked acoustic guitar, bowed glass, ambient pads
- SITUATIONAL: light hand drums for taverns/markets, low brass drones for underground/caves, wind sounds for high places
- AVOID: heavy percussion, electric guitar, synth bass, EDM elements, distorted sounds, aggressive rhythms

Style guidelines:
- Keep it ambient and atmospheric — this plays on loop while exploring
- Instrumental only
- Describe the mood, instruments, tempo, and texture concisely
- Include genre tags and musical qualities

Output ONLY the prompt text — no labels, no markdown, no commentary. Keep it under 200 words.`;

/**
 * Use Claude to generate a music prompt from zone context.
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

Generate an ambient music prompt for this zone.`;

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  return {
    prompt: block.text.trim(),
    duration: 45,
  };
}
