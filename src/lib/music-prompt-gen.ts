import Anthropic from "@anthropic-ai/sdk";
import type { MusicConfig, AudioTrackType } from "../types/music";

const MUSIC_SYSTEM_PROMPT = `You are a music director for a fantasy RPG that uses the "Surreal Gentle Magic" aesthetic. Given a zone description and its atmosphere, produce a concise text prompt for an AI music generator.

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

const AMBIENT_SYSTEM_PROMPT = `You are a sound designer for a fantasy RPG that uses the "Surreal Gentle Magic" aesthetic. Given a zone description, produce a concise text prompt for an AI audio generator to create ambient environmental sounds — NOT music.

This is a soundscape/sound effects layer that plays underneath (or instead of) music. Think of it as what you'd actually HEAR standing in this place.

Examples of ambient sounds:
- Forest: birdsong, rustling leaves, distant stream, occasional twig snap, wind through branches
- Town: crowd murmur, distant hammer on anvil, cart wheels on cobblestone, shop bells, children playing
- Cave: dripping water, echoing footsteps, distant rumbling, wind moaning through tunnels
- Coast: waves lapping, seagulls, wind, creaking dock wood, distant ship bells
- Tavern: fire crackling, murmured conversation, clinking glasses, chair scraping, laughter

Guidelines:
- Describe environmental sounds, NOT musical instruments or melodies
- Layer 3-5 distinct sound elements at different distances (close, mid, far)
- Include both continuous textures (wind, water) and occasional punctuation sounds (bird call, door creak)
- Keep it gentle and non-startling — no sudden loud sounds
- The soundscape should loop seamlessly

Output ONLY the prompt text — no labels, no markdown, no commentary. Keep it under 150 words.`;

/**
 * Use Claude to generate a music or ambient sound prompt from zone context.
 */
export async function generateMusicConfig(
  apiKey: string,
  zoneName: string,
  vibe: string | null,
  roomDescriptions: string[],
  trackType: AudioTrackType = "music"
): Promise<MusicConfig> {
  const roomContext =
    roomDescriptions.length > 0
      ? `\n\nRoom descriptions:\n${roomDescriptions.slice(0, 10).join("\n")}`
      : "";

  const typeLabel = trackType === "music" ? "background music" : "ambient environmental soundscape";

  const userContent = `Zone: ${zoneName}
${vibe ? `Atmosphere: ${vibe}` : "No atmosphere summary available."}${roomContext}

Generate a ${typeLabel} prompt for this zone.`;

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 300,
    system: trackType === "music" ? MUSIC_SYSTEM_PROMPT : AMBIENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  return {
    prompt: block.text.trim(),
    duration: trackType === "music" ? 45 : 30,
  };
}
