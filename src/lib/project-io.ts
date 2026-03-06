import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  readDir,
  readFile,
  writeFile,
  rename,
} from "@tauri-apps/plugin-fs";
import { join, dirname } from "@tauri-apps/api/path";
import type { ProjectFile, AssetEntry, DefaultImageEntry, DefaultImageEntityType } from "../types/project";
import type { Entity } from "../types/entities";
import { parseZone } from "./yaml-parser";
import { detectAbilityYaml, parseAbilities } from "./ability-parser";

const PROJECT_FILE = "project.json";

/**
 * Try to import an existing image referenced by an entity's `image` field.
 * Resolves the path relative to the YAML source directory, trying several
 * common locations. Returns the saved variant filename if successful.
 */
async function tryImportEntityImage(
  projectDir: string,
  zoneName: string,
  entityId: string,
  imagePath: string,
  yamlDir: string
): Promise<string | null> {
  // Strip leading slash if present (e.g. "/images/abilities/foo.png" -> "images/abilities/foo.png")
  const cleanPath = imagePath.replace(/^\/+/, "");

  // Try multiple resolution strategies
  const candidates = [
    await join(yamlDir, cleanPath),
    await join(yamlDir, "images", cleanPath),
    await join(yamlDir, imagePath),
  ];

  for (const candidate of candidates) {
    try {
      if (await exists(candidate)) {
        const imageData = await readFile(candidate);
        const ext = candidate.endsWith(".jpg") || candidate.endsWith(".jpeg") ? "jpg" as const : "png" as const;
        const filename = await saveImage(projectDir, zoneName, entityId, imageData, ext);
        return filename;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

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

    // Check if this is an ability definitions file
    if (detectAbilityYaml(yamlContent)) {
      const { entities, config } = parseAbilities(yamlContent);
      const yamlDir = await dirname(yamlPath);

      const assets: Record<string, AssetEntry> = {};
      for (const entity of entities) {
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

      const zoneName = "abilities";
      const zoneImagesDir = await join(projectDir, "images", zoneName);
      await mkdir(zoneImagesDir, { recursive: true });

      // Auto-import existing images referenced in the YAML
      for (const entity of entities) {
        const raw = entity.rawYaml as Record<string, unknown>;
        const imagePath = raw.image as string | undefined;
        if (!imagePath) continue;

        const filename = await tryImportEntityImage(
          projectDir, zoneName, entity.id, imagePath, yamlDir
        );
        if (filename) {
          assets[entity.id] = {
            ...assets[entity.id],
            status: "approved",
            variants: [{ filename, generatedAt: new Date().toISOString(), prompt: "" }],
            approvedVariantIndex: 0,
          };
        }
      }

      project.zones[zoneName] = {
        zoneName,
        sourceYamlPath: yamlPath,
        vibe: null,
        defaultImages: null,
        assets,
        abilityConfig: config,
      };
      continue;
    }

    const parsed = parseZone(yamlContent);
    const yamlDir = await dirname(yamlPath);

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

    // Auto-import existing images referenced in the YAML
    for (const entity of parsed.entities) {
      const raw = entity.rawYaml as Record<string, unknown>;
      const imagePath = raw.image as string | undefined;
      if (!imagePath) continue;

      const filename = await tryImportEntityImage(
        projectDir, parsed.zoneName, entity.id, imagePath, yamlDir
      );
      if (filename) {
        assets[entity.id] = {
          ...assets[entity.id],
          status: "approved",
          variants: [{ filename, generatedAt: new Date().toISOString(), prompt: "" }],
          approvedVariantIndex: 0,
        };
      }
    }

    project.zones[parsed.zoneName] = {
      zoneName: parsed.zoneName,
      sourceYamlPath: yamlPath,
      vibe: null,
      defaultImages: null,
      assets,
    };
  }

  // Save project file
  const projectPath = await join(projectDir, PROJECT_FILE);
  await writeTextFile(projectPath, JSON.stringify(project, null, 2));

  return project;
}

export async function createBlankProject(
  projectDir: string,
  projectName: string
): Promise<ProjectFile> {
  const dirExists = await exists(projectDir);
  if (!dirExists) {
    await mkdir(projectDir, { recursive: true });
  }

  // Create a synthetic "assets" zone for custom assets
  const zoneImagesDir = await join(projectDir, "images", "assets");
  await mkdir(zoneImagesDir, { recursive: true });

  const project: ProjectFile = {
    version: 1,
    name: projectName,
    createdAt: new Date().toISOString(),
    zones: {
      assets: {
        zoneName: "assets",
        sourceYamlPath: "",
        vibe: null,
        defaultImages: null,
        assets: {},
      },
    },
  };

  const projectPath = await join(projectDir, PROJECT_FILE);
  await writeTextFile(projectPath, JSON.stringify(project, null, 2));

  return project;
}

export async function openProject(projectDir: string): Promise<ProjectFile> {
  const projectPath = await join(projectDir, PROJECT_FILE);
  const content = await readTextFile(projectPath);
  const project = JSON.parse(content) as ProjectFile;

  // Backfill defaultImages for older project files
  for (const zone of Object.values(project.zones)) {
    if (!("defaultImages" in zone)) {
      (zone as any).defaultImages = null;
    }
  }

  return project;
}

export async function saveProject(
  projectDir: string,
  project: ProjectFile
): Promise<void> {
  const projectPath = await join(projectDir, PROJECT_FILE);
  await writeTextFile(projectPath, JSON.stringify(project, null, 2));
}

// Matches variant image files: v1.png, v2.jpg, etc.
const VARIANT_FILE_RE = /^v(\d+)\.(png|jpg)$/;

export async function saveImage(
  projectDir: string,
  zoneName: string,
  entityId: string,
  imageData: Uint8Array,
  extension: "png" | "jpg" = "png"
): Promise<string> {
  // Sanitize entity ID for filesystem (replace : with _)
  const safeId = entityId.replace(/:/g, "_");
  const entityDir = await join(projectDir, "images", zoneName, safeId);

  const dirExists = await exists(entityDir);
  if (!dirExists) {
    await mkdir(entityDir, { recursive: true });
  }

  // Find next version number (across both .png and .jpg)
  let version = 1;
  try {
    const entries = await readDir(entityDir);
    for (const f of entries) {
      const match = f.name?.match(VARIANT_FILE_RE);
      if (match) {
        const v = parseInt(match[1], 10);
        if (v >= version) version = v + 1;
      }
    }
  } catch {
    // Directory might be empty, that's fine
  }

  const filename = `v${version}.${extension}`;
  const filePath = await join(entityDir, filename);
  await writeFile(filePath, imageData);

  return filename;
}

// Matches variant audio files: v1.mp3, v2.mp3, etc.
const AUDIO_VARIANT_RE = /^v(\d+)\.mp3$/;

export async function saveAudioFile(
  projectDir: string,
  zoneName: string,
  musicId: string,
  audioData: Uint8Array
): Promise<string> {
  const audioDir = await join(projectDir, "audio", zoneName, musicId);

  const dirExists = await exists(audioDir);
  if (!dirExists) {
    await mkdir(audioDir, { recursive: true });
  }

  let version = 1;
  try {
    const entries = await readDir(audioDir);
    for (const f of entries) {
      const match = f.name?.match(AUDIO_VARIANT_RE);
      if (match) {
        const v = parseInt(match[1], 10);
        if (v >= version) version = v + 1;
      }
    }
  } catch {
    // Directory might be empty
  }

  const filename = `v${version}.mp3`;
  const filePath = await join(audioDir, filename);
  await writeFile(filePath, audioData);

  return filename;
}

export async function getAudioPath(
  projectDir: string,
  zoneName: string,
  musicId: string,
  filename: string
): Promise<string> {
  return join(projectDir, "audio", zoneName, musicId, filename);
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
        .filter((f) => f.name && VARIANT_FILE_RE.test(f.name))
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

    // Reconcile default images (default_room, default_mob, default_item dirs)
    const DEFAULT_TYPES: DefaultImageEntityType[] = ["room", "mob", "item"];
    let updatedDefaults = zone.defaultImages;
    for (const entityType of DEFAULT_TYPES) {
      const dirName = `default_${entityType}`;
      const defaultDir = await join(zoneImagesDir, dirName);
      const defaultDirExists = await exists(defaultDir);
      if (!defaultDirExists) continue;

      let imageFiles: { name: string | undefined }[];
      try {
        imageFiles = (await readDir(defaultDir)) as { name: string | undefined }[];
      } catch {
        continue;
      }

      const pngFiles = imageFiles
        .filter((f) => f.name && VARIANT_FILE_RE.test(f.name))
        .sort((a, b) => {
          const va = parseInt(a.name!.match(/^v(\d+)/)?.[1] ?? "0", 10);
          const vb = parseInt(b.name!.match(/^v(\d+)/)?.[1] ?? "0", 10);
          return va - vb;
        });

      if (pngFiles.length === 0) continue;

      // Use the latest file as the default image
      const latestFile = pngFiles[pngFiles.length - 1].name!;
      const currentEntry = updatedDefaults?.[entityType];

      if (!currentEntry || currentEntry.filename !== latestFile) {
        changed = true;
        if (!updatedDefaults) {
          const emptyEntry: DefaultImageEntry = { prompt: null, filename: null, generatedAt: null };
          updatedDefaults = { room: { ...emptyEntry }, mob: { ...emptyEntry }, item: { ...emptyEntry } };
        }
        updatedDefaults = {
          ...updatedDefaults,
          [entityType]: {
            ...updatedDefaults[entityType],
            filename: latestFile,
            generatedAt: updatedDefaults[entityType].generatedAt || new Date().toISOString(),
          },
        };
      }
    }

    if (changed) {
      updated.zones[zoneKey] = { ...zone, assets: updatedAssets, defaultImages: updatedDefaults };
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

/**
 * Swap image directories for two entities on disk.
 * Uses a temp rename to avoid collisions.
 */
export async function swapEntityImages(
  projectDir: string,
  zoneName: string,
  entityIdA: string,
  entityIdB: string
): Promise<void> {
  const safeA = entityIdA.replace(/:/g, "_");
  const safeB = entityIdB.replace(/:/g, "_");
  const dirA = await join(projectDir, "images", zoneName, safeA);
  const dirB = await join(projectDir, "images", zoneName, safeB);
  const dirTemp = await join(projectDir, "images", zoneName, `_swap_tmp_${Date.now()}`);

  const aExists = await exists(dirA);
  const bExists = await exists(dirB);

  if (aExists && bExists) {
    await rename(dirA, dirTemp);
    await rename(dirB, dirA);
    await rename(dirTemp, dirB);
  } else if (aExists) {
    await rename(dirA, dirB);
  } else if (bExists) {
    await rename(dirB, dirA);
  }
  // If neither exists, nothing to do
}

export async function reparseZone(
  yamlPath: string
): Promise<{ zoneName: string; entities: Entity[] }> {
  const yamlContent = await readTextFile(yamlPath);
  const parsed = parseZone(yamlContent);
  return { zoneName: parsed.zoneName, entities: parsed.entities };
}
