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
  reconcileImages,
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
  reloadProject: () => Promise<void>;
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

  // Refs for latest values (avoid stale closures in concurrent batch operations)
  const projectRef = useRef<ProjectFile | null>(null);
  const projectDirRef = useRef<string | null>(null);

  // In-memory cache: "zone/entityId/filename" -> data URL
  const imageCache = useRef<Map<string, string>>(new Map());

  const cacheKey = (zone: string, entityId: string, filename: string) =>
    `${zone}/${entityId}/${filename}`;

  // Sync helper: updates both state and ref, persists to disk
  const commitProject = useCallback(async (p: ProjectFile) => {
    projectRef.current = p;
    setProject(p);
    const dir = projectDirRef.current;
    if (dir) {
      await saveProject(dir, p);
    }
  }, []);

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
      projectRef.current = proj;
      projectDirRef.current = dir;
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
      let proj = await openProject(dir);
      proj = await reconcileImages(dir, proj);
      projectRef.current = proj;
      projectDirRef.current = dir;
      setProject(proj);
      setProjectDir(dir);
      setSelectedEntityId(null);
      setSelectedZone(null);
      imageCache.current.clear();
      await parseAllZones(proj);
    },
    [parseAllZones]
  );

  const reloadProject = useCallback(async () => {
    const dir = projectDirRef.current;
    if (!dir) return;
    let proj = await openProject(dir);
    proj = await reconcileImages(dir, proj);
    projectRef.current = proj;
    setProject(proj);
    imageCache.current.clear();
    await parseAllZones(proj);
  }, [parseAllZones]);

  const closeProject = useCallback(() => {
    projectRef.current = null;
    projectDirRef.current = null;
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
      const p = projectRef.current;
      if (!p) return;
      const next = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: { ...p.zones[zoneKey], vibe },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const updatePrompt = useCallback(
    async (zoneKey: string, entityId: string, prompt: string) => {
      const p = projectRef.current;
      if (!p) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;
      const asset = zone.assets[entityId];
      if (!asset) return;

      const next = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: {
            ...zone,
            assets: {
              ...zone.assets,
              [entityId]: { ...asset, currentPrompt: prompt },
            },
          },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const addVariant = useCallback(
    async (
      zoneKey: string,
      entityId: string,
      imageData: Uint8Array,
      prompt: string
    ) => {
      const p = projectRef.current;
      const dir = projectDirRef.current;
      if (!p || !dir) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;
      const asset = zone.assets[entityId];
      if (!asset) return;

      const filename = await saveImage(dir, zoneKey, entityId, imageData);

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

      // Re-read ref to get latest (another concurrent call may have updated it)
      const latest = projectRef.current!;
      const latestZone = latest.zones[zoneKey];
      const next: ProjectFile = {
        ...latest,
        zones: {
          ...latest.zones,
          [zoneKey]: {
            ...latestZone,
            assets: { ...latestZone.assets, [entityId]: updatedAsset },
          },
        },
      };
      await commitProject(next);

      // Auto-select the new variant
      setViewingVariantIndex(updatedAsset.variants.length - 1);
    },
    [commitProject]
  );

  const approveVariant = useCallback(
    async (zoneKey: string, entityId: string, variantIndex: number) => {
      const p = projectRef.current;
      if (!p) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;
      const asset = zone.assets[entityId];
      if (!asset) return;

      const next = {
        ...p,
        zones: {
          ...p.zones,
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
      await commitProject(next);
    },
    [commitProject]
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
      const dir = projectDirRef.current;
      if (!dir) throw new Error("No project open");

      // Check cache first
      const key = cacheKey(zoneKey, entityId, filename);
      const cached = imageCache.current.get(key);
      if (cached) return cached;

      // Read from disk and cache
      const filePath = await getImagePath(dir, zoneKey, entityId, filename);
      const bytes = await readFile(filePath);
      const dataUrl = bytesToDataUrl(bytes);
      imageCache.current.set(key, dataUrl);
      return dataUrl;
    },
    []
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
        reloadProject,
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
