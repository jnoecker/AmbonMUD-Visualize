import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  copyFile,
} from "@tauri-apps/plugin-fs";
import { join, dirname } from "@tauri-apps/api/path";
import YAML from "yaml";
import type { ProjectFile, ZoneData, DefaultImageEntityType } from "../types/project";
import { getImagePath } from "./project-io";

export interface ExportProgress {
  total: number;
  completed: number;
  currentFile: string | null;
}

/**
 * Export approved images and updated YAML.
 *
 * @param exportDir  Target directory for the exported YAML and images.
 *                   When omitted, falls back to the directory containing
 *                   each zone's source YAML (legacy in-place behaviour).
 *
 * Layout inside exportDir:
 *   {zone}.yaml
 *   images/{zone}/{bareId}.png
 */
export async function exportProject(
  projectDir: string,
  project: ProjectFile,
  onProgress?: (progress: ExportProgress) => void,
  exportDir?: string
): Promise<void> {
  // Count total work
  let totalFiles = 0;
  const defaultTypes: DefaultImageEntityType[] = ["room", "mob", "item"];
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
    // Determine output directory: explicit exportDir or fall back to source YAML location
    const worldDir = exportDir ?? await dirname(zone.sourceYamlPath);
    const imagesBaseDir = await join(worldDir, "images");

    // Create zone images directory: {worldDir}/images/{zoneName}/
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

    // Write YAML with image fields and entity edits (skip for ability zones)
    if (!zone.abilityConfig) {
      progress.currentFile = `${zone.zoneName}.yaml`;
      onProgress?.({ ...progress });

      await exportZoneYaml(projectDir, zone, exportDir);
      progress.completed++;
    }
  }

  progress.currentFile = null;
  onProgress?.({ ...progress });
}

/** Entity sections in zone YAML that contain editable entities. */
const ENTITY_SECTIONS = ["rooms", "mobs", "items"] as const;

async function exportZoneYaml(
  _projectDir: string,
  zone: ZoneData,
  exportDir?: string
): Promise<void> {
  let yamlText: string;
  try {
    yamlText = await readTextFile(zone.sourceYamlPath);
  } catch {
    return;
  }

  // Parse as a Document to preserve comments and formatting
  const doc = YAML.parseDocument(yamlText);

  // --- Apply entity edits ---
  if (zone.entityEdits) {
    for (const [entityId, edits] of Object.entries(zone.entityEdits)) {
      if (!edits || Object.keys(edits).length === 0) continue;

      const bareId = entityId.includes(":")
        ? entityId.split(":").pop()!
        : entityId;

      // Find which section this entity belongs to
      for (const section of ENTITY_SECTIONS) {
        const sectionNode = doc.get(section, true) as YAML.YAMLMap | undefined;
        if (!sectionNode || !YAML.isMap(sectionNode)) continue;

        const entityNode = sectionNode.get(bareId, true) as YAML.YAMLMap | undefined;
        if (!entityNode || !YAML.isMap(entityNode)) continue;

        // Merge each edited field into the entity node
        for (const [field, value] of Object.entries(edits)) {
          if (value === undefined) {
            entityNode.delete(field);
          } else {
            entityNode.set(field, value);
          }
        }
        break;
      }
    }
  }

  // --- Insert image fields for approved assets ---
  const imageMap = new Map<string, string>();
  for (const asset of Object.values(zone.assets)) {
    if (asset.approvedVariantIndex === null) continue;
    const variant = asset.variants[asset.approvedVariantIndex];
    if (!variant) continue;

    const bareId = asset.entityId.includes(":")
      ? asset.entityId.split(":").pop()!
      : asset.entityId;

    imageMap.set(bareId, `${zone.zoneName}/${bareId}.png`);
  }

  // Set image fields on individual entities
  for (const section of ENTITY_SECTIONS) {
    const sectionNode = doc.get(section, true) as YAML.YAMLMap | undefined;
    if (!sectionNode || !YAML.isMap(sectionNode)) continue;

    for (const item of sectionNode.items) {
      const key = YAML.isScalar(item.key) ? String(item.key.value) : null;
      if (!key) continue;

      const imgPath = imageMap.get(key);
      if (!imgPath) continue;

      const entityNode = item.value;
      if (!YAML.isMap(entityNode)) continue;

      // Set image as first field (delete existing, then re-add at position 0)
      entityNode.delete("image");
      const imgPair = new YAML.Pair(new YAML.Scalar("image"), new YAML.Scalar(imgPath));
      entityNode.items.unshift(imgPair as any);
    }
  }

  // Set zone-level default image block
  if (zone.defaultImages) {
    const defaultTypes: DefaultImageEntityType[] = ["room", "mob", "item"];
    const entries: Record<string, string> = {};
    for (const t of defaultTypes) {
      if (zone.defaultImages[t]?.filename) {
        entries[t] = `${zone.zoneName}/default_${t}.png`;
      }
    }

    if (Object.keys(entries).length > 0) {
      doc.set("image", entries);
    }
  }

  // Write YAML — to exportDir if specified, otherwise back to source
  const output = doc.toString({ lineWidth: 0 });
  if (exportDir) {
    // Derive filename from zone name
    const destPath = await join(exportDir, `${zone.zoneName}.yaml`);
    await writeTextFile(destPath, output);
  } else {
    await writeTextFile(zone.sourceYamlPath, output);
  }
}
