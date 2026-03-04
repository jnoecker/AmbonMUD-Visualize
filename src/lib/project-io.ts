import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  readDir,
  readFile,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import type { ProjectFile, AssetEntry } from "../types/project";
import type { Entity } from "../types/entities";
import { parseZone } from "./yaml-parser";

const PROJECT_FILE = "project.json";

export async function createProject(
  projectDir: string,
  projectName: string,
  yamlPaths: string[]
): Promise<ProjectFile> {
  // Create project directory
  const dirExists = await exists(projectDir);
  if (!dirExists) {
    await mkdir(projectDir, { recursive: true });
  }

  const project: ProjectFile = {
    version: 1,
    name: projectName,
    createdAt: new Date().toISOString(),
    zones: {},
  };

  // Parse each YAML file and create zone data
  for (const yamlPath of yamlPaths) {
    const yamlContent = await readTextFile(yamlPath);
    const parsed = parseZone(yamlContent);

    const assets: Record<string, AssetEntry> = {};
    for (const entity of parsed.entities) {
      assets[entity.id] = {
        entityId: entity.id,
        entityType: entity.type,
        title: entity.title,
        status: "pending",
        currentPrompt: null,
        variants: [],
        approvedVariantIndex: null,
      };
    }

    // Create zone images directory
    const zoneImagesDir = await join(projectDir, "images", parsed.zoneName);
    await mkdir(zoneImagesDir, { recursive: true });

    project.zones[parsed.zoneName] = {
      zoneName: parsed.zoneName,
      sourceYamlPath: yamlPath,
      vibe: null,
      assets,
    };
  }

  // Save project file
  const projectPath = await join(projectDir, PROJECT_FILE);
  await writeTextFile(projectPath, JSON.stringify(project, null, 2));

  return project;
}

export async function openProject(projectDir: string): Promise<ProjectFile> {
  const projectPath = await join(projectDir, PROJECT_FILE);
  const content = await readTextFile(projectPath);
  return JSON.parse(content) as ProjectFile;
}

export async function saveProject(
  projectDir: string,
  project: ProjectFile
): Promise<void> {
  const projectPath = await join(projectDir, PROJECT_FILE);
  await writeTextFile(projectPath, JSON.stringify(project, null, 2));
}

export async function saveImage(
  projectDir: string,
  zoneName: string,
  entityId: string,
  imageData: Uint8Array
): Promise<string> {
  // Sanitize entity ID for filesystem (replace : with _)
  const safeId = entityId.replace(/:/g, "_");
  const entityDir = await join(projectDir, "images", zoneName, safeId);

  const dirExists = await exists(entityDir);
  if (!dirExists) {
    await mkdir(entityDir, { recursive: true });
  }

  // Find next version number
  let version = 1;
  try {
    const entries = await readDir(entityDir);
    const pngFiles = entries.filter(
      (e) => e.name && e.name.endsWith(".png")
    );
    for (const f of pngFiles) {
      const match = f.name?.match(/^v(\d+)\.png$/);
      if (match) {
        const v = parseInt(match[1], 10);
        if (v >= version) version = v + 1;
      }
    }
  } catch {
    // Directory might be empty, that's fine
  }

  const filename = `v${version}.png`;
  const filePath = await join(entityDir, filename);
  await writeFile(filePath, imageData);

  return filename;
}

export async function getImagePath(
  projectDir: string,
  zoneName: string,
  entityId: string,
  filename: string
): Promise<string> {
  const safeId = entityId.replace(/:/g, "_");
  return join(projectDir, "images", zoneName, safeId, filename);
}

/**
 * Scan the images directory and reconcile with the project file.
 * Finds images on disk that aren't tracked in project.json (e.g. due to
 * stale closure bugs during batch generation) and adds them as variants.
 */
export async function reconcileImages(
  projectDir: string,
  project: ProjectFile
): Promise<ProjectFile> {
  let changed = false;
  const updated = { ...project, zones: { ...project.zones } };

  for (const [zoneKey, zone] of Object.entries(updated.zones)) {
    const zoneImagesDir = await join(projectDir, "images", zoneKey);
    const zoneDirExists = await exists(zoneImagesDir);
    if (!zoneDirExists) continue;

    let entityDirs: { name: string | undefined; isDirectory: boolean }[];
    try {
      entityDirs = (await readDir(zoneImagesDir)) as { name: string | undefined; isDirectory: boolean }[];
    } catch {
      continue;
    }

    const updatedAssets = { ...zone.assets };

    for (const entry of entityDirs) {
      if (!entry.name || !entry.isDirectory) continue;
      const dirName = entry.name; // e.g. "wesleyalis_gravel_road_2"

      // Convert dir name back to entity ID (underscore -> colon for the zone prefix)
      // The dir name is entityId.replace(/:/g, "_"), so "wesleyalis_gravel_road_2"
      // came from "wesleyalis:gravel_road_2". We need to find the matching asset.
      let matchingEntityId: string | null = null;
      for (const entityId of Object.keys(updatedAssets)) {
        if (entityId.replace(/:/g, "_") === dirName) {
          matchingEntityId = entityId;
          break;
        }
      }
      if (!matchingEntityId) continue;

      // Read PNG files in this entity's image directory
      const entityImagesDir = await join(zoneImagesDir, dirName);
      let imageFiles: { name: string | undefined }[];
      try {
        imageFiles = (await readDir(entityImagesDir)) as { name: string | undefined }[];
      } catch {
        continue;
      }

      const pngFiles = imageFiles
        .filter((f) => f.name && /^v\d+\.png$/.test(f.name))
        .map((f) => f.name!)
        .sort((a, b) => {
          const va = parseInt(a.match(/^v(\d+)/)?.[1] ?? "0", 10);
          const vb = parseInt(b.match(/^v(\d+)/)?.[1] ?? "0", 10);
          return va - vb;
        });

      if (pngFiles.length === 0) continue;

      const asset = updatedAssets[matchingEntityId];
      const trackedFilenames = new Set(asset.variants.map((v) => v.filename));
      const missingFiles = pngFiles.filter((f) => !trackedFilenames.has(f));

      if (missingFiles.length > 0) {
        changed = true;
        const newVariants = missingFiles.map((filename) => ({
          filename,
          generatedAt: new Date().toISOString(),
          prompt: asset.currentPrompt || "",
        }));

        updatedAssets[matchingEntityId] = {
          ...asset,
          status: asset.status === "pending" ? "generated" : asset.status,
          variants: [...asset.variants, ...newVariants],
        };
      }
    }

    if (changed) {
      updated.zones[zoneKey] = { ...zone, assets: updatedAssets };
    }
  }

  if (changed) {
    await saveProject(projectDir, updated);
  }

  return updated;
}

export async function loadImageFile(path: string): Promise<Uint8Array> {
  return readFile(path);
}

export async function reparseZone(
  yamlPath: string
): Promise<{ zoneName: string; entities: Entity[] }> {
  const yamlContent = await readTextFile(yamlPath);
  const parsed = parseZone(yamlContent);
  return { zoneName: parsed.zoneName, entities: parsed.entities };
}
