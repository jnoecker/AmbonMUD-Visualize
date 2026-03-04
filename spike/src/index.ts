import { resolve, join, basename } from "path";
import { existsSync, readdirSync } from "fs";
import { parseZone } from "./yaml-parser";
import { generateZoneVibe, generateEntityPrompt } from "./prompt-gen";
import { DallE3Generator } from "./generators/dalle3";
import { GptImageGenerator } from "./generators/gpt-image";
import type { ImageGenerator, GenerateOptions, EntityType } from "./generators/types";
import { saveImage, saveText, delay } from "./utils";

// ── Test subjects ──────────────────────────────────────────────────────────────

interface ZoneConfig {
  yamlFile: string;
  entities: Record<EntityType, string[]>;
}

const ZONES: Record<string, ZoneConfig> = {
  pbrae: {
    yamlFile: "reference/pbrae.yaml",
    entities: {
      room: ["mountain_summit", "kitchen_main", "braelynn_penguin_palace"],
      mob: ["forest_deer", "royal_rooster", "stuffie_guardian"],
      item: ["royal_egg", "minecraft_diamond", "royal_goblet"],
    },
  },
  wesleyalis: {
    yamlFile: "reference/wesleyalis.yaml",
    entities: {
      room: ["prehistoric_apiary", "king_wesleys_throne", "stuffie_wonderland"],
      mob: ["queen_bee", "godzilla", "stuffed_dragon_guardian"],
      item: ["bee_stinger_sword", "wesleys_art_brush", "glitter_crown"],
    },
  },
  trailey: {
    yamlFile: "reference/trailey.yaml",
    entities: {
      room: ["cul_de_sac", "haileys_gym", "humpty_arena"],
      mob: ["humpty_dumpty", "balance_beam_automaton", "inflate_goon"],
      item: ["spy_watch", "competition_leotard", "paintball_marker"],
    },
  },
};

// ── Main pipeline ──────────────────────────────────────────────────────────────

async function main() {
  const projectRoot = resolve(import.meta.dir, "../..");
  const outputRoot = resolve(import.meta.dir, "../output");

  // Validate env
  const missing: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(", ")}`);
    console.error("Copy .env.example to .env and fill in your API keys.");
    process.exit(1);
  }

  // Initialize generators
  const generators: ImageGenerator[] = [
    new DallE3Generator(),
    new GptImageGenerator(),
  ];

  console.log("=== AmbonMUD Visualize — Image Generation Spike ===\n");

  const comparisonEntries: string[] = [];
  let totalEntities = 0;
  let completed = 0;

  // Count total
  for (const config of Object.values(ZONES)) {
    for (const ids of Object.values(config.entities)) {
      totalEntities += ids.length;
    }
  }

  for (const [zoneName, config] of Object.entries(ZONES)) {
    const yamlPath = resolve(projectRoot, config.yamlFile);
    const allEntityIds = [
      ...config.entities.room,
      ...config.entities.mob,
      ...config.entities.item,
    ];

    console.log(`\n── Zone: ${zoneName} ──────────────────────────────`);

    // Parse zone
    const parsed = parseZone(yamlPath, allEntityIds);
    console.log(
      `  Parsed ${parsed.entities.length} entities, ${parsed.allRoomDescriptions.length} rooms total`
    );

    // Generate zone vibe
    console.log("  Generating zone vibe...");
    const vibe = await generateZoneVibe(
      parsed.zoneName,
      parsed.allRoomDescriptions
    );
    const vibeDest = saveText(vibe, join(outputRoot, zoneName, "vibe.txt"));
    console.log(`  Zone vibe saved: ${vibeDest}`);
    console.log(`  Vibe: "${vibe.substring(0, 120)}..."\n`);

    comparisonEntries.push(`## Zone: ${zoneName}\n`);
    comparisonEntries.push(`### Zone Vibe\n\n${vibe}\n`);

    await delay(1000);

    // Process each entity
    for (const entity of parsed.entities) {
      completed++;
      const typeDir = `${entity.type}s`;
      const entityDir = join(outputRoot, zoneName, typeDir, entity.id);
      const progress = `[${completed}/${totalEntities}]`;

      console.log(
        `  ${progress} ${entity.type}: "${entity.title}" (${entity.id})`
      );

      // Generate prompt via Claude
      console.log(`    Generating prompt...`);
      const prompt = await generateEntityPrompt(entity, vibe);
      const promptDest = saveText(prompt, join(entityDir, "prompt.txt"));
      console.log(`    Prompt saved (${prompt.length} chars) → ${basename(promptDest)}`);

      await delay(500);

      // Determine aspect ratio
      const options: GenerateOptions = {
        aspectRatio: entity.type === "room" ? "16:9" : "1:1",
        entityType: entity.type,
      };

      // Run each generator
      for (const gen of generators) {
        const imagePath = join(entityDir, `${gen.name}.png`);
        console.log(`    Generating ${gen.name} image...`);
        try {
          const buffer = await gen.generate(prompt, options);
          const imgDest = saveImage(buffer, imagePath);
          console.log(
            `    ${gen.name} saved (${(buffer.length / 1024).toFixed(0)} KB) → ${basename(imgDest)}`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`    ${gen.name} FAILED: ${msg}`);
          saveText(`ERROR: ${msg}`, join(entityDir, `${gen.name}.error.txt`));
        }
        await delay(2000);
      }

      // Add to comparison — list all versions found for each generator
      const relDir = `${zoneName}/${typeDir}/${entity.id}`;
      comparisonEntries.push(
        `### ${entity.type}: ${entity.title} (\`${entity.id}\`)\n`
      );
      comparisonEntries.push(`**Prompt:**\n\n${prompt}\n`);

      // Find all version files for each generator
      if (existsSync(entityDir)) {
        const files = readdirSync(entityDir).sort();
        for (const gen of generators) {
          const genFiles = files.filter(
            (f) => f.startsWith(gen.name) && f.endsWith(".png")
          );
          if (genFiles.length > 0) {
            comparisonEntries.push(`**${gen.name} versions:**\n`);
            for (const f of genFiles) {
              comparisonEntries.push(`![${f}](${relDir}/${f})\n`);
            }
          }
        }
      }
      comparisonEntries.push("");
    }
  }

  // Write comparison.md
  const comparisonContent = [
    "# AmbonMUD Visualize — Image Generation Comparison\n",
    `Generated: ${new Date().toISOString()}\n`,
    `Total entities: ${totalEntities}\n`,
    "---\n",
    ...comparisonEntries,
  ].join("\n");

  const comparisonPath = join(outputRoot, "comparison.md");
  saveText(comparisonContent, comparisonPath);

  console.log(`\n=== Done! ===`);
  console.log(`Comparison report: ${comparisonPath}`);
  console.log(`Total entities processed: ${completed}/${totalEntities}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
