import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  copyFile,
} from "@tauri-apps/plugin-fs";
import { join, dirname } from "@tauri-apps/api/path";
import type { ProjectFile, ZoneData } from "../types/project";
import type { EntityType } from "../types/entities";
import { getImagePath } from "./project-io";

export interface ExportProgress {
  total: number;
  completed: number;
  currentFile: string | null;
}

/**
 * Export approved images and updated YAML directly into the AmbonMUD world directory.
 *
 * - Modifies each zone's source YAML in-place, inserting `image:` fields
 * - Copies approved PNGs to `images/{zone}/{bareId}.png` alongside the YAML files
 * - YAML `image:` values are relative paths like `wesleyalis/clearing.png`
 *   (the Ktor server prepends `/images/`)
 */
export async function exportProject(
  projectDir: string,
  project: ProjectFile,
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  // Count total work
  let totalFiles = 0;
  const defaultTypes: EntityType[] = ["room", "mob", "item"];
  for (const zone of Object.values(project.zones)) {
    totalFiles++; // YAML file
    for (const asset of Object.values(zone.assets)) {
      if (asset.approvedVariantIndex !== null) {
        totalFiles++; // Image file
      }
    }
    // Count default images
    if (zone.defaultImages) {
      for (const t of defaultTypes) {
        if (zone.defaultImages[t]?.filename) totalFiles++;
      }
    }
  }

  const progress: ExportProgress = {
    total: totalFiles,
    completed: 0,
    currentFile: null,
  };

  for (const zone of Object.values(project.zones)) {
    // The world directory is where the source YAML lives
    const worldDir = await dirname(zone.sourceYamlPath);
    const imagesBaseDir = await join(worldDir, "images");

    // Create zone images directory: world/images/{zoneName}/
    const zoneImgDir = await join(imagesBaseDir, zone.zoneName);
    await mkdir(zoneImgDir, { recursive: true });

    // Copy approved images
    for (const asset of Object.values(zone.assets)) {
      if (asset.approvedVariantIndex === null) continue;

      const variant = asset.variants[asset.approvedVariantIndex];
      if (!variant) continue;

      // Use bare ID (strip zone prefix) for the filename
      const bareId = asset.entityId.includes(":")
        ? asset.entityId.split(":").pop()!
        : asset.entityId;

      const srcPath = await getImagePath(
        projectDir,
        zone.zoneName,
        asset.entityId,
        variant.filename
      );
      const destPath = await join(zoneImgDir, `${bareId}.png`);

      progress.currentFile = `${bareId}.png`;
      onProgress?.({ ...progress });

      const srcExists = await exists(srcPath);
      if (srcExists) {
        await copyFile(srcPath, destPath);
      }

      progress.completed++;
    }

    // Copy default images
    if (zone.defaultImages) {
      for (const entityType of defaultTypes) {
        const entry = zone.defaultImages[entityType];
        if (!entry?.filename) continue;

        const entityId = `default_${entityType}`;
        const srcPath = await getImagePath(projectDir, zone.zoneName, entityId, entry.filename);
        const destPath = await join(zoneImgDir, `default_${entityType}.png`);

        progress.currentFile = `default_${entityType}.png`;
        onProgress?.({ ...progress });

        const srcExists = await exists(srcPath);
        if (srcExists) {
          await copyFile(srcPath, destPath);
        }

        progress.completed++;
      }
    }

    // Modify YAML in-place with image fields
    progress.currentFile = `${zone.zoneName}.yaml`;
    onProgress?.({ ...progress });

    await exportZoneYaml(projectDir, zone);
    progress.completed++;
  }

  progress.currentFile = null;
  onProgress?.({ ...progress });
}

async function exportZoneYaml(
  _projectDir: string,
  zone: ZoneData
): Promise<void> {
  // Read original YAML
  let yaml: string;
  try {
    yaml = await readTextFile(zone.sourceYamlPath);
  } catch {
    return;
  }

  // Build a lookup: bareId -> relative image path
  const imageMap = new Map<string, string>();
  for (const asset of Object.values(zone.assets)) {
    if (asset.approvedVariantIndex === null) continue;
    const variant = asset.variants[asset.approvedVariantIndex];
    if (!variant) continue;

    const bareId = asset.entityId.includes(":")
      ? asset.entityId.split(":").pop()!
      : asset.entityId;

    // Relative path: {zone}/{bareId}.png
    // The server prepends /images/ to get the full URL
    imageMap.set(bareId, `${zone.zoneName}/${bareId}.png`);
  }

  // Build zone-level default image block
  const defaultImageLines: string[] = [];
  if (zone.defaultImages) {
    const defaultTypes: EntityType[] = ["room", "mob", "item"];
    const entries: string[] = [];
    for (const t of defaultTypes) {
      if (zone.defaultImages[t]?.filename) {
        entries.push(`  ${t}: ${zone.zoneName}/default_${t}.png`);
      }
    }
    if (entries.length > 0) {
      defaultImageLines.push("image:");
      defaultImageLines.push(...entries);
    }
  }

  if (imageMap.size === 0 && defaultImageLines.length === 0) return;

  // String-based insertion of image fields
  const lines = yaml.split("\n");
  const output: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    output.push(line);

    // Insert zone-level image block after the "zone:" line
    if (defaultImageLines.length > 0) {
      const zoneMatch = line.match(/^zone:\s/);
      if (zoneMatch) {
        // Check if an image: block already follows
        const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
        if (nextLine.trimStart().startsWith("image:")) {
          // Skip existing zone-level image block (image: + indented entries)
          i++; // skip "image:"
          while (i + 1 < lines.length && /^  \w+:/.test(lines[i + 1])) {
            i++;
          }
        }
        // Insert new zone-level image block
        output.push(...defaultImageLines);
        continue;
      }
    }

    // Match entity ID keys at 2-space indent: "  bareId:"
    const trimmed = line.trimEnd();
    const match = trimmed.match(/^  (\w+):$/);
    if (!match) continue;

    const bareId = match[1];
    const imgPath = imageMap.get(bareId);
    if (!imgPath) continue;

    // Check if next line already has an image field (avoid duplicates on re-export)
    const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
    if (nextLine.trimStart().startsWith("image:")) {
      // Replace existing image line
      lines[i + 1] = `    image: ${imgPath}`;
    } else {
      // Insert image field as first property under the entity
      output.push(`    image: ${imgPath}`);
    }
  }

  // Write modified YAML back to the source file
  await writeTextFile(zone.sourceYamlPath, output.join("\n"));
}
