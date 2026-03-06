import { llmGenerate, type LlmCallOptions } from "./llm";
import type { VideoConfig, VideoAssetType } from "../types/video";

const ZONE_INTRO_SYSTEM_PROMPT = `You are a cinematic director for a fantasy RPG that uses the "Surreal Gentle Magic" aesthetic. Given a zone name, its atmosphere, and a list of all rooms in the zone, produce a concise motion/animation prompt for an AI video generator to create a sweeping zone flyover cinematic.

This is a 6-10 second aerial/panoramic flyover that introduces the ENTIRE zone — not a single room. The source frame (if provided) is a starting point, but the motion prompt should evoke a journey across the whole zone landscape.

Guidelines:
- Describe a sweeping CAMERA JOURNEY that conveys the breadth and variety of the zone
- Reference key landmarks and transitions between areas (e.g., "gliding from the harbor docks over rooftops to the cathedral spire")
- Favor slow, dreamy camera movements: aerial drift, sweeping crane, gentle flyover
- Add subtle environmental motion: drifting motes of light, swaying foliage, rippling water, floating particles
- Keep motion gentle and atmospheric — no fast cuts, no jarring transitions
- The mood should be inviting, mysterious, and magical
- Convey the zone's overall character and geography, not just one location
- Include 2-3 specific motion elements layered at different depths

Example motions: aerial drift from misty forest edge across canopy to a glowing clearing, sweeping crane over village rooftops revealing a distant castle, slow glide along a river from cavern mouth to open valley

Output ONLY the motion prompt text — no labels, no markdown, no commentary. Keep it under 120 words.`;

const ROOM_CINEMATIC_SYSTEM_PROMPT = `You are a cinematic director for a fantasy RPG that uses the "Surreal Gentle Magic" aesthetic. Given a room description, produce a concise motion/animation prompt for an AI video generator to create a short room cinematic.

This is a 6-10 second establishing shot that plays when a player enters a specific room. The source frame is the room's existing painted background in the Surreal Gentle Magic style.

Guidelines:
- Describe MOTION and CAMERA MOVEMENT within this specific room, not the broader zone
- Favor slow, dreamy camera movements: gentle pan, slow dolly, subtle zoom
- Add subtle environmental motion: drifting motes of light, swaying foliage, rippling water, floating particles
- Keep motion gentle and atmospheric — no fast cuts, no jarring transitions
- The mood should match the room's specific character and atmosphere
- Include 2-3 specific motion elements layered at different depths

Example motions: slow forward dolly through archway, gentle lateral pan revealing interior details, subtle upward tilt from ground-level glow to ceiling, ambient particles drifting across frame

Output ONLY the motion prompt text — no labels, no markdown, no commentary. Keep it under 100 words.`;

const BOSS_REVEAL_SYSTEM_PROMPT = `You are a cinematic director for a fantasy RPG that uses the "Surreal Gentle Magic" aesthetic. Given a boss mob description, produce a concise motion/animation prompt for an AI video generator to create a dramatic boss reveal clip.

This is a 6-second reveal animation when a player encounters a boss mob. The source frame is the boss's existing character portrait in the Surreal Gentle Magic style.

Guidelines:
- Describe MOTION and EFFECTS, not the character itself (the character comes from the source image)
- Start subtle and build to a dramatic reveal: emerging from shadow, crystallizing from mist, materializing from magical energy
- Add atmospheric effects: swirling magical particles, pulsing aura, rippling energy waves
- Keep it dramatic but not aggressive — powerful yet ethereal
- Motion should feel intentional and weighted, not frantic
- The boss should feel ancient, powerful, and otherworldly

Example effects: slow materialization from swirling mist, eyes glowing then full form emerging, magical aura building and pulsing outward, shadow lifting to reveal figure

Output ONLY the motion prompt text — no labels, no markdown, no commentary. Keep it under 100 words.`;

const ITEM_REVEAL_SYSTEM_PROMPT = `You are a cinematic director for a fantasy RPG that uses the "Surreal Gentle Magic" aesthetic. Given an item description, produce a concise motion/animation prompt for an AI video generator to create an epic item reveal clip.

This is a 6-second reveal animation when a player obtains a rare or epic item. The source frame is the item's existing icon in the Surreal Gentle Magic style.

Guidelines:
- Describe MOTION and EFFECTS, not the item itself (the item comes from the source image)
- Create a sense of wonder and reward: item appearing from golden light, rotating slowly with sparkle effects, magical runes orbiting
- Add atmospheric effects: radiating glow, floating particles converging, prismatic light refractions
- Keep it celebratory but elegant — this is a reward moment
- Motion should feel magical and satisfying
- The item should feel precious and powerful

Example effects: slow rotation with golden sparkle trail, pulsing glow building to radiant burst, magical runes spiraling inward then item gleams, light converging to form the item from pure energy

Output ONLY the motion prompt text — no labels, no markdown, no commentary. Keep it under 100 words.`;

const SYSTEM_PROMPTS: Record<VideoAssetType, string> = {
  zone_intro: ZONE_INTRO_SYSTEM_PROMPT,
  room_cinematic: ROOM_CINEMATIC_SYSTEM_PROMPT,
  boss_reveal: BOSS_REVEAL_SYSTEM_PROMPT,
  item_reveal: ITEM_REVEAL_SYSTEM_PROMPT,
};

export interface RoomSummary {
  title: string;
  description: string;
}

/**
 * Use LLM to generate a video motion prompt from entity context.
 * For zone_intro, pass allRooms to generate a zone-wide flyover prompt.
 */
export async function generateVideoConfig(
  llmOpts: LlmCallOptions,
  videoType: VideoAssetType,
  entityTitle: string,
  entityDescription: string,
  zoneVibe: string | null,
  allRooms?: RoomSummary[]
): Promise<VideoConfig> {
  const typeLabels: Record<VideoAssetType, string> = {
    zone_intro: "zone flyover cinematic",
    room_cinematic: "room cinematic",
    boss_reveal: "boss reveal clip",
    item_reveal: "epic item reveal clip",
  };

  let userContent: string;

  if (videoType === "zone_intro" && allRooms && allRooms.length > 0) {
    const roomList = allRooms
      .map((r) => `- ${r.title}${r.description ? `: ${r.description}` : ""}`)
      .join("\n");
    userContent = `Zone: ${entityTitle}
${zoneVibe ? `Zone atmosphere: ${zoneVibe}` : ""}

Rooms in this zone:
${roomList}

Generate a ${typeLabels[videoType]} motion prompt that sweeps across the whole zone.`;
  } else {
    userContent = `Entity: ${entityTitle}
${entityDescription ? `Description: ${entityDescription}` : ""}
${zoneVibe ? `Zone atmosphere: ${zoneVibe}` : ""}

Generate a ${typeLabels[videoType]} motion prompt.`;
  }

  const text = await llmGenerate(llmOpts, SYSTEM_PROMPTS[videoType], userContent, 250);

  return {
    prompt: text.trim(),
    duration: 6,
    sourceEntityId: null,
  };
}
