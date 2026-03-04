/**
 * Runware.AI Spike — test image quality with FLUX models
 *
 * Usage:
 *   RUNWARE_API_KEY=your-key bun run spikes/runware/test-runware.ts
 *
 * Tests FLUX Schnell ($0.0006/img) and FLUX Dev ($0.0038/img) against
 * our Surreal Gentle Magic style prompts for rooms, mobs, and items.
 * Outputs images to spikes/runware/output/ for visual comparison.
 */

import { Runware } from "@runware/sdk-js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const API_KEY = process.env.RUNWARE_API_KEY;
if (!API_KEY) {
  console.error("Set RUNWARE_API_KEY environment variable");
  process.exit(1);
}

const STYLE_SUFFIX = `Rendered in the Surreal Gentle Magic style (surreal_softmagic_v1), featuring:
- Soft lavender and pale blue undertones
- Ambient diffused lighting (no harsh shadows, no spotlighting)
- Gentle atmospheric haze with floating motes of light
- Subtle magical glow integrated naturally into the environment
- Slightly elongated organic forms (trees, towers, figures)
- NO neon colors, NO high contrast, NO harsh edges
- Dreamy, breathable, emotionally safe aesthetic`;

// Sample prompts simulating what our pipeline produces
const TEST_PROMPTS = [
  {
    name: "room-treehouse",
    width: 1024,
    height: 576,   // ~16:9
    prompt: `16:9 landscape background illustration, wide establishing shot, no characters in foreground. A vast treehouse village connected by rope bridges and spiraling wooden staircases, nestled among ancient banyan trees with bioluminescent moss draping from the branches. Warm amber lanterns hang from woven baskets, casting gentle pools of light through the canopy. A misty jungle floor is barely visible far below. ${STYLE_SUFFIX}`,
  },
  {
    name: "mob-dinosaur-knight",
    width: 512,
    height: 512,
    prompt: `1:1 square character portrait centered in frame, full body visible, solid pale lavender (#d8d0e8) background. A velociraptor wearing ornate bronze armor with leaf-shaped pauldrons and a flowing teal cape. It stands upright with a ceremonial spear, intelligent eyes glowing with faint amber light. Slightly elongated proportions, regal bearing. ${STYLE_SUFFIX}`,
  },
  {
    name: "item-crystal-lantern",
    width: 512,
    height: 512,
    prompt: `1:1 square item icon centered in frame, floating on solid pale lavender (#d8d0e8) background, no hands or characters. An ornate crystal lantern with a brass frame shaped like intertwining vines. Inside, a soft blue-green flame hovers, casting gentle rays through the faceted crystal. Small motes of light drift around it. ${STYLE_SUFFIX}`,
  },
];

const MODELS = [
  { id: "runware:100@1", name: "flux-schnell", cost: "$0.0006" },
  { id: "runware:101@1", name: "flux-dev", cost: "$0.0038" },
];

const OUTPUT_DIR = join(import.meta.dirname, "output");

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log("Connecting to Runware...");
  const runware = new Runware({ apiKey: API_KEY! });
  await runware.connect();
  console.log("Connected!\n");

  for (const model of MODELS) {
    console.log(`\n=== Model: ${model.name} (${model.id}) — ${model.cost}/image ===\n`);

    for (const test of TEST_PROMPTS) {
      const label = `${model.name}/${test.name}`;
      console.log(`  Generating ${label} (${test.width}x${test.height})...`);
      const start = Date.now();

      try {
        const images = await runware.requestImages({
          positivePrompt: test.prompt,
          model: model.id,
          width: test.width,
          height: test.height,
          numberResults: 1,
          outputType: "base64Data",
          outputFormat: "PNG",
        });

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const image = images[0] as any;

        if (image?.imageBase64Data) {
          const filename = `${model.name}_${test.name}.png`;
          const filepath = join(OUTPUT_DIR, filename);
          const buffer = Buffer.from(image.imageBase64Data, "base64");
          await writeFile(filepath, buffer);
          console.log(`  ✓ ${label} — ${elapsed}s — ${(buffer.length / 1024).toFixed(0)}KB — saved ${filename}`);
        } else if (image?.imageURL) {
          // Fallback: download from URL
          const filename = `${model.name}_${test.name}.png`;
          const filepath = join(OUTPUT_DIR, filename);
          const resp = await fetch(image.imageURL);
          const buffer = Buffer.from(await resp.arrayBuffer());
          await writeFile(filepath, buffer);
          console.log(`  ✓ ${label} — ${elapsed}s — ${(buffer.length / 1024).toFixed(0)}KB — saved ${filename} (from URL)`);
        } else {
          console.log(`  ✗ ${label} — ${elapsed}s — unexpected response:`, JSON.stringify(image).slice(0, 200));
        }
      } catch (err: any) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.error(`  ✗ ${label} — ${elapsed}s — ERROR: ${err.message}`);
      }
    }
  }

  console.log(`\nDone! Check output at: ${OUTPUT_DIR}`);
  process.exit(0);
}

main();
