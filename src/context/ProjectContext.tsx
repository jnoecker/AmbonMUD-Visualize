import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProjectFile, AssetEntry, ImageVariant } from "../types/project";
import type { Entity, ParsedZone } from "../types/entities";
import {
  createProject,
  openProject,
  saveProject,
  saveImage,
  getImagePath,
} from "../lib/project-io";
import { parseZone } from "../lib/yaml-parser";
import { readTextFile, readFile } from "@tauri-apps/plugin-fs";

function bytesToDataUrl(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

interface ProjectContextValue {
  project: ProjectFile | null;
  projectDir: string | null;
  parsedZones: Record<string, ParsedZone>;
  selectedEntityId: string | null;
  selectedZone: string | null;

  createNewProject: (dir: string, name: string, yamlPaths: string[]) => Promise<void>;
  openExistingProject: (dir: string) => Promise<void>;
  closeProject: () => void;
  selectEntity: (zoneKey: string, entityId: string) => void;

  updateVibe: (zoneKey: string, vibe: string) => Promise<void>;
  updatePrompt: (zoneKey: string, entityId: string, prompt: string) => Promise<void>;
  addVariant: (
    zoneKey: string,
    entityId: string,
    imageData: Uint8Array,
    prompt: string
  ) => Promise<void>;
  approveVariant: (zoneKey: string, entityId: string, variantIndex: number) => Promise<void>;
  setViewingVariant: (index: number) => void;
  viewingVariantIndex: number;

  getEntity: (entityId: string) => Entity | undefined;
  getAsset: (zoneKey: string, entityId: string) => AssetEntry | undefined;
  getImageDataUrl: (zoneKey: string, entityId: string, filename: string) => Promise<string>;
  getApprovalCounts: () => { approved: number; total: number };
}

const ProjectCtx = createContext<ProjectContextValue>(null!);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectFile | null>(null);
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [parsedZones, setParsedZones] = useState<Record<string, ParsedZone>>({});
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [viewingVariantIndex, setViewingVariantIndex] = useState(0);

  // In-memory cache: "zone/entityId/filename" -> data URL
  const imageCache = useRef<Map<string, string>>(new Map());

  const cacheKey = (zone: string, entityId: string, filename: string) =>
    `${zone}/${entityId}/${filename}`;

  const persistProject = useCallback(
    async (p: ProjectFile) => {
      if (projectDir) {
        setProject(p);
        await saveProject(projectDir, p);
      }
    },
    [projectDir]
  );

  const parseAllZones = useCallback(async (proj: ProjectFile) => {
    const parsed: Record<string, ParsedZone> = {};
    for (const zone of Object.values(proj.zones)) {
      try {
        const yamlContent = await readTextFile(zone.sourceYamlPath);
        parsed[zone.zoneName] = parseZone(yamlContent);
      } catch {
        // Zone file might not be accessible
      }
    }
    setParsedZones(parsed);
  }, []);

  const createNewProject = useCallback(
    async (dir: string, name: string, yamlPaths: string[]) => {
      const proj = await createProject(dir, name, yamlPaths);
      setProject(proj);
      setProjectDir(dir);
      setSelectedEntityId(null);
      setSelectedZone(null);
      imageCache.current.clear();
      await parseAllZones(proj);
    },
    [parseAllZones]
  );

  const openExistingProject = useCallback(
    async (dir: string) => {
      const proj = await openProject(dir);
      setProject(proj);
      setProjectDir(dir);
      setSelectedEntityId(null);
      setSelectedZone(null);
      imageCache.current.clear();
      await parseAllZones(proj);
    },
    [parseAllZones]
  );

  const closeProject = useCallback(() => {
    setProject(null);
    setProjectDir(null);
    setParsedZones({});
    setSelectedEntityId(null);
    setSelectedZone(null);
    imageCache.current.clear();
  }, []);

  const selectEntity = useCallback((zoneKey: string, entityId: string) => {
    setSelectedZone(zoneKey);
    setSelectedEntityId(entityId);
    setViewingVariantIndex(0);
  }, []);

  const updateVibe = useCallback(
    async (zoneKey: string, vibe: string) => {
      if (!project) return;
      const next = {
        ...project,
        zones: {
          ...project.zones,
          [zoneKey]: { ...project.zones[zoneKey], vibe },
        },
      };
      await persistProject(next);
    },
    [project, persistProject]
  );

  const updatePrompt = useCallback(
    async (zoneKey: string, entityId: string, prompt: string) => {
      if (!project) return;
      const zone = project.zones[zoneKey];
      if (!zone) return;
      const asset = zone.assets[entityId];
      if (!asset) return;

      const next = {
        ...project,
        zones: {
          ...project.zones,
          [zoneKey]: {
            ...zone,
            assets: {
              ...zone.assets,
              [entityId]: { ...asset, currentPrompt: prompt },
            },
          },
        },
      };
      await persistProject(next);
    },
    [project, persistProject]
  );

  const addVariant = useCallback(
    async (
      zoneKey: string,
      entityId: string,
      imageData: Uint8Array,
      prompt: string
    ) => {
      if (!project || !projectDir) return;
      const zone = project.zones[zoneKey];
      if (!zone) return;
      const asset = zone.assets[entityId];
      if (!asset) return;

      const filename = await saveImage(projectDir, zoneKey, entityId, imageData);

      // Cache the data URL immediately from the bytes we already have
      const key = cacheKey(zoneKey, entityId, filename);
      imageCache.current.set(key, bytesToDataUrl(imageData));

      const variant: ImageVariant = {
        filename,
        generatedAt: new Date().toISOString(),
        prompt,
      };

      const updatedAsset: AssetEntry = {
        ...asset,
        currentPrompt: prompt,
        status: asset.status === "pending" ? "generated" : asset.status,
        variants: [...asset.variants, variant],
      };

      const next = {
        ...project,
        zones: {
          ...project.zones,
          [zoneKey]: {
            ...zone,
            assets: { ...zone.assets, [entityId]: updatedAsset },
          },
        },
      };
      await persistProject(next);

      // Auto-select the new variant
      setViewingVariantIndex(updatedAsset.variants.length - 1);
    },
    [project, projectDir, persistProject]
  );

  const approveVariant = useCallback(
    async (zoneKey: string, entityId: string, variantIndex: number) => {
      if (!project) return;
      const zone = project.zones[zoneKey];
      if (!zone) return;
      const asset = zone.assets[entityId];
      if (!asset) return;

      const next = {
        ...project,
        zones: {
          ...project.zones,
          [zoneKey]: {
            ...zone,
            assets: {
              ...zone.assets,
              [entityId]: {
                ...asset,
                status: "approved" as const,
                approvedVariantIndex: variantIndex,
              },
            },
          },
        },
      };
      await persistProject(next);
    },
    [project, persistProject]
  );

  const getEntity = useCallback(
    (entityId: string): Entity | undefined => {
      for (const zone of Object.values(parsedZones)) {
        const entity = zone.entities.find((e) => e.id === entityId);
        if (entity) return entity;
      }
      return undefined;
    },
    [parsedZones]
  );

  const getAsset = useCallback(
    (zoneKey: string, entityId: string): AssetEntry | undefined => {
      return project?.zones[zoneKey]?.assets[entityId];
    },
    [project]
  );

  const getImageDataUrl = useCallback(
    async (zoneKey: string, entityId: string, filename: string): Promise<string> => {
      if (!projectDir) throw new Error("No project open");

      // Check cache first
      const key = cacheKey(zoneKey, entityId, filename);
      const cached = imageCache.current.get(key);
      if (cached) return cached;

      // Read from disk and cache
      const filePath = await getImagePath(projectDir, zoneKey, entityId, filename);
      const bytes = await readFile(filePath);
      const dataUrl = bytesToDataUrl(bytes);
      imageCache.current.set(key, dataUrl);
      return dataUrl;
    },
    [projectDir]
  );

  const getApprovalCounts = useCallback(() => {
    if (!project) return { approved: 0, total: 0 };
    let approved = 0;
    let total = 0;
    for (const zone of Object.values(project.zones)) {
      for (const asset of Object.values(zone.assets)) {
        total++;
        if (asset.status === "approved") approved++;
      }
    }
    return { approved, total };
  }, [project]);

  return (
    <ProjectCtx.Provider
      value={{
        project,
        projectDir,
        parsedZones,
        selectedEntityId,
        selectedZone,
        createNewProject,
        openExistingProject,
        closeProject,
        selectEntity,
        updateVibe,
        updatePrompt,
        addVariant,
        approveVariant,
        setViewingVariant: setViewingVariantIndex,
        viewingVariantIndex,
        getEntity,
        getAsset,
        getImageDataUrl,
        getApprovalCounts,
      }}
    >
      {children}
    </ProjectCtx.Provider>
  );
}

export function useProject() {
  return useContext(ProjectCtx);
}
