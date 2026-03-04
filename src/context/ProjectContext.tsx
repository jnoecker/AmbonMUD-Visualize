import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProjectFile, AssetEntry, ImageVariant, DefaultImageEntry } from "../types/project";
import type { Entity, EntityType, ParsedZone } from "../types/entities";
import type { SpritePromptTemplate } from "../types/sprites";
import { detectSpriteZone } from "../lib/sprite-parser";
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
  ) => Promise<number>;
  approveVariant: (zoneKey: string, entityId: string, variantIndex: number) => Promise<void>;
  setViewingVariant: (index: number) => void;
  viewingVariantIndex: number;

  updateDefaultImage: (
    zoneKey: string,
    entityType: EntityType,
    imageData: Uint8Array,
    prompt: string
  ) => Promise<void>;
  getDefaultImageDataUrl: (zoneKey: string, entityType: EntityType) => Promise<string | null>;

  batchApprove: () => Promise<number>;

  updateSpriteTemplate: (zoneKey: string, template: SpritePromptTemplate) => Promise<void>;

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
    let projUpdated = false;
    let updatedProj = { ...proj, zones: { ...proj.zones } };

    for (const zone of Object.values(proj.zones)) {
      try {
        const yamlContent = await readTextFile(zone.sourceYamlPath);
        const parsedZone = parseZone(yamlContent);
        parsed[zone.zoneName] = parsedZone;

        // Auto-detect sprite zones
        if (!zone.spriteConfig) {
          const config = detectSpriteZone(parsedZone.entities);
          if (config) {
            updatedProj.zones[zone.zoneName] = {
              ...updatedProj.zones[zone.zoneName],
              spriteConfig: config,
            };
            projUpdated = true;
          }
        }
      } catch {
        // Zone file might not be accessible
      }
    }

    setParsedZones(parsed);

    // Persist sprite config detection
    if (projUpdated) {
      projectRef.current = updatedProj;
      setProject(updatedProj);
      const dir = projectDirRef.current;
      if (dir) {
        await saveProject(dir, updatedProj);
      }
    }
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
    ): Promise<number> => {
      const p = projectRef.current;
      const dir = projectDirRef.current;
      if (!p || !dir) return 0;
      const zone = p.zones[zoneKey];
      if (!zone) return 0;
      const asset = zone.assets[entityId];
      if (!asset) return 0;

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

      return updatedAsset.variants.length - 1;
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

  const batchApprove = useCallback(async (): Promise<number> => {
    const p = projectRef.current;
    if (!p) return 0;

    let count = 0;
    let updated = { ...p };

    for (const [zoneKey, zone] of Object.entries(p.zones)) {
      let assetsChanged = false;
      const updatedAssets = { ...zone.assets };

      for (const [entityId, asset] of Object.entries(zone.assets)) {
        if (asset.status !== "approved" && asset.variants.length === 1) {
          updatedAssets[entityId] = {
            ...asset,
            status: "approved" as const,
            approvedVariantIndex: 0,
          };
          assetsChanged = true;
          count++;
        }
      }

      if (assetsChanged) {
        updated = {
          ...updated,
          zones: {
            ...updated.zones,
            [zoneKey]: { ...zone, assets: updatedAssets },
          },
        };
      }
    }

    if (count > 0) {
      await commitProject(updated);
    }
    return count;
  }, [commitProject]);

  const updateSpriteTemplate = useCallback(
    async (zoneKey: string, template: SpritePromptTemplate) => {
      const p = projectRef.current;
      if (!p) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;
      const next = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: { ...zone, spriteTemplate: template },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const updateDefaultImage = useCallback(
    async (
      zoneKey: string,
      entityType: EntityType,
      imageData: Uint8Array,
      prompt: string
    ) => {
      const p = projectRef.current;
      const dir = projectDirRef.current;
      if (!p || !dir) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;

      const entityId = `default_${entityType}`;
      const filename = await saveImage(dir, zoneKey, entityId, imageData);

      // Cache the data URL
      const key = cacheKey(zoneKey, entityId, filename);
      imageCache.current.set(key, bytesToDataUrl(imageData));

      const emptyEntry: DefaultImageEntry = { prompt: null, filename: null, generatedAt: null };
      const currentDefaults = zone.defaultImages || { room: { ...emptyEntry }, mob: { ...emptyEntry }, item: { ...emptyEntry } };
      const updatedDefaults = {
        ...currentDefaults,
        [entityType]: {
          prompt,
          filename,
          generatedAt: new Date().toISOString(),
        },
      };

      const latest = projectRef.current!;
      const latestZone = latest.zones[zoneKey];
      const next: ProjectFile = {
        ...latest,
        zones: {
          ...latest.zones,
          [zoneKey]: { ...latestZone, defaultImages: updatedDefaults },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const getDefaultImageDataUrl = useCallback(
    async (zoneKey: string, entityType: EntityType): Promise<string | null> => {
      const p = projectRef.current;
      const dir = projectDirRef.current;
      if (!p || !dir) return null;

      const zone = p.zones[zoneKey];
      if (!zone?.defaultImages) return null;

      const entry = zone.defaultImages[entityType];
      if (!entry?.filename) return null;

      const entityId = `default_${entityType}`;
      const key = cacheKey(zoneKey, entityId, entry.filename);
      const cached = imageCache.current.get(key);
      if (cached) return cached;

      const filePath = await getImagePath(dir, zoneKey, entityId, entry.filename);
      const bytes = await readFile(filePath);
      const dataUrl = bytesToDataUrl(bytes);
      imageCache.current.set(key, dataUrl);
      return dataUrl;
    },
    []
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
        batchApprove,
        updateSpriteTemplate,
        updateDefaultImage,
        getDefaultImageDataUrl,
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
