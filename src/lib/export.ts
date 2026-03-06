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
import { getDefinitionPaths } from "./ability-parser";

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

      // For ability zones, export into section subdirectories (abilities/, statusEffects/)
      let destPath: string;
      if (zone.abilityConfig && asset.entityId.includes(":")) {
        const section = asset.entityId.split(":")[0]; // "abilities" or "statusEffects"
        const sectionDir = await join(imagesBaseDir, section);
        await mkdir(sectionDir, { recursive: true });
        destPath = await join(sectionDir, `${bareId}.png`);
      } else {
        destPath = await join(zoneImgDir, `${bareId}.png`);
      }

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

    // Write YAML with image fields and entity edits
    progress.currentFile = zone.abilityConfig
      ? zone.sourceYamlPath.split(/[/\\]/).pop() ?? "application.yaml"
      : `${zone.zoneName}.yaml`;
    onProgress?.({ ...progress });

    if (zone.abilityConfig) {
      await exportAbilityYaml(zone, exportDir);
    } else {
      await exportZoneYaml(projectDir, zone, exportDir);
    }
    progress.completed++;
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

/**
 * Export ability/status-effect zone: read the source YAML (typically application.yaml),
 * insert `image:` fields into ability and status-effect definitions for approved assets,
 * and write the full file back — everything else untouched.
 */
async function exportAbilityYaml(
  zone: ZoneData,
  exportDir?: string
): Promise<void> {
  let yamlText: string;
  try {
    yamlText = await readTextFile(zone.sourceYamlPath);
  } catch {
    return;
  }

  const doc = YAML.parseDocument(yamlText);
  const { abilitiesPath, statusEffectsPath } = getDefinitionPaths(yamlText);

  // Build image map: bareId -> image path
  const imageMap = new Map<string, string>();
  for (const asset of Object.values(zone.assets)) {
    if (asset.approvedVariantIndex === null) continue;
    imageMap.set(asset.entityId, `${zone.zoneName}/${asset.entityId.replace(/:/g, "_")}.png`);
  }

  // Insert image fields into ability definitions
  if (abilitiesPath.length > 0) {
    const defsNode = navigateToMap(doc, abilitiesPath);
    if (defsNode) {
      insertImageFields(defsNode, "abilities", imageMap);
    }
  }

  // Insert image fields into status effect definitions
  if (statusEffectsPath.length > 0) {
    const defsNode = navigateToMap(doc, statusEffectsPath);
    if (defsNode) {
      insertImageFields(defsNode, "statusEffects", imageMap);
    }
  }

  // Write back — to exportDir if specified, otherwise in-place to source
  const output = doc.toString({ lineWidth: 0 });
  if (exportDir) {
    const filename = zone.sourceYamlPath.split(/[/\\]/).pop() ?? "application.yaml";
    const destPath = await join(exportDir, filename);
    await writeTextFile(destPath, output);
  } else {
    await writeTextFile(zone.sourceYamlPath, output);
  }
}

/** Navigate a YAML document down a series of keys to reach a YAMLMap. */
function navigateToMap(
  doc: YAML.Document,
  path: string[]
): YAML.YAMLMap | null {
  let node: unknown = doc.contents;
  for (const key of path) {
    if (!YAML.isMap(node)) return null;
    node = (node as YAML.YAMLMap).get(key, true);
  }
  return YAML.isMap(node) ? (node as YAML.YAMLMap) : null;
}

/**
 * For each entry in a definitions YAMLMap, if the entity has an approved image,
 * set or update its `image:` field. The image path uses the MUD's conventional
 * `/images/{section}/{bareId}.png` format.
 */
function insertImageFields(
  defsMap: YAML.YAMLMap,
  section: string,
  imageMap: Map<string, string>
): void {
  for (const item of defsMap.items) {
    const key = YAML.isScalar(item.key) ? String(item.key.value) : null;
    if (!key) continue;

    // Entity IDs in the project are prefixed: "abilities:power_strike" or "statusEffects:ignite"
    const entityId = `${section}:${key}`;
    if (!imageMap.has(entityId)) continue;

    const entityNode = item.value;
    if (!YAML.isMap(entityNode)) continue;

    // Use the MUD's standard image path format
    const imgPath = `/images/${section}/${key}.png`;

    // Delete existing image field and re-insert after displayName
    entityNode.delete("image");
    const imgPair = new YAML.Pair(new YAML.Scalar("image"), new YAML.Scalar(imgPath));

    // Insert after displayName if present, otherwise at position 0
    const displayNameIdx = entityNode.items.findIndex(
      (p: any) => YAML.isScalar(p.key) && p.key.value === "displayName"
    );
    if (displayNameIdx >= 0) {
      entityNode.items.splice(displayNameIdx + 1, 0, imgPair as any);
    } else {
      entityNode.items.unshift(imgPair as any);
    }
  }
}
