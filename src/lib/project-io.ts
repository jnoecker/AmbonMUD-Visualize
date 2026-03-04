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
