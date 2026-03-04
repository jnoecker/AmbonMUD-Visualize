import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  copyFile,
} from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import type { ProjectFile, ZoneData } from "../types/project";
import { getImagePath } from "./project-io";

export interface ExportProgress {
  total: number;
  completed: number;
  currentFile: string | null;
}

export async function exportProject(
  projectDir: string,
  project: ProjectFile,
  exportDir: string,
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  // Create export directories
  const yamlDir = await join(exportDir, "yaml");
  const imagesDir = await join(exportDir, "images");
  await mkdir(yamlDir, { recursive: true });
  await mkdir(imagesDir, { recursive: true });

  // Count total work
  let totalFiles = 0;
  for (const zone of Object.values(project.zones)) {
    totalFiles++; // YAML file
    for (const asset of Object.values(zone.assets)) {
      if (asset.approvedVariantIndex !== null) {
        totalFiles++; // Image file
      }
    }
  }

  const progress: ExportProgress = {
    total: totalFiles,
    completed: 0,
    currentFile: null,
  };

  for (const zone of Object.values(project.zones)) {
    // Export modified YAML
    progress.currentFile = `${zone.zoneName}.yaml`;
    onProgress?.(progress);

    await exportZoneYaml(projectDir, zone, yamlDir);
    progress.completed++;

    // Export approved images
    const zoneImgDir = await join(imagesDir, zone.zoneName);

    for (const asset of Object.values(zone.assets)) {
      if (asset.approvedVariantIndex === null) continue;

      const variant = asset.variants[asset.approvedVariantIndex];
      if (!variant) continue;

      // Organize by type
      const typeDir = await join(zoneImgDir, `${asset.entityType}s`);
      await mkdir(typeDir, { recursive: true });

      const safeId = asset.entityId.replace(/:/g, "_");
      const srcPath = await getImagePath(
        projectDir,
        zone.zoneName,
        asset.entityId,
        variant.filename
      );
      const destPath = await join(typeDir, `${safeId}.png`);

      progress.currentFile = `${safeId}.png`;
      onProgress?.(progress);

      const srcExists = await exists(srcPath);
      if (srcExists) {
        await copyFile(srcPath, destPath);
      }

      progress.completed++;
    }
  }

  progress.currentFile = null;
  onProgress?.(progress);
}

async function exportZoneYaml(
  _projectDir: string,
  zone: ZoneData,
  yamlDir: string
): Promise<void> {
  // Read original YAML
  let yaml: string;
  try {
    yaml = await readTextFile(zone.sourceYamlPath);
  } catch {
    // If original file can't be read, skip
    return;
  }

  // String-based insertion of image fields and prompt comments
  const lines = yaml.split("\n");
  const output: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    output.push(lines[i]);

    // Check if this line is an entity ID key (rooms, mobs, items)
    // Pattern: "  entityId:" at proper indentation
    for (const asset of Object.values(zone.assets)) {
      if (asset.approvedVariantIndex === null) continue;

      const variant = asset.variants[asset.approvedVariantIndex];
      if (!variant) continue;

      // Extract bare ID (after the colon in zone:id)
      const bareId = asset.entityId.includes(":")
        ? asset.entityId.split(":").pop()!
        : asset.entityId;

      // Match "  bareId:" pattern
      const trimmed = lines[i].trimEnd();
      if (trimmed === `  ${bareId}:`) {
        const safeId = asset.entityId.replace(/:/g, "_");
        const imgPath = `${asset.entityType}s/${safeId}.png`;
        output.push(`    # Image prompt: ${variant.prompt.split("\n")[0].substring(0, 80)}...`);
        output.push(`    image: ${imgPath}`);
      }
    }
  }

  const destPath = await join(yamlDir, `${zone.zoneName}.yaml`);
  await writeTextFile(destPath, output.join("\n"));
}
